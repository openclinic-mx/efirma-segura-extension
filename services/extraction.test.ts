import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {readFile} from "node:fs/promises";
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {Entries} from '@/vault/entries'
import {Vault} from '@/vault/vault'
import {StorageService} from './storage'
import {SignatureService} from './signature'
import {DownloadsApi, ExtractionService} from './extraction'

type FakeItem = { id: number, filename: string, exists: boolean, state: 'in_progress' | 'complete' }

const makeDownloads = () => {
    const items = new Map<number, FakeItem>()
    let nextId = 1

    const api = {
        // like conflictAction: 'uniquify', a name still in use gets a " (n)" suffix
        download: vi.fn(async ({filename}: { filename: string }) => {
            const id = nextId++
            const taken = (name: string) => [...items.values()].some(item => item.exists && item.filename === name)
            const [base, extension] = [filename.slice(0, filename.lastIndexOf('.')), filename.slice(filename.lastIndexOf('.'))]
            let name = filename
            for (let n = 1; taken(name); n++) {
                name = `${base} (${n})${extension}`
            }
            items.set(id, {id, filename: name, exists: true, state: 'complete'})
            return id
        }),
        search: vi.fn(async ({id}: { id: number }) => items.has(id) ? [items.get(id)] : []),
        removeFile: vi.fn(async (id: number) => {
            items.get(id)!.exists = false
        }),
        erase: vi.fn(async ({id}: { id: number }) => {
            items.delete(id)
            return [id]
        }),
        cancel: vi.fn(async (id: number) => {
            items.get(id)!.state = 'complete'
            items.get(id)!.exists = false
        }),
    }

    return {items, api, downloads: api as unknown as DownloadsApi}
}

const storageService = new StorageService();
let signatureService: SignatureService;
let fake: ReturnType<typeof makeDownloads>;
let extractionService: ExtractionService;
let signatureId: string;
let rfc: string;

const minutes = (n: number) => n * 60 * 1000

beforeEach(async () => {
    fakeBrowser.reset();
    vi.useFakeTimers({toFake: ['Date']});

    const vault = new Vault(storageService);
    signatureService = new SignatureService(new Entries(vault));
    await vault.initialize('test')

    signatureId = await signatureService.addSignature(
        'title',
        await readFile('./tests/fixtures/signature/signature.cer'),
        await readFile('./tests/fixtures/signature/signature.key'),
        '12345678a'
    )

    rfc = (await signatureService.getSignature(signatureId))!.rfc

    fake = makeDownloads()
    extractionService = new ExtractionService(signatureService, storageService, () => fake.downloads)
});

afterEach(() => {
    vi.useRealTimers()
})

const filenames = () => [...fake.items.values()].filter(item => item.exists).map(item => item.filename)

const extract = async () => {
    const response = await extractionService.extract(signatureId)
    if (response.error !== null) {
        throw new Error(response.error)
    }
    return response
}

test('extracts the .cer and .key to a folder, named after the RFC', async () => {
    const response = await extractionService.extract(signatureId)

    expect(response).toEqual({error: null, expiresAt: Date.now() + minutes(5), downloadIds: [1, 2]})
    expect(filenames()).toEqual([`e.firma Segura/${rfc}.cer`, `e.firma Segura/${rfc}.key`])
    expect(fake.api.download).toHaveBeenCalledWith(expect.objectContaining({saveAs: false}))
    expect(await extractionService.pending()).toHaveLength(2)
})

test('schedules the cleanup alarm', async () => {
    const {expiresAt} = await extract()

    const alarm = await fakeBrowser.alarms.get(extractionService.alarmName)

    expect(alarm?.scheduledTime).toBe(expiresAt)
})

test('fails without the downloads permission', async () => {
    const service = new ExtractionService(signatureService, storageService, () => undefined)

    const response = await service.extract(signatureId)

    expect(response.error).toEqual(expect.any(String))
})

test('fails for an unknown signature', async () => {
    const response = await extractionService.extract('missing')

    expect(response.error).toEqual(expect.any(String))
    expect(fake.api.download).not.toHaveBeenCalled()
})

test('keeps files until they expire', async () => {
    await extract()

    vi.setSystemTime(Date.now() + minutes(4))
    await extractionService.cleanup()

    expect(fake.api.removeFile).not.toHaveBeenCalled()
    expect(await extractionService.pending()).toHaveLength(2)
})

test('deletes expired files and erases them from the history', async () => {
    await extract()

    vi.setSystemTime(Date.now() + minutes(5))
    await extractionService.cleanup()

    expect(fake.api.removeFile).toHaveBeenCalledTimes(2)
    expect(fake.items.size).toBe(0)
    expect(await extractionService.pending()).toHaveLength(0)
    expect(await fakeBrowser.alarms.get(extractionService.alarmName)).toBeUndefined()
})

test('deletes everything right away when asked (vault lock)', async () => {
    await extract()

    await extractionService.cleanup({all: true})

    expect(fake.items.size).toBe(0)
    expect(await extractionService.pending()).toHaveLength(0)
})

