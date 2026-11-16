import {expect, test} from 'vitest'
import {
    createLock,
    generateDataKey,
    isPasskeyLock,
    isPasswordLock,
    LockRecord,
    newPasswordKek,
    openLock,
    parseLocks,
    PasskeyLock,
    passkeyKek,
    PasswordLock,
    passwordKek,
    sealDataKey,
} from './locks'
import {DAMAGED_LOCK_ERROR, INVALID_KEY_ERROR, UNSUPPORTED_VAULT_ERROR} from './errors'
import {generateKeyPair, seal, unseal, utf8} from './crypto'
import {base64ToBytes, bytesToBase64, randomBytes} from "@/utils/encoding";

const iterations = 1000

const passwordLock = async (password = 'test', dataKey = generateDataKey()) => {
    const {kek, kdf} = await newPasswordKek(password, iterations)
    const {lock, publicKey} = await createLock({type: 'password', kdf}, kek, dataKey)
    return {lock, publicKey, dataKey}
}

const passkeyLock = async (prfOutput = randomBytes(32), dataKey = generateDataKey()) => {
    const {lock, publicKey} = await createLock({
        type: 'passkey',
        credentialId: 'credential',
        prfSalt: 'salt',
        name: 'Llave',
        aaguid: null,
        backupEligible: true,
        transports: [],
        createdAt: new Date().toISOString(),
    }, await passkeyKek(prfOutput), dataKey)
    return {lock, publicKey, dataKey, prfOutput}
}

const openPassword = async (lock: PasswordLock, password: string) => {
    return openLock(lock, await passwordKek(password, lock.kdf, iterations))
}

test('a password lock opens the data key', async () => {
    const {lock, dataKey} = await passwordLock()

    expect(await openPassword(lock, 'test')).toEqual(dataKey)
})

test('a wrong password fails with the error the UI maps', async () => {
    const {lock} = await passwordLock()

    await expect(openPassword(lock, 'test1')).rejects.toThrow(INVALID_KEY_ERROR)
})

test('password iterations from synced data are bounded', async () => {
    const {lock} = await passwordLock()

    await expect(passwordKek('test', {...lock.kdf, iterations: 1}, iterations)).rejects.toThrow(UNSUPPORTED_VAULT_ERROR)
    await expect(passwordKek('test', {...lock.kdf, iterations: 1e9}, iterations)).rejects.toThrow(UNSUPPORTED_VAULT_ERROR)
})

test('a key derivation this version does not know asks to update, never "wrong password"', async () => {
    const {lock} = await passwordLock()

    await expect(passwordKek('test', {...lock.kdf, name: 'Argon2id'} as never, iterations))
        .rejects.toThrow(UNSUPPORTED_VAULT_ERROR)
})

test('a passkey lock opens the data key with the PRF output', async () => {
    const {lock, dataKey, prfOutput} = await passkeyLock()

    expect(await openLock(lock, await passkeyKek(prfOutput))).toEqual(dataKey)
    await expect(openLock(lock, await passkeyKek(randomBytes(32)))).rejects.toThrow(INVALID_KEY_ERROR)
})

test('a passkey lock is bound to its credential', async () => {
    const {lock, prfOutput} = await passkeyLock()

    await expect(openLock({...lock, credentialId: 'other'}, await passkeyKek(prfOutput))).rejects.toThrow(INVALID_KEY_ERROR)
})

test('sealing a new data key to a public key needs no secret, and the lock opens it', async () => {
    const {lock, publicKey} = await passwordLock()
    const rotated = generateDataKey()

    const resealed = {...lock, sealed: await sealDataKey(rotated, publicKey, lock.id)}

    expect(await openPassword(resealed, 'test')).toEqual(rotated)
})

test('a seal only opens for the lock it was made for', async () => {
    const one = await passwordLock()
    const other = await passwordLock('test', one.dataKey)

    await expect(openPassword({...one.lock, sealed: other.lock.sealed}, 'test')).rejects.toThrow(DAMAGED_LOCK_ERROR)
})

test('parsing keeps lock types this version does not know', () => {
    const unknown = {id: crypto.randomUUID(), type: 'hardware-key', sealed: {epk: 'a', iv: 'b', ct: 'c'}, extra: 1}

    expect(parseLocks(JSON.stringify({v: 1, userHandle: 'h', locks: [unknown]})).locks).toEqual([unknown])
})

test('a newer locks format asks to update', () => {
    expect(() => parseLocks(JSON.stringify({v: 2, userHandle: 'h', locks: []}))).toThrow(UNSUPPORTED_VAULT_ERROR)
    expect(() => parseLocks('not json')).toThrow(UNSUPPORTED_VAULT_ERROR)
})

