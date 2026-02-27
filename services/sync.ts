import {AccountService} from "@/services/account";
import {StorageService} from "@/services/storage";
import {VaultService} from "@/services/vault";
import {instance} from "@/utils/axios";

export class SyncService {
    private account: AccountService;
    private storage: StorageService;
    private vault: VaultService;

    statusKey = 'sync_status';
    lastSyncKey = 'sync_last_sync';
    hashKey = 'sync_hash';

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

    async status() {
        return {
            isEnabled: await this.storage.read<boolean>(this.statusKey),
            lastSyncAt: await this.storage.read<boolean>(this.lastSyncKey),
            hash: await this.storage.read<string>(this.hashKey),
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
        return this.#broadcastStatus()
    }

    async syncDown() {
        await this.#enable();

        const data = await this.download();

        if (!data) {
            return {
                error: 'Error checking for updates'
            };
        }

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

        return this.#broadcastStatus()
    }

    async syncUp() {
        await this.#enable();

        const base64 = await this.vault.export()

        if (!base64) {
            return {
                error: 'No local database found'
            };
        }

        await this.upload(base64)

        await this.#recordSync();

        this.events.dispatchEvent(new Event("sync"));

        return this.#broadcastStatus()
    }

    async remoteHash() {
        const token = await this.account.token();

        if (!token) {
            return null;
        }

        const response = await fetch(this.account.baseUrl() + '/api/v1/vaults', {
            method: 'HEAD',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/plain'
            }
        })

        if (!response.ok) {
            return null;
        }

        return response.headers.get('X-Vault-Hash')
    }

    async upload(database: string) {
        const token = await this.account.token();

        if (!token) {
            return null;
        }

        const form = new FormData();

        const blob = new Blob([database], {type: "text/plain"});
        const file = new File([blob], "database.enc", {type: "text/plain"});

        form.append("vault", file);

        const response = await instance.post('/api/v1/vaults', form)

        return response.data
    }

    async download(): Promise<{ base64: string | null, hash: string | null } | null> {
        const token = await this.account.token();

        if (!token) {
            return null;
        }

        const response = await fetch(this.account.baseUrl() + '/api/v1/vaults', {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/plain'
            }
        })

        if (!response.ok) {

            if (response.status === 404) {
                return {
                    base64: null,
                    hash: null
                }
            }

            return null;
        }

        return {
            base64: await response.text(),
            hash: response.headers.get('X-Vault-Hash') ?? ''
        }
    }

    async destroy(): Promise<string | null> {
        const token = await this.account.token();

        if (!token) {
            return null;
        }

        const response = await fetch(this.account.baseUrl() + '/api/v1/vaults', {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/plain'
            }
        })

        if (!response.ok) {
            return null;
        }

        this.events.dispatchEvent(new Event("sync"));

        return response.json()
    }

    async #broadcastStatus() {
        const status = await this.status();

        browser.runtime.sendMessage({
            type: 'SYNC_STATUS_UPDATE',
            payload: status
        })

        return status;
    }
}
