import {beforeEach, expect, test} from 'vitest'
import {DatabaseService} from './database'
import {StorageService} from './storage'
import {fakeBrowser} from 'wxt/testing/fake-browser';


let storageService = new StorageService();
let databaseService: DatabaseService;

beforeEach(async () => {
    // See https://webext-core.aklinker1.io/fake-browser/reseting-state
    fakeBrowser.reset();
    databaseService = new DatabaseService(storageService);
    await databaseService.initialize('test')
});



test('can reset', async () => {
    await databaseService.deleteDatabase()
    expect(await databaseService.isInitialized()).toBe(false)
    expect(await storageService.read(databaseService.storageKey)).toBeNull()
})


test('can lock and unlock', async () => {

    expect(databaseService.isUnlocked()).toBe(true);

    databaseService.lock()

    expect(databaseService.isUnlocked()).toBe(false);

    await databaseService.unlock('test')

    expect(databaseService.isUnlocked()).toBe(true);
})


test('can get entries', async () => {
    expect(
        await databaseService.getEntries()
    ).toHaveLength(0)

    await databaseService.addEntry(async (entry) => entry)

    expect(
        await databaseService.getEntries()
    ).toHaveLength(1)
})

test('can delete entries', async () => {

    const id = await databaseService.addEntry(async (entry) => entry)

    await databaseService.removeEntry(id)

    expect(
        await databaseService.getEntries()
    ).toHaveLength(0)
})

test('can use entry', async () => {

    const id = await databaseService.addEntry(async (entry) => entry)

    const entry = await databaseService.getEntry(id);

    expect(
        entry
    ).not.toBeNull();

    expect(
        entry?.times.usageCount
    ).toBe(1)
})


test('cannot add entries while locked', async () => {

    databaseService.lock();

    await expect(databaseService.addEntry(async (entry) => entry)).rejects.toThrowError()
})

test('cannot get entry while locked', async () => {

    const id = await databaseService.addEntry(async (entry) => entry)

    databaseService.lock();

    await expect(databaseService.getEntry(id)).rejects.toThrowError()
})

test('cannot remove entries while locked', async () => {

    const id = await databaseService.addEntry(async (entry) => entry)

    databaseService.lock();

    await expect(databaseService.removeEntry(id)).rejects.toThrowError()

    await databaseService.unlock('test');

    expect(
        await databaseService.getEntries()
    ).toHaveLength(1)
})


test('cannot unlock with wrong password', async () => {

    expect(databaseService.isUnlocked()).toBe(true);

    databaseService.lock()

    expect(databaseService.isUnlocked()).toBe(false);

    await expect(databaseService.unlock('test1')).rejects.toThrowError();

    expect(databaseService.isUnlocked()).toBe(false);
})
