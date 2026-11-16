import {beforeEach, expect, test} from 'vitest'
import {readFile} from "node:fs/promises";
import {Entries} from '@/vault/entries'
import {Vault} from '@/vault/vault'
import {StorageService} from './storage'
import {SignatureService} from './signature'
import {fakeBrowser} from 'wxt/testing/fake-browser';

let storageService = new StorageService();
let vault: Vault;
let entries: Entries;
let signatureService: SignatureService;

let cer: NonSharedBuffer
let key: NonSharedBuffer


beforeEach(async () => {
    fakeBrowser.reset();
    vault = new Vault(storageService);
    entries = new Entries(vault);
    signatureService = new SignatureService(entries);
    await vault.initialize('test')

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
            serialNumber: '30001000000500003359',
            password: '12345678a',
            rfc: 'MISC491214B86',
            legalName: 'CECILIA MIRANDA SANCHEZ'
        })
    );
})
