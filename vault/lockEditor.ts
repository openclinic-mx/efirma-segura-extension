// Changes to the locks of an unlocked vault: adding (and, for the first passkey, re-keying), renaming and removing
// passkey locks, and replacing the password lock. Runs inside Vault.updateLocks(), which loads the vault before and saves it after.

import {Credentials, Kdbx} from "kdbxweb";
import {
    createLock,
    generateDataKey,
    isPasskeyLock,
    isPasswordLock,
    LockRecord,
    Locks,
    PasskeyFields,
    PasskeyLock,
    PasswordKek,
    openLock,
    sealDataKey,
} from "@/vault/locks";
import {SESSION_INVALIDATED_ERROR, UNSUPPORTED_VAULT_ERROR} from "@/vault/errors";
import {
    dataKeyCredentials,
    LockKeys,
    lockKeysOf,
    locksOf,
    passwordCredentials,
    writeLocks,
} from "@/vault/kdbx";
import {PASSKEY_ALREADY_REGISTERED_ERROR} from "@/utils/passkeys";

/**
 * What the first passkey needs to add locks to a vault keyed with the password: derived while the user confirms the
 * password (PBKDF2 is slow), used only if the vault still has no locks when the passkey is added.
 */
export type PasswordUpgrade = { password: PasswordKek, userHandle: string };

/** What opens the KDBX. dataKey is null while the vault has no locks: it is keyed with the master password. */
export type VaultKey = { credentials: Credentials, dataKey: Uint8Array<ArrayBuffer> | null };

/**
 * Changes the locks of a loaded vault, inside Vault.updateLocks(). Every change is written by the same KDBX save
 * as the entries, so the header HMAC binds the locks to the data key.
 */
export class LockEditor {
    changed = false;

    /** Set when the edit re-keyed the vault: Vault moves the session to it once the vault is stored. */
    next: VaultKey | null = null;

    #db: Kdbx;
    #locks: Locks | null;
    #keys: LockKeys;
    #dataKey: Uint8Array<ArrayBuffer> | null;

    /** dataKey: the session's, null while the vault has no locks. Copied: lock() zeroes the session key in place. */
    constructor(db: Kdbx, dataKey: Uint8Array<ArrayBuffer> | null) {
        this.#db = db;
        this.#locks = locksOf(db);
        this.#keys = lockKeysOf(db);
        this.#dataKey = dataKey?.slice() ?? null;
    }

    get userHandle() {
        return this.#locks?.userHandle ?? null;
    }

    get passkeys(): PasskeyLock[] {
        return this.#locks?.locks.filter(isPasskeyLock) ?? [];
    }

    /**
     * Adds a passkey lock. A vault without locks gets them now (its first passkey): re-keyed with a new data key and a
     * password lock from upgrade, all in the same save.
     */
    async addPasskey(fields: PasskeyFields, kek: CryptoKey, upgrade: PasswordUpgrade | null): Promise<PasskeyLock> {
        if (this.passkeys.some((lock) => lock.credentialId === fields.credentialId)) {
            throw new Error(PASSKEY_ALREADY_REGISTERED_ERROR);
        }

        let locks = this.#locks;
        let keys = this.#keys;
        let dataKey = this.#dataKey;

        if (!locks || !dataKey) {
            if (!upgrade) {
                throw new Error(SESSION_INVALIDATED_ERROR);
            }

            dataKey = generateDataKey();
            const password = await createLock(
                {type: 'password', kdf: upgrade.password.kdf}, upgrade.password.kek, dataKey
            );
            locks = {v: 1, userHandle: upgrade.userHandle, locks: [password.lock]};
            keys = {[password.lock.id]: password.publicKey};
        }

        const passkey = await createLock({type: 'passkey', ...fields}, kek, dataKey);

        await this.#write(
            {...locks, locks: [...locks.locks, passkey.lock]},
            {...keys, [passkey.lock.id]: passkey.publicKey},
            dataKey,
        );

