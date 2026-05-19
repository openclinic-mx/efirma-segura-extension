import {DatabaseService} from "@/services/database";
import {SignatureService} from "@/services/signature";
import {sendMessage, SignatureForm} from "@/messaging";

export class VaultService {
    private events = new EventTarget();

    private databaseService: DatabaseService;
    private signatureService: SignatureService;

    constructor(
        databaseService: DatabaseService,
        signatureService: SignatureService
    ) {
        this.databaseService = databaseService
        this.signatureService = signatureService
    }

    onSignature(handler: () => void) {
        this.events.addEventListener("signature", handler);
    }

    onLock(handler: () => void) {
        this.events.addEventListener("lock", handler);
    }

    onUnlock(handler: () => void) {
        this.events.addEventListener("unlock", handler);
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

    async status() {
        return {
            isInitialized: await this.databaseService.isInitialized(),
            isUnlocked: this.databaseService.isUnlocked(),
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
            await this.databaseService.unlock(masterPassword)

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

    async lock() {
        this.databaseService.lock()

        this.events.dispatchEvent(new Event("lock"));

        return this.#broadcastStatus()
    }

    async $export() {
        return {
            base64: await this.databaseService.export()
        }
    }

    async destroy() {
        await this.databaseService.deleteDatabase()

        this.events.dispatchEvent(new Event("lock"));

        return this.#broadcastStatus()
    }

    async initialize(masterPassword: string) {
        await this.databaseService.initialize(masterPassword)

        this.events.dispatchEvent(new Event("unlock"));

        return this.#broadcastStatus()
    }

    async import(base64: string) {
        await this.databaseService.import(base64)
        return this.#broadcastStatus()
    }

    async export() {
        return this.databaseService.export()
    }

    async reset() {
        return this.databaseService.silentlyDeleteDatabase()
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
}