/**
 * Locks in the format this version writes (private keys: raw public key + PKCS #8): any change to the derivations, AAD
 * or layout breaks them. Once a release has written this format, never regenerate them: a change that would need it
 * is a new format, and this one still has to open.
 */
const written = {
    "dataKey": "Fg/3mQ5hWuiryKkDdht68PV7O5mFBmYoBCf47Z16ejA=",
    "password": "correct horse",
    "prfOutput": "CN9Rf/NpyCUNrnGoNm2zmHOs+q2xl25UvCfe9wV0stc=",
    "passwordLock": {
        "type": "password",
        "kdf": {
            "name": "PBKDF2-SHA256",
            "iterations": 1000,
            "salt": "ioWIyLXFgorxkCDLPaoxYQ=="
        },
        "id": "806a33e7-1a65-427b-b4ef-8c6a06a523e0",
        "privateKey": {
            "iv": "AeDLSHpCGh4QmIG1",
            "ct": "Jpaoto4znaLpmXE8tZFdPAgwXS31VvuBvuouv3ia4KVQHJYygbbWq1zsqtiUYazQEAUgV6w3Ki0otEAjdg3ps/LvjhGTSkW16895SBPWjiRgpK1O8ud3uRfOnpChi9fF"
        },
        "sealed": {
            "epk": "kC1l0WZ2DYOuUdZqDOpxvdBkCUtRRrwuRHsOy8b0Ix4=",
            "iv": "BzKcMSyqTEjoM1nV",
            "ct": "Pn82LwU06ovI4EHxor1wfAuPaSTpy3nCrpmL01dwvetSlrlqeVzUeIKUaFKGbUOo"
        }
    },
    "passkeyLock": {
        "type": "passkey",
        "credentialId": "Y3JlZGVudGlhbA",
        "prfSalt": "c2FsdA",
        "name": "Llave",
        "aaguid": null,
        "backupEligible": true,
        "transports": [
            "internal"
        ],
        "createdAt": "2026-11-16T00:00:00.000Z",
        "id": "de18facd-6445-4497-8498-80e65096de05",
        "privateKey": {
            "iv": "8qqPI00kHmxc5DZw",
            "ct": "U/Mk9b12OmCivGJK8uAEqilSq3gtLeZ0B5201odzsTPZRLswl5j7cxEIVvS+OMgiI52wVltERJmoWTj3kXXwSIoWNtGxCMkZbinI8zTxsL5wChahNSixPyHqLUIZ8EIT"
        },
        "sealed": {
            "epk": "C0ojSkReX/x6DjvvyViLC9cLwlwnOlH/AOopjFFXvzA=",
            "iv": "KWGZqMQQOL4z0Fuf",
            "ct": "UKW8JHaOW1k+1WwMrYdv/R2vy6qaMehFAZfwBN608adgmcG+WFVsKfclYQN70OMG"
        }
    }
} as const

test('opens locks written by earlier builds', async () => {
    const dataKey = base64ToBytes(written.dataKey)
    const password = written.passwordLock as unknown as PasswordLock
    const passkey = written.passkeyLock as unknown as PasskeyLock

    expect(await openPassword(password, written.password)).toEqual(dataKey)
    expect(await openLock(passkey, await passkeyKek(base64ToBytes(written.prfOutput)))).toEqual(dataKey)
})

test('reads locks written by earlier builds as the types they are', () => {
    const {locks} = parseLocks(JSON.stringify({v: 1, userHandle: 'h', locks: [written.passwordLock, written.passkeyLock]}))

    expect(locks.filter(isPasswordLock)).toEqual([written.passwordLock])
    expect(locks.filter(isPasskeyLock)).toEqual([written.passkeyLock])
})

test('malformed locks from synced data are refused before any crypto', () => {
    const parse = (lock: unknown) => parseLocks(JSON.stringify({v: 1, userHandle: 'h', locks: [lock]}))
    const {sealed} = written.passwordLock

    expect(() => parse({...written.passwordLock, sealed: {iv: sealed.iv, ct: sealed.ct}})).toThrow(UNSUPPORTED_VAULT_ERROR)
    expect(() => parse({...written.passwordLock, id: 1})).toThrow(UNSUPPORTED_VAULT_ERROR)
    expect(() => parse({...written.passwordLock, type: undefined})).toThrow(UNSUPPORTED_VAULT_ERROR)
    expect(() => parse(null)).toThrow(UNSUPPORTED_VAULT_ERROR)
    expect(() => parseLocks(JSON.stringify({v: 1, userHandle: 1, locks: []}))).toThrow(UNSUPPORTED_VAULT_ERROR)
})

