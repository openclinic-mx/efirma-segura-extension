// The encrypted vault that holds the e.firmas. Terms used across vault/:
// - vault: the KDBX file, stored in the browser (and synced as an opaque blob);
// - lock: one way to open the vault, the master password or a passkey (locks.ts). A vault without passkeys has no
//   locks yet: it is keyed with the master password, as versions before passkeys write it;
// - data key: the random key that opens the KDBX once it has locks. Every lock holds a copy of it;
// - session: the key of an unlocked vault, kept in memory until lock().
//
// Files: vault.ts (this: unlock, lock, read, update), kdbx.ts (the file format), locks.ts (what a lock is: create,
// open, seal), crypto.ts (the WebCrypto steps under locks.ts), lockEditor.ts (changing locks), passkeyLocks.ts
// (passkey enrollment), entries.ts (the e.firma entries), errors.ts.
// Code here never talks to the UI: the *Service classes in services/ answer messages and broadcast.

import {Kdbx} from 'kdbxweb';
import {StorageService} from "@/services/storage";
import {bytesToBase64Url, randomBytes} from "@/utils/encoding";
import {
    isPasskeyLock,
    isPasswordLock,
    Locks,
    MIN_PASSWORD_ITERATIONS,
    newPasswordKek,
    openLock,
    passkeyKek,
    PASSWORD_ITERATIONS,
    passwordKek,
} from "@/vault/locks";
import {
    INVALID_KEY_ERROR,
    LOCKED_ERROR,
    SESSION_INVALIDATED_ERROR,
    UNSUPPORTED_VAULT_ERROR,
} from "@/vault/errors";
import {UNKNOWN_PASSKEY_ERROR} from "@/utils/passkeys";
import {
    createKdbx,
    dataKeyCredentials,
    loadKdbx,
    passwordCredentials,
    readLocks,
    saveKdbx,
    toPasswordKdbx,
} from "@/vault/kdbx";
import {LockEditor, PasswordUpgrade, VaultKey} from "@/vault/lockEditor";

export type VaultOptions = {
    // tests only: PBKDF2 is intentionally slow
    passwordIterations?: number,
}

type Session = VaultKey;

/** Something that opens one of the vault's locks. */
export type Proof =
    | { password: string }
    | { credentialId: string, prfOutput: Uint8Array<ArrayBuffer> };

const NOT_FOUND_ERROR = "Database not found: Ensure database is initialized";

const isInvalidKey = (e: unknown) => e instanceof Error && e.message.startsWith(INVALID_KEY_ERROR);

/**
 * The stored vault and its session: how it is locked and unlocked, and the only code that reads or writes it.
 * Entries works with the e.firmas through read() and update(); PasskeyLocks and updatePassword() change the locks
 * through updateLocks().
 */
export class Vault {

    readonly storageKey: string = "kdbxDatabase";

    private storage: StorageService;

    private session: Session | null = null;

    private events = new EventTarget();

    private readonly passwordIterations: number;

    // serializes every read-modify-write of the stored vault (saves, lock changes, sync imports)
    private queue: Promise<unknown> = Promise.resolve();

    constructor(storage: StorageService, options: VaultOptions = {}) {
        this.storage = storage;
        this.passwordIterations = options.passwordIterations ?? PASSWORD_ITERATIONS;
    }

    /** Runs task after every previously queued storage update; tasks must not queue other tasks. */
    private exclusive<T>(task: () => Promise<T>): Promise<T> {
        const run = this.queue.then(task, task);
        this.queue = run.catch(() => undefined);
        return run;
    }

    /** Production floor; tests lower it through passwordIterations. Never taken from the lock. */
    private get minPasswordIterations() {
        return Math.min(MIN_PASSWORD_ITERATIONS, this.passwordIterations);
    }

    onSave(handler: () => void) {
        this.events.addEventListener("save", handler);
    }

    onClear(handler: () => void) {
        this.events.addEventListener("clear", handler);
    }

    /** The stored vault no longer opens with the session's key (changed on another device), so it was locked. */
    onInvalidate(handler: () => void) {
        this.events.addEventListener("invalidate", handler);
    }

    /** The session ended: locked, or replaced by a new unlock. */
    onLock(handler: () => void) {
        this.events.addEventListener("lock", handler);
    }

    /** The stored vault was deleted, also silently (reset). */
    onDelete(handler: () => void) {
        this.events.addEventListener("delete", handler);
    }

    async isInitialized(): Promise<boolean> {
        return !!(await this.export());
    }

    isUnlocked(): boolean {
        return this.session !== null;
    }

    /** The stored vault's locks, readable while locked. null without a vault, without locks, or unreadable. */
    async storedLocks(): Promise<Locks | null> {
        const raw = await this.export();

        try {
            return raw ? readLocks(raw) : null;
        } catch {
            return null;
        }
    }

