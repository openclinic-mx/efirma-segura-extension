import {Vault} from "@/vault/vault";
import {PasskeyEnrollmentResult, PasskeyLocks} from "@/vault/passkeyLocks";
import {VaultService} from "@/services/vault";
import {sendMessage} from "@/messaging";

const NOT_FOUND_ERROR = 'No encontramos esta llave de acceso.';

const errorMessage = (e: unknown) => e instanceof Error ? e.message : 'Unexpected error';

/** Manages the passkeys enrolled in the vault. Unlocking with a passkey belongs to the VaultService. */
export class PasskeyService {
    private events = new EventTarget();

    private vault: Vault;
    private passkeyLocks: PasskeyLocks;
    private vaultService: VaultService;

    constructor(
        vault: Vault,
        passkeyLocks: PasskeyLocks,
        vaultService: VaultService
    ) {
        this.vault = vault
        this.passkeyLocks = passkeyLocks
        this.vaultService = vaultService

        // sync may bring passkeys added or removed on another device: refresh the list
        this.vaultService.onImport(() => {
            this.#broadcastList()
        })
    }

    /** Passkey actions while unlocked: keep the vault open while the user works on them. */
    onActivity(handler: () => void) {
        this.events.addEventListener("activity", handler);
    }

    #activity() {
        if (this.vault.isUnlocked()) {
            this.events.dispatchEvent(new Event("activity"));
        }
    }

    async list() {
        return this.passkeyLocks.list()
    }

    async unlockRequest() {
        return this.passkeyLocks.unlockRequest()
    }

    async beginEnrollment(masterPassword: string) {
        this.#activity()

        try {
            return await this.passkeyLocks.beginEnrollment(masterPassword)
        } catch (e) {
            return {error: errorMessage(e)}
        }
    }

    async finishEnrollment(result: PasskeyEnrollmentResult) {
        this.#activity()

        try {
            const passkey = await this.passkeyLocks.finishEnrollment(result)

            this.#broadcast()

            return {passkey}
        } catch (e) {
            return {error: errorMessage(e)}
        }
    }

    async remove(id: string) {
        this.#activity()

        try {
            const removed = await this.passkeyLocks.remove(id)

            this.#broadcast()

            return removed
                ? {id: removed.id, credentialId: removed.credentialId}
                : {error: NOT_FOUND_ERROR}
        } catch (e) {
            return {error: errorMessage(e)}
        }
    }

    async rename(id: string, name: string) {
        this.#activity()

        try {
            const renamed = await this.passkeyLocks.rename(id, name)

            this.#broadcast()

            return renamed ? {id} : {error: NOT_FOUND_ERROR}
        } catch (e) {
            return {error: errorMessage(e)}
        }
    }

    async autoUnlock() {
        return this.passkeyLocks.autoUnlock()
    }

    async setAutoUnlock(enabled: boolean) {
        return this.passkeyLocks.setAutoUnlock(enabled)
    }

    async #broadcastList() {
        const passkeys = await this.list();
        sendMessage('PASSKEY_LIST_UPDATE', passkeys).catch(() => {})
        return passkeys
    }

    async #broadcast() {
        const passkeys = await this.#broadcastList()
        // canUnlockWithPasskey may have changed
        await this.vaultService.requestStatusBroadcast()
        return passkeys
    }
}
