import {beforeEach, expect, test} from 'vitest'
import {readFile} from "node:fs/promises";
import {DatabaseService} from './database'
import {StorageService} from './storage'
import {SignatureService} from './signatures'
import {fakeBrowser} from 'wxt/testing/fake-browser';

let storageService = new StorageService();
let databaseService: DatabaseService;
let signatureService: SignatureService;

const cer = await readFile('./tests/fixtures/signature/signature.cer')
const key = await readFile('./tests/fixtures/signature/signature.key')

beforeEach(async () => {
    fakeBrowser.reset();
    databaseService = new DatabaseService(storageService);
    signatureService = new SignatureService(databaseService);
    await signatureService.initialize('test')
});

test('can add signature', async () => {
    expect(
        await signatureService.getSignaturesMeta()
    ).toHaveLength(0)

    await signatureService.addSignature(
        'title',
        cer.buffer,
        key.buffer,
        '12345678a'
    )

    expect(
        await signatureService.getSignaturesMeta()
    ).toHaveLength(1)

    console.log( await signatureService.getSignaturesMeta())
})
