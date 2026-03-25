import {DatabaseService} from "@/services/database";
import {SignatureService} from "@/services/signature";
import {AutoLockService} from "@/services/autoLock";

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

    async addSignatures(message: any) {
        const {
            signatures
        } = message.payload as { signatures: { name: string, cer: string, key: string, password: string }[] };

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

    async addSignature(message: any) {
        const {
            name,
            cer,
            key,
            password
        } = message.payload;

        try {
            const id = await this.signatureService.addSignature(
                name,
                readBase64AsBytes(cer),
                readBase64AsBytes(key),
                password
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

    async removeSignature(message: any) {
        const id = message.payload.id;

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

    async unlock(message: any) {
        try {
            const masterPassword = message.payload.masterPassword;
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

    async destroy() {
        await this.databaseService.deleteDatabase()

        this.events.dispatchEvent(new Event("lock"));

        return this.#broadcastStatus()
    }

    async initialize(message: any) {
        const masterPassword = message.payload.masterPassword;
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
        browser.runtime.sendMessage({
            type: 'VAULT_STATUS_UPDATE',
            payload: status
        })
        return status
    }

    async #broadcastList() {
        const list = await this.list();
        browser.runtime.sendMessage({
            type: 'VAULT_LIST_UPDATE',
            payload: list
        })
        return list
    }

    async requestBroadcast() {
        return this.#broadcastList()
    }
}
