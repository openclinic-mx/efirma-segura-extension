import {afterEach, beforeEach, expect, test} from 'vitest'
import {AxiosError, AxiosHeaders, InternalAxiosRequestConfig} from "axios";
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {instance} from "@/utils/axios";
import {StorageService} from './storage'
import {Vault} from '@/vault/vault'
import {Entries} from '@/vault/entries'
import {PasskeyLocks} from '@/vault/passkeyLocks'
import {SignatureService} from './signature'
import {VaultService} from './vault'
import {AccountService, User} from './account'
import {SyncService} from './sync'
import {onMessage, sendMessage} from "@/messaging";

// Every request gets the same answer. Only the network is replaced: the real interceptors still run.
const backend = (status: number | 'offline') => {
    instance.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        if (status === 'offline') {
            throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
        }

        const response = {data: '', status, statusText: '', headers: new AxiosHeaders(), config}

        if (status >= 400) {
            throw new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, null, response)
        }

        return response
    }
}

const originalAdapter = instance.defaults.adapter
const storageService = new StorageService();
let vault: Vault;
let accountService: AccountService;
let syncService: SyncService;

const user = {id: 1, email: 'user@example.com'} as User

// the services notify the side panel of every change; stand in for an open one
let removeListeners: (() => void)[] = []

beforeEach(async () => {
    fakeBrowser.reset();

    removeListeners = [
        onMessage('VAULT_STATUS_UPDATE', () => {}),
        onMessage('VAULT_LIST_UPDATE', () => {}),
        onMessage('ACCOUNT_STATUS_UPDATE', () => {}),
        onMessage('SYNC_STATUS_UPDATE', () => {}),
    ]

    vault = new Vault(storageService);
    accountService = new AccountService(storageService);
    const vaultService = new VaultService(vault, new SignatureService(new Entries(vault)), new PasskeyLocks(vault, storageService));
    syncService = new SyncService(accountService, storageService, vaultService);

    await vault.initialize('test')
    await storageService.write('token', 'token')
    await storageService.write('user', user)
});

afterEach(() => {
    instance.defaults.adapter = originalAdapter
    removeListeners.forEach(remove => remove())
})

test.each([
    ['offline', 'offline'],
    [401, 'unauthorized'],
    [500, 'server'],
] as const)('%s becomes %s', async (status, kind) => {
    backend(status)

    await expect(instance.get('/')).rejects.toMatchObject({name: 'BackendError', kind})
})

test('failures reach the side panel without the request', async () => {
    backend('offline')
    const remove = onMessage('ACCOUNT_CHECKOUT', message => accountService.checkout(message.data))

    const error = await sendMessage('ACCOUNT_CHECKOUT', 'month').catch(e => e)
    remove()

    expect(error).toMatchObject({name: 'BackendError', kind: 'offline'})
    // the request carries the Authorization header
    expect(error).not.toHaveProperty('cause')
    expect(error).not.toHaveProperty('config')
})

test('a failed download keeps the local vault', async () => {
    backend('offline')
    const stored = await vault.export()

    const status = await syncService.syncDown()

    expect(status.error?.kind).toBe('offline')
    expect(await vault.export()).toBe(stored)
})

test('a sync failure lasts until the next successful sync', async () => {
    backend(500)
    expect((await syncService.syncUp()).error?.kind).toBe('server')

    backend(201)
    expect((await syncService.syncUp()).error).toBeNull()
})

test('a background refresh keeps the cached user when the backend fails', async () => {
    backend('offline')

    await accountService.refresh()

    expect(await accountService.user()).toEqual(user)
})

test('logging out signs out of this browser even when the backend fails', async () => {
    backend('offline')

    await expect(accountService.clear()).rejects.toMatchObject({kind: 'offline'})

    expect(await accountService.token()).toBeNull()
})
