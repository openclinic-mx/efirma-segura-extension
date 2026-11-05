import {AccountService} from "@/services/account";
import {StorageService} from "@/services/storage";
import {VaultService} from "@/services/vault";
import {instance} from "@/utils/axios";
import {AxiosHeaders, AxiosResponse} from "axios";
import {sendMessage, SyncStatus} from "@/messaging";
import {BackendError} from "@/utils/backend";

const vaultTransferTimeout = 30_000;

const vaultHash = (headers: AxiosResponse['headers']): string | null => {
    const hash = AxiosHeaders.from(headers as AxiosHeaders).get('x-vault-hash')

    return typeof hash === 'string' ? hash : null
}

export class SyncService {
    private account: AccountService;
    private storage: StorageService;
    private vault: VaultService;

    statusKey = 'sync_status';
    lastSyncKey = 'sync_last_sync';
    hashKey = 'sync_hash';
    errorKey = 'sync_error';

    private events = new EventTarget();

    constructor(
        account: AccountService,
        storage: StorageService,
        vault: VaultService
    ) {
        this.account = account;
        this.storage = storage;
        this.vault = vault;
    }

    onSync(handler: () => void) {
        this.events.addEventListener("sync", handler);
    }

    async status(): Promise<SyncStatus> {
        return {
            isEnabled: await this.storage.read<boolean>(this.statusKey),
            lastSyncAt: await this.storage.read<string>(this.lastSyncKey),
            hash: await this.storage.read<string>(this.hashKey),
            error: await this.storage.read<SyncStatus['error']>(this.errorKey),
        }
    }

    #enable() {
        return this.storage.write(this.statusKey, true);
    }

    #disable() {
        return this.storage.write(this.statusKey, false);
    }

    #recordSync() {
        return this.storage.write(
            this.lastSyncKey,
            new Date().toISOString()
        )
    }

    #recordHash(hash: string) {
        return this.storage.write(
            this.hashKey,
            hash
        )
    }

    async syncStop() {
        await this.#disable();
        await this.storage.clear(this.errorKey);
        return this.#broadcastStatus()
    }

    async syncDown() {
        await this.#enable();

        return this.#attempt(async () => {
            const data = await this.download();

            // if user clears database remotely
            // we need to clear it here too

            if (data.base64 === null) {
                await this.account.fetch()
                await this.vault.reset()
            } else {
                await this.vault.import(data.base64);
            }

            await this.#recordSync();

            await this.#recordHash(data.hash ?? '')
        })
    }

    async syncUp() {
        await this.#enable();

        const base64 = await this.vault.export()

        if (!base64) {
            throw new Error('No local database found');
        }

        return this.#attempt(async () => {
            await this.upload(base64)

            await this.#recordSync();

            this.events.dispatchEvent(new Event("sync"));
        })
    }

    async destroy() {
        return this.#attempt(async () => {
            await this.account.requireToken();

            try {
                await instance.delete('/api/v1/vaults', {
                    headers: {Accept: 'text/plain'}
                })
            } catch (e) {
                // already gone
                if (!(e instanceof BackendError && e.status === 404)) {
                    throw e
                }
            }

            this.events.dispatchEvent(new Event("sync"));
        })
    }

    async remoteHash() {
        await this.account.requireToken();

        try {
            const response = await instance.head('/api/v1/vaults', {
                headers: {Accept: 'text/plain'}
            })

            return vaultHash(response.headers)
        } catch (e) {
            // no remote vault
            if (e instanceof BackendError && e.status === 404) {
                return null
            }

            throw e
        }
    }

    async upload(database: string) {
        await this.account.requireToken();

        const form = new FormData();

        const blob = new Blob([database], {type: "text/plain"});
        const file = new File([blob], "database.enc", {type: "text/plain"});

        form.append("vault", file);

        await instance.post('/api/v1/vaults', form, {
            timeout: vaultTransferTimeout,
        })
    }

    async download(): Promise<{ base64: string | null, hash: string | null }> {
        await this.account.requireToken();

        try {
            const response = await instance.get<string>('/api/v1/vaults', {
                headers: {Accept: 'text/plain'},
                responseType: 'text',
                timeout: vaultTransferTimeout,
            })

            return {
                base64: response.data,
                hash: vaultHash(response.headers) ?? ''
            }
        } catch (e) {
            // no remote vault: it was deleted from another browser
            if (e instanceof BackendError && e.status === 404) {
                return {
                    base64: null,
                    hash: null
                }
            }

            throw e
        }
    }

    async #attempt(operation: () => Promise<void>): Promise<SyncStatus> {
        try {
            await operation()

            await this.storage.clear(this.errorKey)
        } catch (e) {
            if (!(e instanceof BackendError)) {
                throw e
            }

            await this.storage.write(this.errorKey, {
                kind: e.kind,
                message: e.message,
                at: new Date().toISOString(),
            })
        }

        return this.#broadcastStatus()
    }

    async #broadcastStatus() {
        const status = await this.status();

        sendMessage('SYNC_STATUS_UPDATE', status)

        return status;
    }
}
