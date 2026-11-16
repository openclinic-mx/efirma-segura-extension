// Passkey locks (see locks.ts): enrollment, listing, renaming and removing them, plus the passkey settings that stay
// on each browser. Vault owns the stored vault and the session; every change goes through vault.updateLocks().

import {StorageService} from "@/services/storage";
import {Vault} from "./vault";
import {PasswordUpgrade} from "./lockEditor";
import {base64ToBytes, bytesToBase64, bytesToBase64Url, randomBytes} from "@/utils/encoding";
import {ENROLLMENT_EXPIRED_ERROR, ENROLLMENT_TTL, PASSKEY_RP_ID} from "@/utils/passkeys";
import {isPasskeyLock, Locks, PasskeyLock, passkeyKek, PRF_OUTPUT_LENGTH} from "@/vault/locks";
import {INVALID_KEY_ERROR} from "@/vault/errors";

export type PasskeySummary = {
    id: string,
    credentialId: string,
    name: string,
    backupEligible: boolean,
    createdAt: string,
    lastUsedAt: string | null,
}

export type PasskeyUnlockRequest = {
    rpId: string,
    userHandle: string,
    credentials: { id: string, transports: string[], prfSalt: string }[],
}

export type PasskeyEnrollment = {
    token: string,
    rpId: string,
    userHandle: string,
    excludeCredentialIds: string[],
    prfSalt: string,
}

export type PasskeyEnrollmentResult = {
    token: string,
    credentialId: string,
    // base64 PRF output (results.first) from the verification get()
    prfOutput: string,
    aaguid: string | null,
    backupEligible: boolean,
    transports: string[],
    name: string,
}

type PendingEnrollment = { prfSalt: string, expiresAt: number, upgrade: PasswordUpgrade | null };

const MAX_PASSKEY_NAME = 64;

const prfBytes = (prfOutput: string) => {
    const bytes = base64ToBytes(prfOutput);

    if (bytes.length !== PRF_OUTPUT_LENGTH) {
        throw new Error(INVALID_KEY_ERROR);
    }

    return bytes;
}

const passkeyName = (name: unknown) => {
    const trimmed = typeof name === 'string' ? name.trim().slice(0, MAX_PASSKEY_NAME) : '';

    return trimmed || 'Llave de acceso';
}

const passkeysOf = (locks: Locks | null): PasskeyLock[] => locks?.locks.filter(isPasskeyLock) ?? [];

export class PasskeyLocks {

    // device-local: unlocking never rewrites (and re-syncs) the vault
    readonly lastUsedKey: string = "passkeyLastUsed";

    // device-local: the passkey may live on this computer or only on a phone, so each browser decides
    readonly autoUnlockKey: string = "passkeyAutoUnlock";

    private vault: Vault;

    private storage: StorageService;

    private enrollments = new Map<string, PendingEnrollment>();

    constructor(vault: Vault, storage: StorageService) {
        this.vault = vault;
        this.storage = storage;

        // enrollment tokens never outlive the session that handed them out
        this.vault.onLock(() => this.enrollments.clear());

        this.vault.onDelete(() => this.storage.clear(this.lastUsedKey));
    }

    async canUnlock(): Promise<boolean> {
        return passkeysOf(await this.vault.storedLocks()).length > 0;
    }

    async unlock(credentialId: string, prfOutput: string) {
        await this.vault.unlock({credentialId, prfOutput: prfBytes(prfOutput)});

        await this.recordUse(credentialId);
    }

    /** Passkeys registered in the vault. Metadata only: available while locked. */
    async list(): Promise<PasskeySummary[]> {
        const passkeys = passkeysOf(await this.vault.storedLocks());

        if (passkeys.length === 0) {
            return [];
        }

        const lastUsed = await this.lastUsed();

        return passkeys.map((lock) => this.summary(lock, lastUsed[lock.credentialId] ?? null));
    }

