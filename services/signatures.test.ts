import {beforeEach, expect, test} from 'vitest'
import {readFile} from "node:fs/promises";
import {DatabaseService} from './database'
import {StorageService} from './storage'
import {SignatureService} from './signatures'
import {fakeBrowser} from 'wxt/testing/fake-browser';

let storageService = new StorageService();
let databaseService: DatabaseService;
let signatureService: SignatureService;

let cer: NonSharedBuffer
let key: NonSharedBuffer


beforeEach(async () => {
    fakeBrowser.reset();
    databaseService = new DatabaseService(storageService);
    signatureService = new SignatureService(databaseService);
    await databaseService.initialize('test')

    cer = await readFile('./tests/fixtures/signature/signature.cer')
    key = await readFile('./tests/fixtures/signature/signature.key')
});

test('can add a signature', async () => {
    expect(
        await signatureService.getSignaturesMeta()
    ).toHaveLength(0)

    await signatureService.addSignature(
        'title',
        cer,
        key,
        '12345678a'
    )

    expect(
        await signatureService.getSignaturesMeta()
    ).toHaveLength(1)
})

test('can use a signature', async () => {
    const id = await signatureService.addSignature(
        'title',
        cer,
        key,
        '12345678a'
    )

    expect(
        await signatureService.getSignature(id)
    ).toEqual(
        expect.objectContaining({
            serialNumber: '292233162870206001759766198462772978647764776249',
            password: '12345678a',
            rfc: 'MISC491214B86',
            legalName: 'CECILIA MIRANDA SANCHEZ'
        })
    );
})
