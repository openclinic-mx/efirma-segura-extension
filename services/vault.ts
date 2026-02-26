import {DatabaseService} from "@/services/database";
import {SignatureService} from "@/services/signature";
import {AutoLockService} from "@/services/autoLock";

export class VaultService {
    private databaseService: DatabaseService;
    private signatureService: SignatureService;
    private autoLockService: AutoLockService;

    constructor(
        databaseService: DatabaseService,
        signatureService: SignatureService,
        autoLockService: AutoLockService
    ) {
        this.databaseService = databaseService
        this.signatureService = signatureService
        this.autoLockService = autoLockService;
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

            this.autoLockService.resetTimer()
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
            this.autoLockService.resetTimer()
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
            this.autoLockService.startTimer()
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
        this.autoLockService.clearTimer()
        return this.#broadcastStatus()
    }

    async destroy() {
        await this.databaseService.deleteDatabase()
        this.autoLockService.clearTimer()
        return this.#broadcastStatus()
    }

    async initialize(message: any) {
        const masterPassword = message.payload.masterPassword;
        await this.databaseService.initialize(masterPassword)
        this.autoLockService.startTimer()
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