    /** What the lock screen needs to call navigator.credentials.get(). Salts are not secret. */
    async unlockRequest(): Promise<PasskeyUnlockRequest | null> {
        const locks = await this.vault.storedLocks();
        const passkeys = passkeysOf(locks);

        if (!locks || passkeys.length === 0) {
            return null;
        }

        return {
            rpId: PASSKEY_RP_ID,
            userHandle: locks.userHandle,
            credentials: passkeys.map((lock) => ({
                id: lock.credentialId,
                transports: lock.transports,
                prfSalt: lock.prfSalt,
            })),
        };
    }

    /** Confirms the master password and hands out a single-use token to add a passkey. */
    async beginEnrollment(masterPassword: string): Promise<PasskeyEnrollment> {
        const {locks, upgrade} = await this.vault.verifyPassword(masterPassword);

        const token = bytesToBase64Url(randomBytes(32));
        const prfSalt = bytesToBase64(randomBytes(32));

        this.enrollments.set(token, {prfSalt, expiresAt: Date.now() + ENROLLMENT_TTL, upgrade});

        return {
            token,
            rpId: PASSKEY_RP_ID,
            userHandle: locks?.userHandle ?? upgrade!.userHandle,
            excludeCredentialIds: passkeysOf(locks).map((lock) => lock.credentialId),
            prfSalt,
        };
    }

    async finishEnrollment(result: PasskeyEnrollmentResult): Promise<PasskeySummary> {
        const pending = this.enrollments.get(result.token);

        // single use, even when it fails
        this.enrollments.delete(result.token);

        if (!pending || pending.expiresAt < Date.now()) {
            throw new Error(ENROLLMENT_EXPIRED_ERROR);
        }

        if (!/^[A-Za-z0-9_-]+$/.test(result.credentialId)) {
            throw new Error("Invalid credential id");
        }

        const kek = await passkeyKek(prfBytes(result.prfOutput));

        const lock = await this.vault.updateLocks((locks) => locks.addPasskey({
            credentialId: result.credentialId,
            prfSalt: pending.prfSalt,
            name: passkeyName(result.name),
            aaguid: typeof result.aaguid === 'string' ? result.aaguid : null,
            backupEligible: result.backupEligible === true,
            transports: Array.isArray(result.transports)
                ? result.transports.filter((transport) => typeof transport === 'string')
                : [],
            createdAt: new Date().toISOString(),
        }, kek, pending.upgrade));

        return this.summary(lock, null);
    }

    async remove(id: string) {
        const removed = await this.vault.updateLocks((locks) => locks.removePasskey(id));

        if (!removed) {
            return null;
        }

        const lastUsed = await this.lastUsed();
        delete lastUsed[removed.credentialId];
        await this.storage.write(this.lastUsedKey, lastUsed);

        return {id: removed.id, credentialId: removed.credentialId};
    }

    async rename(id: string, name: string) {
        return this.vault.updateLocks((locks) => locks.renamePasskey(id, passkeyName(name)));
    }

    /** Ask for the passkey as soon as the side panel opens locked. On unless the user turned it off here. */
    async autoUnlock(): Promise<boolean> {
        return (await this.storage.read<boolean>(this.autoUnlockKey)) ?? true;
    }

    async setAutoUnlock(enabled: boolean): Promise<boolean> {
        const value = enabled === true;
        await this.storage.write(this.autoUnlockKey, value);
        return value;
    }

    private summary(lock: PasskeyLock, lastUsedAt: string | null): PasskeySummary {
        return {
            id: lock.id,
            credentialId: lock.credentialId,
            name: lock.name,
            backupEligible: lock.backupEligible,
            createdAt: lock.createdAt,
            lastUsedAt,
        };
    }

    private async lastUsed() {
        return (await this.storage.read<Record<string, string>>(this.lastUsedKey)) ?? {};
    }

    private async recordUse(credentialId: string) {
        const lastUsed = await this.lastUsed();
        lastUsed[credentialId] = new Date().toISOString();
        await this.storage.write(this.lastUsedKey, lastUsed);
    }
}
