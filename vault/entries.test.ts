import {beforeEach, expect, test} from 'vitest'
import {Entries} from './entries'
import {Vault} from './vault'
import {StorageService} from '@/services/storage'
import {fakeBrowser} from 'wxt/testing/fake-browser';


let storageService = new StorageService();
let vault: Vault;
let entries: Entries;

beforeEach(async () => {
    // See https://webext-core.aklinker1.io/fake-browser/reseting-state
    fakeBrowser.reset();
    vault = new Vault(storageService);
    entries = new Entries(vault);
    await vault.initialize('test')
});



test('can reset', async () => {
    await vault.deleteVault()
    expect(await vault.isInitialized()).toBe(false)
    expect(await storageService.read(vault.storageKey)).toBeNull()
})


test('can lock and unlock', async () => {

    expect(vault.isUnlocked()).toBe(true);

    vault.lock()

    expect(vault.isUnlocked()).toBe(false);

    await vault.unlock({password: 'test'})

    expect(vault.isUnlocked()).toBe(true);
})


test('can get entries', async () => {
    expect(
        await entries.list()
    ).toHaveLength(0)

    await entries.add(async (entry) => entry)

    expect(
        await entries.list()
    ).toHaveLength(1)
})

test('can delete entries', async () => {

    const id = await entries.add(async (entry) => entry)

    await entries.remove(id)

    expect(
        await entries.list()
    ).toHaveLength(0)
})

test('can use entry', async () => {

    const id = await entries.add(async (entry) => entry)

    const entry = await entries.get(id);

    expect(
        entry
    ).not.toBeNull();

    expect(
        entry?.times.usageCount
    ).toBe(1)
})


test('cannot add entries while locked', async () => {

    vault.lock();

    await expect(entries.add(async (entry) => entry)).rejects.toThrow()
})

test('cannot get entry while locked', async () => {

    const id = await entries.add(async (entry) => entry)

    vault.lock();

    await expect(entries.get(id)).rejects.toThrow()
})

test('cannot remove entries while locked', async () => {

    const id = await entries.add(async (entry) => entry)

    vault.lock();

    await expect(entries.remove(id)).rejects.toThrow()

    await vault.unlock({password: 'test'});

    expect(
        await entries.list()
    ).toHaveLength(1)
})


test('cannot unlock with wrong password', async () => {

    expect(vault.isUnlocked()).toBe(true);

    vault.lock()

    expect(vault.isUnlocked()).toBe(false);

    await expect(vault.unlock({password: 'test1'})).rejects.toThrow();

    expect(vault.isUnlocked()).toBe(false);
})