        return passkey.lock;
    }

    /** Removes a passkey lock and rotates the data key: the removed passkey may have seen the old one. */
    async removePasskey(id: string): Promise<PasskeyLock | null> {
        const removed = this.passkeys.find((lock) => lock.id === id);

        if (!this.#locks || !removed) {
            return null;
        }

        const keys = {...this.#keys};
        delete keys[removed.id];

        const dataKey = generateDataKey();
        const locks = await this.#reseal(this.#locks.locks.filter((lock) => lock.id !== removed.id), keys, dataKey);

        await this.#write({...this.#locks, locks}, keys, dataKey);

        return removed;
    }

    /**
     * Replaces the master password. With locks: a new password lock, and a new data key sealed to every other lock,
     * since whoever knew the old password may have kept the old key. Passkeys keep working. Without locks: the KDBX
     * is keyed with the new password, as versions before passkeys do.
     */
    async changePassword(newPassword: string, password: PasswordKek): Promise<void> {
        if (!this.#locks || !this.#dataKey) {
            this.#db.credentials = passwordCredentials(newPassword);
            await this.#db.credentials.ready;

            this.next = {credentials: passwordCredentials(newPassword), dataKey: null};
            this.changed = true;
            return;
        }

        const keys = {...this.#keys};
        const others = this.#locks.locks.filter((lock) => {
            if (isPasswordLock(lock)) {
                delete keys[lock.id];
                return false;
            }
            return true;
        });

        const dataKey = generateDataKey();
        const lock = await createLock({type: 'password', kdf: password.kdf}, password.kek, dataKey);

        // the KEK is at hand: never store a password lock that doesn't open
        const opened = await openLock(lock.lock, password.kek);
        const opens = opened.every((byte, i) => byte === dataKey[i]);
        opened.fill(0);

        if (!opens) {
            dataKey.fill(0);
            throw new Error(UNSUPPORTED_VAULT_ERROR);
        }

        await this.#write(
            {...this.#locks, locks: [lock.lock, ...await this.#reseal(others, keys, dataKey)]},
            {...keys, [lock.lock.id]: lock.publicKey},
            dataKey,
        );
    }

    async renamePasskey(id: string, name: string): Promise<boolean> {
        const locks = this.#locks;

        if (!locks || !this.#dataKey || !this.passkeys.some((lock) => lock.id === id)) {
            return false;
        }

        await this.#write(
            {...locks, locks: locks.locks.map((lock) => lock.id === id ? {...lock, name} : lock)},
            this.#keys,
            this.#dataKey,
        );

        return true;
    }

    /** locks sealed to dataKey, also those of types this version doesn't know: sealing only needs public keys. */
    #reseal(locks: LockRecord[], keys: LockKeys, dataKey: Uint8Array<ArrayBuffer>): Promise<LockRecord[]> {
        return Promise.all(locks.map(async (lock) => {
            if (!keys[lock.id]) {
                throw new Error(UNSUPPORTED_VAULT_ERROR);
            }

            return {...lock, sealed: await sealDataKey(dataKey, keys[lock.id], lock.id)};
        }));
    }

    async #write(locks: Locks, keys: LockKeys, dataKey: Uint8Array<ArrayBuffer>) {
        await writeLocks(this.#db, dataKey, locks, keys);

        if (dataKey !== this.#dataKey) {
            this.next?.dataKey?.fill(0);
            this.next = {credentials: dataKeyCredentials(dataKey), dataKey: dataKey.slice()};
            this.#dataKey?.fill(0);
            this.#dataKey = dataKey;
        }

        this.#locks = locks;
        this.#keys = keys;
        this.changed = true;
    }

    /** Zeroes the editor's key copies. Take next (and null it) first to keep it. */
    dispose() {
        this.#dataKey?.fill(0);
        this.next?.dataKey?.fill(0);
    }
}