test('a known lock type with missing fields is not usable as that type', () => {
    const {privateKey, ...password} = written.passwordLock
    const {credentialId, ...passkey} = written.passkeyLock
    void privateKey, void credentialId

    const locks = parseLocks(JSON.stringify({v: 1, userHandle: 'h', locks: [password, passkey]})).locks

    expect(locks.filter(isPasswordLock)).toEqual([])
    expect(locks.filter(isPasskeyLock)).toEqual([])
})

test('a lock id that is not a UUID is refused: ids are joined into the AAD', () => {
    const parse = (id: string) => parseLocks(JSON.stringify({v: 1, userHandle: 'h', locks: [{...written.passwordLock, id}]}))

    expect(() => parse(`${written.passwordLock.id}|seal`)).toThrow(UNSUPPORTED_VAULT_ERROR)
    expect(() => parse('x')).toThrow(UNSUPPORTED_VAULT_ERROR)
})

test('a password lock without a salt is not usable, and a malformed salt asks to update', async () => {
    const {salt, ...kdf} = written.passwordLock.kdf
    void salt

    expect(isPasswordLock({...written.passwordLock, kdf} as unknown as LockRecord)).toBe(false)
    await expect(passwordKek('test', {...written.passwordLock.kdf, salt: '%%'}, iterations))
        .rejects.toThrow(UNSUPPORTED_VAULT_ERROR)
})

test('a malformed seal from synced data reads as a damaged lock, never as a wrong password or another error', async () => {
    const lock = written.passwordLock as unknown as PasswordLock

    for (const epk of ['%%', bytesToBase64(new Uint8Array(31)), bytesToBase64(new Uint8Array(32))]) {
        await expect(openPassword({...lock, sealed: {...lock.sealed, epk}}, written.password))
            .rejects.toThrow(DAMAGED_LOCK_ERROR)
    }
})

test('a passkey lock with a mistyped field is not usable as a passkey lock', () => {
    const not = (fields: object) => isPasskeyLock({...written.passkeyLock, ...fields} as unknown as LockRecord)

    expect(isPasskeyLock(written.passkeyLock as unknown as LockRecord)).toBe(true)
    expect(not({transports: 'usb'})).toBe(false)
    expect(not({transports: [1]})).toBe(false)
    expect(not({name: 42})).toBe(false)
    expect(not({aaguid: undefined})).toBe(false)
    expect(not({backupEligible: 'yes'})).toBe(false)
    expect(not({createdAt: null})).toBe(false)
    expect(not({privateKey: {iv: 'a'}})).toBe(false)
})

test('a password lock with a newer key derivation is still the password lock, and asks to update', async () => {
    const newer = {...written.passwordLock, kdf: {name: 'Argon2id', salt: 'AAAA', memory: 65536, passes: 3}}
    const {iterations: omitted, ...withoutIterations} = written.passwordLock.kdf
    void omitted

    // changing the password replaces whatever isPasswordLock() says is the password lock
    expect(isPasswordLock(newer as unknown as LockRecord)).toBe(true)
    await expect(passwordKek('test', newer.kdf, iterations)).rejects.toThrow(UNSUPPORTED_VAULT_ERROR)
    await expect(passwordKek('test', withoutIterations, iterations)).rejects.toThrow(UNSUPPORTED_VAULT_ERROR)
})

test('two locks with the same id are refused: the id names the lock\'s public key', () => {
    const twice = [written.passwordLock, {...written.passkeyLock, id: written.passwordLock.id}]

    expect(() => parseLocks(JSON.stringify({v: 1, userHandle: 'h', locks: twice}))).toThrow(UNSUPPORTED_VAULT_ERROR)
})

test('sealing to a public key that is not one reads as a damaged lock', async () => {
    const id = crypto.randomUUID()

    for (const publicKey of ['%%', bytesToBase64(new Uint8Array(31)), bytesToBase64(new Uint8Array(32))]) {
        await expect(sealDataKey(generateDataKey(), publicKey, id)).rejects.toThrow(DAMAGED_LOCK_ERROR)
    }
})

test('a private key that is cut short or is not one does not unseal', async () => {
    const pair = await generateKeyPair()
    const aad = utf8('test')
    const sealed = await seal(generateDataKey(), pair.publicKey, aad)

    expect(await unseal(sealed, pair.privateKey, aad)).toHaveLength(32)
    await expect(unseal(sealed, pair.privateKey.slice(0, 40), aad)).rejects.toThrow()
    await expect(unseal(sealed, pair.privateKey.slice(0, 16), aad)).rejects.toThrow()
    await expect(unseal(sealed, randomBytes(pair.privateKey.length), aad)).rejects.toThrow()
})
