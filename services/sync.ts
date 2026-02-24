import {AccountService} from "@/services/account";
import {StorageService} from "@/services/storage";
import {VaultService} from "@/services/vault";

export class SyncService {
    private account: AccountService;
    private storage: StorageService;
    private vault: VaultService;

    statusKey = 'sync_status';
    lastSyncKey = 'sync_last_sync';

    constructor(
        account: AccountService,
        storage: StorageService,
        vault: VaultService
    ) {
        this.account = account;
        this.storage = storage;
        this.vault = vault;
    }

    async status() {
        return {
            isEnabled: await this.storage.read<boolean>(this.statusKey),
            lastSyncAt: await this.storage.read<boolean>(this.lastSyncKey)
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

    async syncStop() {
        await this.#disable();
        return this.#broadcastStatus()
    }

    async syncDown() {
        await this.#enable();

        const base64 = await this.download();

        if (!base64) {
            return {
                error: 'No remote database found'
            };
        }

        await this.vault.import(base64);

        await this.#recordSync();

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

        return this.#broadcastStatus()
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

        const response = await fetch(this.account.baseUrl() + '/api/v1/vaults', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: form,
        })

        return response
    }

    async download(): Promise<string | null> {
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
            return null;
        }

        return response.text()
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

        return response.json()
    }

    #broadcastStatus() {
        browser.runtime.sendMessage({
            type: 'SYNC_STATUS_UPDATE',
            payload: this.status()
        })
    }
}
