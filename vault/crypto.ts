// The WebCrypto building blocks of locks.ts: AES-GCM boxes, key derivation and X25519 sealing. Nothing here knows
// what a lock is.

import {base64ToBytes, base64UrlToBytes, bytesToBase64, randomBytes} from "@/utils/encoding";
import {INVALID_KEY_ERROR} from "./errors";

/** AES-256-GCM ciphertext, base64. */
export type Encrypted = { iv: string, ct: string };

/** Encrypted to an X25519 public key. epk: the ephemeral public key. */
export type Sealed = Encrypted & { epk: string };

type Bytes = Uint8Array<ArrayBuffer>;

const SEAL_INFO = 'efirma-segura/seal/v1';

const AES_KEY = {name: 'AES-GCM', length: 256} as const;

export const utf8 = (text: string) => new TextEncoder().encode(text);

export const encrypt = async (key: CryptoKey, plaintext: Bytes, additionalData: Bytes): Promise<Encrypted> => {
    const iv = randomBytes(12);
    const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData}, key, plaintext);

    return {iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct))};
}

/** Throws INVALID_KEY_ERROR on a wrong key (wrong password or PRF output) or tampered data. */
export const decrypt = async (key: CryptoKey, box: Encrypted, additionalData: Bytes): Promise<Bytes> => {
    try {
        const iv = base64ToBytes(box.iv);
        return new Uint8Array(await crypto.subtle.decrypt({name: 'AES-GCM', iv, additionalData}, key, base64ToBytes(box.ct)));
    } catch {
        throw new Error(INVALID_KEY_ERROR);
    }
}

/** An AES-GCM key from a high-entropy secret. */
export const hkdf = async (secret: Bytes, salt: Bytes, info: string): Promise<CryptoKey> => {
    const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);

    return crypto.subtle.deriveKey(
        {name: 'HKDF', hash: 'SHA-256', salt, info: utf8(info)}, material, AES_KEY, false, ['encrypt', 'decrypt']
    );
}

/** An AES-GCM key from a password. */
export const pbkdf2 = async (password: string, salt: Bytes, iterations: number): Promise<CryptoKey> => {
    const material = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey']);

    return crypto.subtle.deriveKey(
        {name: 'PBKDF2', hash: 'SHA-256', salt, iterations}, material, AES_KEY, false, ['encrypt', 'decrypt']
    );
}

/** A new X25519 key pair: the raw public key, and the private key as JWK bytes (with x: unsealing needs it). */
export const generateKeyPair = async (): Promise<{ publicKey: Bytes, privateKey: Bytes }> => {
    const pair = await crypto.subtle.generateKey({name: 'X25519'}, true, ['deriveBits']) as CryptoKeyPair;
    const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
    const privateKey = utf8(JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)));

    return {publicKey, privateKey};
}

/** Encrypts plaintext to an X25519 public key, like age's X25519 stanzas. Needs no secret. */
export const seal = async (plaintext: Bytes, recipient: Bytes, additionalData: Bytes): Promise<Sealed> => {
    const ephemeral = await crypto.subtle.generateKey({name: 'X25519'}, true, ['deriveBits']) as CryptoKeyPair;
    const epk = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));

    const key = await sharedKey(ephemeral.privateKey, recipient, epk, recipient);

    return {epk: bytesToBase64(epk), ...await encrypt(key, plaintext, additionalData)};
}

/** Opens what seal() encrypted to the public key of privateKey (JWK bytes, as generateKeyPair() returns it). */
export const unseal = async (sealed: Sealed, privateKey: Bytes, additionalData: Bytes): Promise<Bytes> => {
    const jwk: JsonWebKey = JSON.parse(new TextDecoder().decode(privateKey));

    if (jwk.crv !== 'X25519' || typeof jwk.x !== 'string') {
        throw new Error(INVALID_KEY_ERROR);
    }

    const key = await crypto.subtle.importKey('jwk', jwk, {name: 'X25519'}, false, ['deriveBits']);
    const epk = base64ToBytes(sealed.epk);

    return decrypt(await sharedKey(key, epk, epk, base64UrlToBytes(jwk.x)), sealed, additionalData);
}

/** ECDH, then HKDF over both public keys: a crafted ephemeral key can't reuse another recipient's seal. */
const sharedKey = async (privateKey: CryptoKey, peer: Bytes, epk: Bytes, recipient: Bytes) => {
    const peerKey = await crypto.subtle.importKey('raw', peer, {name: 'X25519'}, true, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({name: 'X25519', public: peerKey}, privateKey, 256));

    // a small-order peer key gives an all-zero secret anyone can predict (age rejects it too)
    if (shared.every((byte) => byte === 0)) {
        throw new Error(INVALID_KEY_ERROR);
    }

    const salt = new Uint8Array(epk.length + recipient.length);
    salt.set(epk);
    salt.set(recipient, epk.length);

    try {
        return await hkdf(shared, salt, SEAL_INFO);
    } finally {
        shared.fill(0);
    }
}