    private async requireRaw(): Promise<string> {
        const raw = await this.export();

        if (!raw) {
            throw new Error(NOT_FOUND_ERROR);
        }

        return raw;
    }

    private requireSession() {
        if (!this.session) {
            throw new Error(LOCKED_ERROR);
        }

        return this.session;
    }

    private invalidate() {
        this.lock();
        this.events.dispatchEvent(new Event("invalidate"));
    }

    /** The data key from the lock proof opens. */
    private async openLocks(locks: Locks, proof: Proof): Promise<Uint8Array<ArrayBuffer>> {
        if ('password' in proof) {
            const lock = locks.locks.find(isPasswordLock);

            if (!lock) {
                throw new Error(UNSUPPORTED_VAULT_ERROR);
            }

            return openLock(lock, await passwordKek(proof.password, lock.kdf, this.minPasswordIterations));
        }

        const lock = locks.locks.filter(isPasskeyLock).find((lock) => lock.credentialId === proof.credentialId);

        if (!lock) {
            throw new Error(UNKNOWN_PASSKEY_ERROR);
        }

        return openLock(lock, await passkeyKek(proof.prfOutput));
    }

    async initialize(masterPassword: string) {
        const raw = await saveKdbx(createKdbx(passwordCredentials(masterPassword)));

        await this.exclusive(() => this.storage.write(this.storageKey, raw));

        this.lock();
        this.session = {credentials: passwordCredentials(masterPassword), dataKey: null};

        this.events.dispatchEvent(new Event("save"));
    }

    async unlock(proof: Proof): Promise<void> {
        const raw = await this.requireRaw();
        const locks = readLocks(raw);

        if (!locks && !('password' in proof)) {
            throw new Error(UNKNOWN_PASSKEY_ERROR);
        }

        const dataKey = locks ? await this.openLocks(locks, proof) : null;
        const credentials = dataKey
            ? dataKeyCredentials(dataKey)
            : passwordCredentials((proof as { password: string }).password);

        try {
            // also authenticates the locks: the header HMAC covers them
            await loadKdbx(raw, credentials);
        } catch (e) {
            dataKey?.fill(0);
            throw e;
        }

        // zero the previous key (and end what depends on it) before replacing the session
        this.lock();
        this.session = {credentials, dataKey};
    }

    lock() {
        this.session?.dataKey?.fill(0);
        this.session = null;
        this.events.dispatchEvent(new Event("lock"));
    }

    /** The stored KDBX opened with the session's key. Locks instead when it no longer opens. */
    private async load(session: Session): Promise<Kdbx> {
        const raw = await this.requireRaw();
        let db: Kdbx;

        try {
            db = await loadKdbx(raw, session.credentials);
        } catch (e) {
            if (!isInvalidKey(e)) {
                throw e;
            }

            if (this.session === session) {
                this.invalidate();
            }

            throw new Error(SESSION_INVALIDATED_ERROR);
        }

        if (this.session !== session) {
            throw new Error(LOCKED_ERROR);
        }

        return db;
    }

    /**
     * Runs task with the current vault. Nothing is written. Queued like the writes, so it never loads a vault halfway
     * through a re-key.
     */
    read<T>(task: (db: Kdbx) => T | Promise<T>): Promise<T> {
        return this.mutate(async (db) => ({value: await task(db), write: false, next: null}));
    }

    /**
     * Loads the vault, runs task and saves it, with nothing else touching storage in between.
     * task returns null or false to leave the vault untouched.
     */
    update<T>(task: (db: Kdbx) => Promise<T>): Promise<T> {
        return this.mutate(async (db) => {
            const value = await task(db);

            return {value, write: value !== null && value !== false, next: null};
        });
    }

    /** Like update(), for the locks. PBKDF2 or PRF key derivations belong before it: they would hold up the queue. */
    updateLocks<T>(task: (locks: LockEditor) => Promise<T>): Promise<T> {
        return this.mutate(async (db, session) => {
            const editor = new LockEditor(db, session.dataKey);

            try {
                const value = await task(editor);
                const next = editor.next;
                // the session takes this key over: dispose() must not zero it
                editor.next = null;

                return {value, write: editor.changed, next};
            } finally {
                editor.dispose();
            }
        });
    }

