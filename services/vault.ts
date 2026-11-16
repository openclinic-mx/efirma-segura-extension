import {Vault} from "@/vault/vault";
import {PasskeyLocks} from "@/vault/passkeyLocks";
import {SignatureService} from "@/services/signature";
import {sendMessage, SignatureForm} from "@/messaging";

export class VaultService {
    private events = new EventTarget();

    private vault: Vault;
    private signatureService: SignatureService;
    private passkeyLocks: PasskeyLocks;

    constructor(
        vault: Vault,
        signatureService: SignatureService,
        passkeyLocks: PasskeyLocks
    ) {
        this.vault = vault
        this.signatureService = signatureService
        this.passkeyLocks = passkeyLocks

        // another device replaced the vault key: the session was dropped, tell the timer and the pages
        this.vault.onInvalidate(() => {
            this.events.dispatchEvent(new Event("lock"));
            this.#broadcastStatus()
        })
    }

    onSignature(handler: () => void) {
        this.events.addEventListener("signature", handler);
    }

    /** Export actions while unlocked: keep the vault open while the user works on them. */
    onActivity(handler: () => void) {
        this.events.addEventListener("activity", handler);
    }

    #activity() {
        if (this.vault.isUnlocked()) {
            this.events.dispatchEvent(new Event("activity"));
        }
    }

    onLock(handler: () => void) {
        this.events.addEventListener("lock", handler);
    }

    onUnlock(handler: () => void) {
        this.events.addEventListener("unlock", handler);
    }

    onImport(handler: () => void) {
        this.events.addEventListener("import", handler);
    }

    async addSignatures(signatures: SignatureForm[]) {
        try {
            const ids = await this.signatureService.addSignatures(
                await Promise.all(
                    signatures.map((signature) => {
                        return {
                            title: signature.name,
                            cer: readBase64AsBytes(signature.cer),
                            key: readBase64AsBytes(signature.key),
                            password: signature.password
                        }
                    })
                )
            )

            this.events.dispatchEvent(new Event("signature"));

            this.#broadcastList()

            return {
                ids,
                error: null
            }
        } catch (e) {
            this.#broadcastStatus()
            if (e instanceof Error) {
                return {
                    ids: null,
                    error: e.message
                }
            } else {
                return {
                    ids: null,
                    error: 'Unexpected error'
                }
            }
        }
    }

    async addSignature(signature: SignatureForm) {

        try {
            const id = await this.signatureService.addSignature(
                signature.name,
                readBase64AsBytes(signature.cer),
                readBase64AsBytes(signature.key),
                signature.password
            )

            this.events.dispatchEvent(new Event("signature"));

            this.#broadcastList()

            return {
                id,
                error: null
            }
        } catch (e) {
            this.#broadcastStatus()
            if (e instanceof Error) {
                return {
                    id: null,
                    error: e.message
                }
            } else {
                return {
                    id: null,
                    error: 'Unexpected error'
                }
            }
        }
    }

    async removeSignature(id: string) {
        try {
            await this.signatureService.removeSignature(id)

            this.events.dispatchEvent(new Event("remove-signature"));

            this.#broadcastList()

            return {id}
        } catch (e) {
            this.#broadcastStatus()
            if (e instanceof Error) {
                return {
                    id: null,
                    error: e.message
                }
            } else {
                return {
                    id: null,
                    error: 'Unexpected error'
                }
            }
        }
    }

    async password(id: string) {
        try {
            const signature = await this.signatureService.getSignature(id)

            if (!signature) {
                return {
                    password: null,
                    error: 'No encontramos esta e.firma.'
                }
            }

            return {
                password: signature.password,
                error: null
            }
        } catch (e) {
            this.#broadcastStatus()
            return {
                password: null,
                error: e instanceof Error ? e.message : 'Unexpected error'
            }
        }
    }

    async status() {
        return {
            isInitialized: await this.vault.isInitialized(),
            isUnlocked: this.vault.isUnlocked(),
            canUnlockWithPasskey: await this.passkeyLocks.canUnlock(),
        }
    }

    async list() {

        try {
            return {
                error: null,
                signatures: await this.signatureService.getSignaturesMeta()
            }
        } catch (e) {
            this.#broadcastStatus()
            if (e instanceof Error) {
                return {
                    signatures: [],
                    error: e.message
                }
            } else {
                return {
                    signatures: [],
                    error: 'Unexpected error'
                }
            }
        }
    }

    async unlock(masterPassword: string) {
        try {
            await this.vault.unlock({password: masterPassword})

            this.events.dispatchEvent(new Event("unlock"));

            return this.#broadcastStatus()
        } catch (e) {
            if (e instanceof Error) {
                return {
                    error: e.message
                }
            } else {
                return {
                    error: 'Unexpected error'
                }
            }
        }
    }

    async unlockWithPasskey(credentialId: string, prfOutput: string) {
        try {
            await this.passkeyLocks.unlock(credentialId, prfOutput)

            this.events.dispatchEvent(new Event("unlock"));

            return this.#broadcastStatus()
        } catch (e) {
            return {
                error: e instanceof Error ? e.message : 'Unexpected error'
            }
        }
    }

    async exportKeePass(masterPassword: string) {
        this.#activity()

        try {
            return {
                base64: await this.vault.exportKeePass(masterPassword)
            }
        } catch (e) {
            return {
                error: e instanceof Error ? e.message : 'Unexpected error'
            }
        }
    }

    async lock() {
        this.vault.lock()

        this.events.dispatchEvent(new Event("lock"));

        return this.#broadcastStatus()
    }

    async destroy() {
        await this.vault.deleteVault()

        this.events.dispatchEvent(new Event("lock"));

        return this.#broadcastStatus()
    }

    async initialize(masterPassword: string) {

        if (await this.vault.isInitialized()) {
            return {
                error: 'La bóveda ya fue inicializada previamente, intenta reiniciar tu navegador.',
            }
        }

        await this.vault.initialize(masterPassword)

        this.events.dispatchEvent(new Event("unlock"));

        return this.#broadcastStatus()
    }

    async import(base64: string) {
        await this.vault.import(base64)

        this.events.dispatchEvent(new Event("import"));

        // sync may bring passkeys added or removed on another device: refresh the lock screen
        return this.#broadcastStatus()
    }

    async export() {
        return this.vault.export()
    }

    async reset() {
        return this.vault.silentlyDeleteVault()
    }

    async #broadcastStatus() {
        const status = await this.status()
        sendMessage('VAULT_STATUS_UPDATE', status)
        return status
    }

    async #broadcastList() {
        const list = await this.list();
        sendMessage('VAULT_LIST_UPDATE', list)
        return list
    }

    async requestBroadcast() {
        return this.#broadcastList()
    }

    async requestStatusBroadcast() {
        return this.#broadcastStatus()
    }
}
