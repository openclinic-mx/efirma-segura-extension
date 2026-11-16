// Vault locks: every way to unlock the vault (the master password, each passkey) is a lock holding the data key.
//
// A vault with locks is a KDBX keyed with a random 32-byte data key (a KeePass key-file component, see kdbx.ts).
// Each lock is an X25519 key pair:
// - the data key is sealed to the lock's public key (crypto.ts);
// - the lock's private key is encrypted under the lock's KEK: PBKDF2(master password) or HKDF(PRF output).
// Sealing needs only public keys, so an unlocked vault can seal a new data key to every lock without the password or
// any passkey: removing a passkey rotates the data key.
//
// Public keys are stored inside the encrypted KDBX, never in the readable header: whoever knows a lock's public key
// can make that lock open a vault of their own (docs/research/vault-key-slots.md, Q2).

import * as z from "zod";
import {base64ToBytes, bytesToBase64, randomBytes} from "@/utils/encoding";
import {Bytes, decrypt, encrypt, Encrypted, generateKeyPair, hkdf, pbkdf2, seal, Sealed, unseal, utf8} from "./crypto";
import {DAMAGED_LOCK_ERROR, INVALID_KEY_ERROR, UNSUPPORTED_VAULT_ERROR} from "./errors";

export const PASSWORD_ITERATIONS = 600_000;

// Iterations come from synced data: bound them so a malformed lock can neither hang the background
// worker nor weaken the KEK. Only tests lower the floor (VaultOptions.passwordIterations).
export const MIN_PASSWORD_ITERATIONS = 100_000;

const MAX_PASSWORD_ITERATIONS = 10_000_000;

const DATA_KEY_LENGTH = 32;

export const PRF_OUTPUT_LENGTH = 32;

const PASSKEY_KEK_INFO = 'efirma-segura/passkey-kek/v1';

const AAD_PREFIX = 'efirma-segura/lock/v1';

// The stored format. The locks come from synced data: the schemas below are the only description of a lock, the
// types are inferred from them, and parseLocks() and the is*Lock() guards check them before anything uses a field.
// They check shape, not encodings: a field that doesn't decode fails where it is used, as a lock that doesn't open.

// an extension's CSP forbids eval: without this zod tries it once, and the browser reports the (caught) violation
z.config({jitless: true});

const encrypted = z.object({iv: z.string(), ct: z.string()}) satisfies z.ZodType<Encrypted>;

const sealed = encrypted.extend({epk: z.string()}) satisfies z.ZodType<Sealed>;

// ids are joined into the AAD with '|' and name the lock's public key: only UUIDs (crypto.randomUUID()), so no id can
// read as another
const lockRecord = z.looseObject({id: z.uuid(), type: z.string(), sealed});

// the key derivation is checked by passwordKek(): a newer one (say, Argon2id) is still a password lock
const passwordLock = lockRecord.extend({
    type: z.literal('password'),
    kdf: z.looseObject({name: z.string(), salt: z.string()}),
    privateKey: encrypted,
});

const pbkdf2Kdf = z.object({
    name: z.literal('PBKDF2-SHA256'),
    iterations: z.int().max(MAX_PASSWORD_ITERATIONS),
    salt: z.base64(),
});

const passkeyFields = z.object({
    credentialId: z.string(),
    prfSalt: z.string(),
    name: z.string(),
    aaguid: z.string().nullable(),
    backupEligible: z.boolean(),
    transports: z.array(z.string()),
    createdAt: z.string(),
});

const passkeyLock = lockRecord.extend({type: z.literal('passkey'), ...passkeyFields.shape, privateKey: encrypted});

const locks = z.object({
    v: z.literal(1),
    userHandle: z.string(),
    locks: z.array(lockRecord).refine((all) => new Set(all.map((lock) => lock.id)).size === all.length),
});

/** Fields every lock has, whatever its type: rotation re-seals locks it doesn't otherwise understand. */
export type LockRecord = z.infer<typeof lockRecord>;

export type PasswordLock = z.infer<typeof passwordLock>;

export type PasskeyLock = z.infer<typeof passkeyLock>;

/** What describes a passkey lock, besides its keys. */
export type PasskeyFields = z.infer<typeof passkeyFields>;

/** Stored in the KDBX header. userHandle is the WebAuthn user.id passkeys are created under. */
export type Locks = z.infer<typeof locks>;

/** The only password key derivation this version knows. */
export type Pbkdf2Kdf = z.infer<typeof pbkdf2Kdf>;

/** A new password lock's KEK, derived before the vault is touched: PBKDF2 is the slow step. */
export type PasswordKek = { kek: CryptoKey, kdf: Pbkdf2Kdf };

/** What createLock() is given: a lock without its keys. */
type NewPasswordLock = { type: 'password', kdf: Pbkdf2Kdf };

type NewPasskeyLock = { type: 'passkey' } & PasskeyFields;

export const isPasswordLock = (lock: LockRecord): lock is PasswordLock => passwordLock.safeParse(lock).success;

