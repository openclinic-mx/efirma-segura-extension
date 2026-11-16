// The stored vault is always a plain KDBX4 file (base64), so KeePass opens it and versions before passkeys keep
// working with it until a passkey is added:
// - without locks: keyed with the master password, exactly as versions before passkeys write it (and as KeePass
//   imports arrive);
// - with locks: keyed with a random data key (a 32-byte key-file component). The locks (locks.ts) live in the outer
//   header's PublicCustomData, readable while locked and covered by the header HMAC; their public keys live in the
//   encrypted Meta/CustomData.

import {
    BinaryStream,
    Consts,
    Credentials,
    Kdbx,
    KdbxContext,
    KdbxHeader,
    ProtectedValue,
    VarDictionary,
} from "kdbxweb";
import {readBase64AsBytes, readBufferAsBase64} from "@/utils/files";
import {Locks, parseLocks} from "@/vault/locks";

const LOCKS_ITEM = 'efirma-segura.locks';

const LOCK_KEYS_ITEM = 'efirma-segura.lockKeys';

export type LockKeys = Record<string, string>;

export const passwordCredentials = (password: string) => {
    return new Credentials(ProtectedValue.fromString(password));
}

/** Always pass a copy: kdbxweb XORs the bytes in place, and the session zeroes its key on lock. */
export const dataKeyCredentials = (dataKey: Uint8Array<ArrayBuffer>) => {
    return new Credentials(null, dataKey.slice());
}

export const createKdbx = (credentials: Credentials) => {
    const db = Kdbx.create(credentials, 'e.firma Segura');
    db.setVersion(4);
    db.setKdf(Consts.KdfId.Aes);
    return db;
}

/** Throws kdbxweb's InvalidKey when credentials don't open it. A successful load also authenticates the locks. */
export const loadKdbx = (base64: string, credentials: Credentials) => {
    return Kdbx.load(readBase64AsBytes(base64).buffer, credentials);
}

export const saveKdbx = async (db: Kdbx) => readBufferAsBase64(await db.save());

/**
 * The locks in a stored vault, read from the header without any key: null when it has none (keyed with the
 * password). Unauthenticated until the KDBX loads: fine to list passkeys and to pick a lock, never to trust.
 */
export const readLocks = (base64: string): Locks | null => {
    const header = KdbxHeader.read(
        new BinaryStream(readBase64AsBytes(base64).buffer),
        new KdbxContext({kdbx: new Kdbx()})
    );

    const item = header.publicCustomData?.get(LOCKS_ITEM);

    return typeof item === 'string' ? parseLocks(item) : null;
}

/** The locks of a loaded (authenticated) KDBX. */
export const locksOf = (db: Kdbx): Locks | null => {
    const item = db.header.publicCustomData?.get(LOCKS_ITEM);

    return typeof item === 'string' ? parseLocks(item) : null;
}

/** Re-keys db with dataKey and stores its locks and their public keys. Written by the next save, together. */
export const writeLocks = async (db: Kdbx, dataKey: Uint8Array<ArrayBuffer>, locks: Locks, keys: LockKeys) => {
    const header = db.header.publicCustomData ?? new VarDictionary();
    header.set(LOCKS_ITEM, VarDictionary.ValueType.String, JSON.stringify(locks));
    db.header.publicCustomData = header;

    db.meta.customData.set(LOCK_KEYS_ITEM, {value: JSON.stringify(keys)});

    db.credentials = dataKeyCredentials(dataKey);
    await db.credentials.ready;
}

export const lockKeysOf = (db: Kdbx): LockKeys => {
    const value = db.meta.customData.get(LOCK_KEYS_ITEM)?.value;

    return value ? JSON.parse(value) : {};
}

/** A KeePass file keyed with the master password, without locks: what the user can take to KeePass. */
export const toPasswordKdbx = async (db: Kdbx, password: string) => {
    db.header.publicCustomData?.remove(LOCKS_ITEM);
    db.meta.customData.delete(LOCK_KEYS_ITEM);

    db.credentials = passwordCredentials(password);
    await db.credentials.ready;

    return saveKdbx(db);
}
