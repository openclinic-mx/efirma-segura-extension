import {expect, test} from 'vitest'
import {
    createLock,
    generateDataKey,
    isPasskeyLock,
    isPasswordLock,
    newPasswordKek,
    openLock,
    parseLocks,
    PasskeyLock,
    passkeyKek,
    PasswordLock,
    passwordKek,
    sealDataKey,
} from './locks'
import {INVALID_KEY_ERROR, UNSUPPORTED_VAULT_ERROR} from './errors'
import {base64ToBytes, randomBytes} from "@/utils/encoding";

const iterations = 1000

const passwordLock = async (password = 'test', dataKey = generateDataKey()) => {
    const {kek, kdf} = await newPasswordKek(password, iterations)
    const {lock, publicKey} = await createLock<PasswordLock>({type: 'password', kdf}, kek, dataKey)
    return {lock, publicKey, dataKey}
}

const passkeyLock = async (prfOutput = randomBytes(32), dataKey = generateDataKey()) => {
    const {lock, publicKey} = await createLock<PasskeyLock>({
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

    await expect(openPassword({...one.lock, sealed: other.lock.sealed}, 'test')).rejects.toThrow(INVALID_KEY_ERROR)
})

test('parsing keeps lock types this version does not know', () => {
    const unknown = {id: 'x', type: 'hardware-key', sealed: {epk: 'a', iv: 'b', ct: 'c'}, extra: 1}

    expect(parseLocks(JSON.stringify({v: 1, userHandle: 'h', locks: [unknown]})).locks).toEqual([unknown])
})

test('a newer locks format asks to update', () => {
    expect(() => parseLocks(JSON.stringify({v: 2, userHandle: 'h', locks: []}))).toThrow(UNSUPPORTED_VAULT_ERROR)
    expect(() => parseLocks('not json')).toThrow(UNSUPPORTED_VAULT_ERROR)
})

/** Locks written by the first release of this format: any change to the derivations, AAD or layout breaks them. */
const written = {
    "dataKey": "GDd5u5MAkN+jtNcbTGpLucD7rE63q7Ipjyl+9v1ed7c=",
    "password": "correct horse",
    "prfOutput": "xQ6l9JrfsOGCGUSh3aEeQCllng7D+ewkZnzwAU4kdvI=",
    "passwordLock": {
        "type": "password",
        "kdf": {
            "name": "PBKDF2-SHA256",
            "iterations": 1000,
            "salt": "6fB34iLn4viGMeLlo6JP8Q=="
        },
        "id": "9ba7ac35-0963-4148-a9e1-31a7235b85e2",
        "privateKey": {
            "iv": "tupj19bwvx9i2xns",
            "ct": "gmkov2BzSsAz/NSbF0hjEGOwfxjcpIrHr4MN9WukIlvJ8IjEM5CBGEogIyZ/D/4EnS3Ad1P/riqOFxwx0enSm4CpRlU6AYgLmEriYdGbIUgUmH4n552aDAw7ZXxYcXZIf6IUtiXNRkAB6aTVlAm+bPaMvRhZnhaCm7R/2gSicZ0l1NwDdefjfSZu4brH/4+tDWDEm2fmU3WtU3nPFNCHez/Ybh2YTaVLiCVMr+PS0GcK9ndh"
        },
        "sealed": {
            "epk": "GgBgebQkKkasDuva4TS6Fn65scfIkVUQ62uAHYjUnzE=",
            "iv": "RhhSSZ3XIRLHSzOT",
            "ct": "dbAgTvlErlRGicrPiVQOApRXVIq+Sa80NKkaTzY7h5aYs2+okPf+MNkFuD++C6Xy"
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
        "id": "0f20c259-ca46-4be8-be7e-643f9f2d24b5",
        "privateKey": {
            "iv": "frtGy7hQQC3NgbQm",
            "ct": "Y55uPegmRNJ06FcaiZtzhZmFHiaUvK/MTJ1tzExPj6/O1dFUqxh4myEZL4ZnJ8jd2yF91R+4SXMOdBfNQz7PN3W3ypqEDHKV1vTekLmz3ibDe9HDJlepTJiw82zCOOVwTOp9oOQZv5DsdYsDyXgAEBItfuzRiLJbCjnpUSshZiwCpoPis4sQFatImpYIC9UUX87ZDFI6AFrcoReXlNNqx+1DVgoD+nXjLx3Edg5Wjmhjzl4l"
        },
        "sealed": {
            "epk": "vKcUF5tvPQ3Nmjd5Zr5AStERaW7Tysi/buuL6F1IEiY=",
            "iv": "JgcmNluLj3FWiGYg",
            "ct": "Fl0Z6YAHzoBqvtB4kJAuKrgs/9XQWf+XOPpsK+hT8CpG+VGb/VfbRiDNSzvWS4VU"
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
