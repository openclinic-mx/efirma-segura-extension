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

import {base64ToBytes, bytesToBase64, randomBytes} from "@/utils/encoding";
import {decrypt, encrypt, Encrypted, generateKeyPair, hkdf, pbkdf2, seal, Sealed, unseal, utf8} from "./crypto";
import {INVALID_KEY_ERROR, UNSUPPORTED_VAULT_ERROR} from "./errors";

export const PASSWORD_ITERATIONS = 600_000;

// Iterations come from synced data: bound them so a malformed lock can neither hang the background
// worker nor weaken the KEK. Only tests lower the floor (VaultOptions.passwordIterations).
export const MIN_PASSWORD_ITERATIONS = 100_000;

const MAX_PASSWORD_ITERATIONS = 10_000_000;

const DATA_KEY_LENGTH = 32;

const PRF_OUTPUT_LENGTH = 32;

const PASSKEY_KEK_INFO = 'efirma-segura/passkey-kek/v2';

const AAD_PREFIX = 'efirma-segura/lock/v1';

/** Fields every lock has, whatever its type: rotation re-seals locks it doesn't otherwise understand. */
export type LockRecord = { id: string, type: string, sealed: Sealed, [field: string]: unknown };

export type PasswordLock = LockRecord & {
    type: 'password',
    kdf: { name: 'PBKDF2-SHA256', iterations: number, salt: string },
    privateKey: Encrypted,
};

export type PasskeyLock = LockRecord & {
    type: 'passkey',
    credentialId: string,
    prfSalt: string,
    name: string,
    aaguid: string | null,
    backupEligible: boolean,
    transports: string[],
    createdAt: string,
    privateKey: Encrypted,
};

export type PasskeyFields = Omit<PasskeyLock, 'id' | 'type' | 'sealed' | 'privateKey'>;

/** Stored in the KDBX header. userHandle is the WebAuthn user.id passkeys are created under. */
export type Locks = { v: 1, userHandle: string, locks: LockRecord[] };

/** A new password lock's KEK, derived before the vault is touched: PBKDF2 is the slow step. */
export type PasswordKek = { kek: CryptoKey, kdf: PasswordLock['kdf'] };

// Reading: the locks come from synced data, so every field is checked before anything uses it.

/** value is an object, and each of keys is a string in it. */
const hasStrings = (value: unknown, ...keys: string[]): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null
        && keys.every((key) => typeof (value as Record<string, unknown>)[key] === 'string');
}

export const isPasswordLock = (lock: LockRecord): lock is PasswordLock => lock.type === 'password'
    && hasStrings(lock.kdf) && hasStrings(lock.privateKey, 'iv', 'ct');

export const isPasskeyLock = (lock: LockRecord): lock is PasskeyLock => lock.type === 'passkey'
    && hasStrings(lock, 'credentialId', 'prfSalt') && hasStrings(lock.privateKey, 'iv', 'ct');

/** Unknown lock types are kept as they are: a newer version may have added them. */
export const parseLocks = (json: string): Locks => {
    let value: unknown;

    try {
        value = JSON.parse(json);
    } catch {
        throw new Error(UNSUPPORTED_VAULT_ERROR);
    }

    if (!hasStrings(value, 'userHandle') || value.v !== 1 || !Array.isArray(value.locks)
        || !value.locks.every((lock) => hasStrings(lock, 'id', 'type') && hasStrings(lock.sealed, 'epk', 'iv', 'ct'))) {
        throw new Error(UNSUPPORTED_VAULT_ERROR);
    }

    return {v: 1, userHandle: value.userHandle as string, locks: value.locks as LockRecord[]};
}

// Keys

export const generateDataKey = (): Uint8Array<ArrayBuffer> => randomBytes(DATA_KEY_LENGTH);

/** The KEK of an existing password lock. minIterations: the production floor, never taken from the lock itself. */
export const passwordKek = async (
    password: string,
    kdf: PasswordLock['kdf'],
    minIterations = MIN_PASSWORD_ITERATIONS
): Promise<CryptoKey> => {
    const {name, iterations} = kdf;

    if (name !== 'PBKDF2-SHA256' || !Number.isInteger(iterations)
        || iterations < minIterations || iterations > MAX_PASSWORD_ITERATIONS) {
        throw new Error(UNSUPPORTED_VAULT_ERROR);
    }

    return pbkdf2(password, base64ToBytes(kdf.salt), iterations);
}

/** The KEK of a new password lock, with a fresh salt. */
export const newPasswordKek = async (password: string, iterations = PASSWORD_ITERATIONS): Promise<PasswordKek> => {
    const kdf = {name: 'PBKDF2-SHA256' as const, iterations, salt: bytesToBase64(randomBytes(16))};

    return {kek: await passwordKek(password, kdf, Math.min(iterations, MIN_PASSWORD_ITERATIONS)), kdf};
}

export const passkeyKek = async (prfOutput: Uint8Array<ArrayBuffer>): Promise<CryptoKey> => {
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
export const createLock = async <T extends PasswordLock | PasskeyLock>(
    fields: Omit<T, 'id' | 'sealed' | 'privateKey'>,
    kek: CryptoKey,
    dataKey: Uint8Array<ArrayBuffer>,
): Promise<{ lock: T, publicKey: string }> => {
    const id = crypto.randomUUID();
    const pair = await generateKeyPair();
    const publicKey = bytesToBase64(pair.publicKey);

    const privateKey = await encrypt(kek, pair.privateKey, keyAad({...fields as unknown as { type: string }, id}));
    pair.privateKey.fill(0);

    const lock = {...fields, id, privateKey, sealed: await sealDataKey(dataKey, publicKey, id)} as unknown as T;

    return {lock, publicKey};
}

/** The data key from a lock, given its KEK. Throws INVALID_KEY_ERROR on a wrong password or passkey. */
export const openLock = async (lock: PasswordLock | PasskeyLock, kek: CryptoKey): Promise<Uint8Array<ArrayBuffer>> => {
    const privateKey = await decrypt(kek, lock.privateKey, keyAad(lock));

    try {
        const dataKey = await unseal(lock.sealed, privateKey, sealAad(lock.id));

        if (dataKey.length !== DATA_KEY_LENGTH) {
            dataKey.fill(0);
            throw new Error(INVALID_KEY_ERROR);
        }

        return dataKey;
    } finally {
        privateKey.fill(0);
    }
}

/** Seals dataKey to a lock's public key (base64 raw X25519), any lock type. Needs no secret. */
export const sealDataKey = (dataKey: Uint8Array<ArrayBuffer>, publicKey: string, lockId: string): Promise<Sealed> => {
    return seal(dataKey, base64ToBytes(publicKey), sealAad(lockId));
}