export const isPasskeyLock = (lock: LockRecord): lock is PasskeyLock => passkeyLock.safeParse(lock).success;

/** Unknown lock types are kept as they are: a newer version may have added them. */
export const parseLocks = (json: string): Locks => {
    try {
        return locks.parse(JSON.parse(json));
    } catch {
        throw new Error(UNSUPPORTED_VAULT_ERROR);
    }
}

// Keys

export const generateDataKey = (): Bytes => randomBytes(DATA_KEY_LENGTH);

/**
 * The KEK of an existing password lock. Throws UNSUPPORTED_VAULT_ERROR on a key derivation this version doesn't know.
 * minIterations: the production floor, never taken from the lock itself.
 */
export const passwordKek = async (
    password: string,
    kdf: PasswordLock['kdf'],
    minIterations = MIN_PASSWORD_ITERATIONS
): Promise<CryptoKey> => {
    const known = pbkdf2Kdf.safeParse(kdf);

    if (!known.success || known.data.iterations < minIterations) {
        throw new Error(UNSUPPORTED_VAULT_ERROR);
    }

    return pbkdf2(password, base64ToBytes(known.data.salt), known.data.iterations);
}

/** The KEK of a new password lock, with a fresh salt. */
export const newPasswordKek = async (password: string, iterations = PASSWORD_ITERATIONS): Promise<PasswordKek> => {
    const salt = randomBytes(16);

    return {
        kek: await pbkdf2(password, salt, iterations),
        kdf: {name: 'PBKDF2-SHA256', iterations, salt: bytesToBase64(salt)},
    };
}

export const passkeyKek = async (prfOutput: Bytes): Promise<CryptoKey> => {
    if (prfOutput.length !== PRF_OUTPUT_LENGTH) {
        throw new Error(INVALID_KEY_ERROR);
    }

    return hkdf(prfOutput, new Uint8Array(0), PASSKEY_KEK_INFO);
}

// Locks. The AAD binds a private key to its lock (and credential), and a seal to its lock.

const keyAad = (lock: { id: string, type: string, credentialId?: unknown }) => utf8([
    AAD_PREFIX, 'key', lock.id, lock.type, typeof lock.credentialId === 'string' ? lock.credentialId : '',
].join('|'));

const sealAad = (lockId: string) => utf8([AAD_PREFIX, 'seal', lockId].join('|'));

/**
 * A new lock: a fresh key pair whose private key is encrypted under kek, with dataKey sealed to it.
 * Returns the lock and its public key, which belongs in the encrypted KDBX (see kdbx.ts).
 */
export function createLock(
    fields: NewPasswordLock, kek: CryptoKey, dataKey: Bytes
): Promise<{ lock: PasswordLock, publicKey: string }>;
export function createLock(
    fields: NewPasskeyLock, kek: CryptoKey, dataKey: Bytes
): Promise<{ lock: PasskeyLock, publicKey: string }>;
export async function createLock(
    fields: NewPasswordLock | NewPasskeyLock, kek: CryptoKey, dataKey: Bytes
): Promise<{ lock: PasswordLock | PasskeyLock, publicKey: string }> {
    const id = crypto.randomUUID();
    const pair = await generateKeyPair();

    try {
        const publicKey = bytesToBase64(pair.publicKey);
        const privateKey = await encrypt(kek, pair.privateKey, keyAad({...fields, id}));

        return {lock: {...fields, id, privateKey, sealed: await sealDataKey(dataKey, publicKey, id)}, publicKey};
    } finally {
        pair.privateKey.fill(0);
    }
}

/**
 * The data key from a lock, given its KEK. Throws INVALID_KEY_ERROR on a wrong password or passkey, and
 * DAMAGED_LOCK_ERROR when the lock doesn't give a data key even though the KEK was right.
 */
export const openLock = async (lock: PasswordLock | PasskeyLock, kek: CryptoKey): Promise<Bytes> => {
    // the only step the password or passkey decides: whatever fails after it is the lock's fault
    const privateKey = await decrypt(kek, lock.privateKey, keyAad(lock));

    const dataKey = await unseal(lock.sealed, privateKey, sealAad(lock.id))
        .catch(() => null)
        .finally(() => privateKey.fill(0));

    if (dataKey?.length !== DATA_KEY_LENGTH) {
        dataKey?.fill(0);
        throw new Error(DAMAGED_LOCK_ERROR);
    }

    return dataKey;
}

/**
 * Seals dataKey to a lock's public key (base64 raw X25519), any lock type. Needs no secret.
 * Throws DAMAGED_LOCK_ERROR on a public key that can't be sealed to.
 */
export const sealDataKey = async (dataKey: Bytes, publicKey: string, lockId: string): Promise<Sealed> => {
    try {
        return await seal(dataKey, base64ToBytes(publicKey), sealAad(lockId));
    } catch {
        throw new Error(DAMAGED_LOCK_ERROR);
    }
}