    private async mutate<T>(
        task: (db: Kdbx, session: Session) => Promise<{ value: T, write: boolean, next: Session | null }>
    ): Promise<T> {
        let session: Session;

        try {
            session = this.requireSession();
        } catch (e) {
            return Promise.reject(e);
        }

        const {value, written} = await this.exclusive(async () => {
            const db = await this.load(session);
            const {value, write, next} = await task(db, session);

            try {
                if (!write) {
                    return {value, written: false};
                }

                const raw = await saveKdbx(db);

                if (next) {
                    // a new key: never store a vault it doesn't open
                    await loadKdbx(raw, next.credentials);
                }

                if (this.session !== session) {
                    // locked (or unlocked again) meanwhile: just don't write
                    throw new Error(LOCKED_ERROR);
                }

                await this.storage.write(this.storageKey, raw);

                if (next && this.session === session) {
                    // same session, new key: calls already queued against it keep working
                    session.dataKey?.fill(0);
                    session.credentials = next.credentials;
                    session.dataKey = next.dataKey;
                } else {
                    // locked while writing: the password or a passkey opens the stored vault, nothing holds this key
                    next?.dataKey?.fill(0);
                }

                return {value, written: true};
            } catch (e) {
                next?.dataKey?.fill(0);
                throw e;
            }
        });

        if (written) {
            this.events.dispatchEvent(new Event("save"));
        }

        return value;
    }

    /**
     * Checks masterPassword against the unlocked vault. For a vault without locks it also prepares what its first
     * passkey needs (see PasswordUpgrade). Throws INVALID_KEY_ERROR on a wrong password.
     */
    async verifyPassword(masterPassword: string): Promise<{ locks: Locks | null, upgrade: PasswordUpgrade | null }> {
        const locks = await this.checkPassword(masterPassword);

        const upgrade = locks ? null : {
            password: await newPasswordKek(masterPassword, this.passwordIterations),
            userHandle: bytesToBase64Url(randomBytes(16)),
        };

        return {locks, upgrade};
    }

    /** Changes the master password (see LockEditor.changePassword). Throws INVALID_KEY_ERROR on a wrong current one. */
    async updatePassword(currentPassword: string, newPassword: string) {
        await this.checkPassword(currentPassword);

        // PBKDF2 before the queue: it would hold up every save
        const password = await newPasswordKek(newPassword, this.passwordIterations);

        await this.updateLocks((locks) => locks.changePassword(newPassword, password));
    }

    /** The vault's locks once masterPassword is confirmed to open this session's vault. */
    private async checkPassword(masterPassword: string): Promise<Locks | null> {
        const session = this.requireSession();
        // read in the queue: a re-key in progress (this device's first passkey) finishes first, so the stored vault
        // and the session key agree unless another device changed the vault. PBKDF2 then runs outside the queue.
        const {raw, sessionKey} = await this.exclusive(async () => ({
            raw: await this.requireRaw(),
            sessionKey: session.dataKey?.slice() ?? null,
        }));
        const locks = readLocks(raw);

        if (this.session !== session) {
            sessionKey?.fill(0);
            throw new Error(LOCKED_ERROR);
        }

        if ((locks === null) !== (sessionKey === null)) {
            // the vault gained or lost its locks on another device
            sessionKey?.fill(0);
            this.invalidate();
            throw new Error(SESSION_INVALIDATED_ERROR);
        }

        if (!locks || !sessionKey) {
            await loadKdbx(raw, passwordCredentials(masterPassword));
        } else {
            let matches = false;

            try {
                const dataKey = await this.openLocks(locks, {password: masterPassword});
                matches = dataKey.length === sessionKey.length && dataKey.every((byte, i) => byte === sessionKey[i]);
                dataKey.fill(0);
            } finally {
                sessionKey.fill(0);
            }

            if (!matches) {
                throw new Error(INVALID_KEY_ERROR);
            }
        }

        if (this.session !== session) {
            // locked while checking the password: anything handed out now would outlive the session
            throw new Error(LOCKED_ERROR);
        }

        return locks;
    }

    /** Raw stored string (base64 KDBX). Used by sync and by the KDBX import. */
    public async import(base64: string) {
        return this.exclusive(() => this.storage.write(this.storageKey, base64));
    }

    /** Raw stored string (base64 KDBX). Used by sync. */
    public async export() {
        return this.storage.read<string>(this.storageKey);
    }

    /** A .kdbx that opens in KeePass with the master password alone. Never changes the stored vault. */
    async exportKeePass(masterPassword: string): Promise<string> {
        const raw = await this.requireRaw();
        const locks = readLocks(raw);

        if (!locks) {
            // throws on a wrong password
            await loadKdbx(raw, passwordCredentials(masterPassword));
            return raw;
        }

        const dataKey = await this.openLocks(locks, {password: masterPassword});

        try {
            return await toPasswordKdbx(await loadKdbx(raw, dataKeyCredentials(dataKey)), masterPassword);
        } finally {
            dataKey.fill(0);
        }
    }

    deleteVault() {
        this.events.dispatchEvent(new Event("clear"));
        return this.silentlyDeleteVault();
    }

    async silentlyDeleteVault() {
        this.events.dispatchEvent(new Event("delete"));
        return this.storage.clear(this.storageKey);
    }
}