test('only deletes expired extractions', async () => {
    const otherSignatureId = await signatureService.addSignature(
        'other',
        await readFile('./tests/fixtures/signature/signature.cer'),
        await readFile('./tests/fixtures/signature/signature.key'),
        '12345678a'
    )
    await extract()
    vi.setSystemTime(Date.now() + minutes(3))
    await extractionService.extract(otherSignatureId)

    vi.setSystemTime(Date.now() + minutes(2))
    await extractionService.cleanup()

    expect((await extractionService.pending()).map(extraction => extraction.downloadId)).toEqual([3, 4])
})

test('forgets files the user already deleted or moved', async () => {
    await extract()
    fake.items.get(1)!.exists = false

    await extractionService.cleanup({all: true})

    expect(fake.api.removeFile).toHaveBeenCalledExactlyOnceWith(2)
    expect(await extractionService.pending()).toHaveLength(0)
})

test('cancels downloads still in progress', async () => {
    await extract()
    fake.items.get(1)!.state = 'in_progress'

    await extractionService.cleanup({all: true})

    expect(fake.api.cancel).toHaveBeenCalledWith(1)
    expect(await extractionService.pending()).toHaveLength(0)
})

test('retries files that could not be deleted', async () => {
    await extract()
    // e.g. another program on Windows still has the file open
    fake.api.removeFile.mockRejectedValueOnce(new Error('in use'))

    await extractionService.cleanup({all: true})

    expect(await extractionService.pending()).toEqual([expect.objectContaining({downloadId: 1})])
    const alarm = await fakeBrowser.alarms.get(extractionService.alarmName)
    expect(alarm?.scheduledTime).toBe(Date.now() + ExtractionService.retryDelay)

    await extractionService.cleanup({all: true})

    expect(fake.items.size).toBe(0)
    expect(await extractionService.pending()).toHaveLength(0)
})

test('keeps files pending if the permission was revoked', async () => {
    await extract()

    const revoked = new ExtractionService(signatureService, storageService, () => undefined)
    await revoked.cleanup({all: true})

    expect(await extractionService.pending()).toHaveLength(2)
})

test('extracting again replaces the previous copies and restarts the timer', async () => {
    await extract()

    vi.setSystemTime(Date.now() + minutes(3))
    const response = await extract()

    expect(fake.api.removeFile).toHaveBeenCalledWith(1)
    expect(fake.api.removeFile).toHaveBeenCalledWith(2)
    expect(filenames()).toEqual([`e.firma Segura/${rfc}.cer`, `e.firma Segura/${rfc}.key`])
    expect(await extractionService.pending()).toEqual([
        expect.objectContaining({downloadId: 3, expiresAt: Date.now() + minutes(5)}),
        expect.objectContaining({downloadId: 4, expiresAt: Date.now() + minutes(5)}),
    ])
    expect(response.expiresAt).toBe(Date.now() + minutes(5))
})

test('extracting again after the user deleted the files downloads them again', async () => {
    await extract()
    fake.items.get(1)!.exists = false
    fake.items.get(2)!.exists = false

    await extract()

    expect(fake.api.removeFile).not.toHaveBeenCalled()
    expect(filenames()).toEqual([`e.firma Segura/${rfc}.cer`, `e.firma Segura/${rfc}.key`])
    expect((await extractionService.pending()).map(extraction => extraction.downloadId)).toEqual([3, 4])
})

test('a previous copy that cannot be deleted keeps its own timer', async () => {
    const {expiresAt: firstExpiresAt} = await extract()
    // e.g. another program on Windows still has the .cer open
    fake.api.removeFile.mockRejectedValueOnce(new Error('in use'))

    vi.setSystemTime(Date.now() + minutes(3))
    await extract()

    expect(filenames()).toEqual([
        `e.firma Segura/${rfc}.cer`,
        `e.firma Segura/${rfc} (1).cer`,
        `e.firma Segura/${rfc}.key`,
    ])
    expect(await extractionService.pending()).toEqual([
        expect.objectContaining({downloadId: 1, expiresAt: firstExpiresAt}),
        expect.objectContaining({downloadId: 3, expiresAt: Date.now() + minutes(5)}),
        expect.objectContaining({downloadId: 4, expiresAt: Date.now() + minutes(5)}),
    ])
})

test('extracting only replaces the copies of that signature', async () => {
    const otherSignatureId = await signatureService.addSignature(
        'other',
        await readFile('./tests/fixtures/signature/signature.cer'),
        await readFile('./tests/fixtures/signature/signature.key'),
        '12345678a'
    )
    await extract()
    await extractionService.extract(otherSignatureId)

    await extract()

    expect(fake.api.removeFile.mock.calls).toEqual([[1], [2]])
    expect((await extractionService.pending()).map(extraction => extraction.downloadId)).toEqual([3, 4, 5, 6])
})
