import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {Consts, Credentials, Kdbx, ProtectedValue, VarDictionary} from 'kdbxweb';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {Entries} from './entries'
import {Vault} from './vault'
import {PasskeyLocks} from './passkeyLocks'
import {StorageService} from '@/services/storage'
import {
    createLock,
    isPasskeyLock,
    LockRecord,
    newPasswordKek,
    openLock,
    passkeyKek,
} from './locks'
import {INVALID_KEY_ERROR, LOCKED_ERROR, SESSION_INVALIDATED_ERROR, UNSUPPORTED_VAULT_ERROR} from './errors'
import {dataKeyCredentials, lockKeysOf, locksOf, readLocks, writeLocks} from './kdbx'
import {base64ToBytes, bytesToBase64, bytesToBase64Url, randomBytes} from "@/utils/encoding";
import {readBase64AsBytes, readBufferAsBase64} from "@/utils/files";
import {ENROLLMENT_EXPIRED_ERROR, ENROLLMENT_TTL, UNKNOWN_PASSKEY_ERROR} from "@/utils/passkeys";

const storageService = new StorageService();

/** The vault as the background wires it: the lock, the e.firmas stored behind it and the passkey locks. */
const setup = () => {
    const vault = new Vault(storageService, {passwordIterations: 1000});

    return {vault, entries: new Entries(vault), passkeys: new PasskeyLocks(vault, storageService)};
}

/** A vault as versions before passkeys write it: a KDBX keyed with the master password. */
const legacyVault = async (password = 'test', entries = 0) => {
    const db = Kdbx.create(new Credentials(ProtectedValue.fromString(password)), 'e.firma Segura');
    db.setVersion(4);
    db.setKdf(Consts.KdfId.Aes);

    for (let i = 0; i < entries; i++) {
        db.createEntry(db.getDefaultGroup()).fields.set('Title', 'e.firma');
    }

    return readBufferAsBase64(await db.save());
}

const raw = async () => {
    const value = await storageService.read<string>('kdbxDatabase')
    expect.assert(value, 'no vault stored')
    return value
}

/** Opens the stored vault the way versions before passkeys (and KeePass) do: with the password alone. */
const openWithPassword = async (base64: string, password = 'test') => {
    return Kdbx.load(readBase64AsBytes(base64).buffer, new Credentials(ProtectedValue.fromString(password)))
}

const addEntry = (entries: Entries) => entries.add(async (entry) => {
    entry.fields.set('Title', 'e.firma');
    return entry;
})

/** Simulates what the side panel does with a real authenticator: same PRF output on every get(). */
const enrollPasskey = async (passkeys: PasskeyLocks, password = 'test') => {
    const enrollment = await passkeys.beginEnrollment(password)
    const credentialId = bytesToBase64Url(randomBytes(16))
    const prfOutput = bytesToBase64(randomBytes(32))

    const passkey = await passkeys.finishEnrollment({
        token: enrollment.token,
        credentialId,
        prfOutput,
        aaguid: 'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4',
        backupEligible: true,
        transports: ['internal', 'hybrid'],
        name: 'Gestor de contraseñas de Google',
    })

    return {passkey, credentialId, prfOutput, enrollment}
}

beforeEach(() => {
    fakeBrowser.reset();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

/** Runs actions[n] inside the n-th key derivation from now: the slow windows of a lock operation. */
const duringKeyDerivations = (actions: Record<number, () => unknown>) => {
    const deriveKey = crypto.subtle.deriveKey.bind(crypto.subtle)
    let calls = 0

    vi.spyOn(crypto.subtle, 'deriveKey').mockImplementation(async (...args) => {
        await actions[calls++]?.()
        return deriveKey(...args)
    })
}

const enrollmentResult = (token: string) => ({
    token,
    credentialId: bytesToBase64Url(randomBytes(16)),
    prfOutput: bytesToBase64(randomBytes(32)),
    aaguid: null,
    backupEligible: true,
    transports: ['internal'],
    name: 'Llave de acceso',
})

test('opens vaults written by versions before passkeys', async () => {
    await storageService.write('kdbxDatabase', await legacyVault('test', 1))

    const {vault, entries} = setup()
    await expect(vault.unlock({password: 'test1'})).rejects.toThrow(INVALID_KEY_ERROR)
    await vault.unlock({password: 'test'})

    expect(await entries.list()).toHaveLength(1)
})

test('without passkeys the vault stays a KeePass file keyed with the password', async () => {
    const {vault, entries, passkeys} = setup()
    await vault.initialize('test')
    await addEntry(entries)

    // a cancelled enrollment changes nothing either
    await passkeys.beginEnrollment('test')

    const keepass = await openWithPassword(await raw())
    expect(keepass.getDefaultGroup().entries).toHaveLength(1)
    expect(readLocks(await raw())).toBeNull()
})

test('adding the first passkey re-keys the vault in a single write', async () => {
    const {vault, entries, passkeys} = setup()
    await vault.initialize('test')
    await addEntry(entries)

    const saved = vi.fn()
    vault.onSave(saved)
    const write = vi.spyOn(storageService, 'write')

    const {credentialId, prfOutput} = await enrollPasskey(passkeys)

    expect(saved).toHaveBeenCalledTimes(1)
    expect(write.mock.calls.filter(([key]) => key === 'kdbxDatabase')).toHaveLength(1)

    // versions before passkeys no longer open it
    await expect(openWithPassword(await raw())).rejects.toThrow(INVALID_KEY_ERROR)

    // the session continues with the new key, and both locks open the vault
    await addEntry(entries)
    vault.lock()
    await vault.unlock({password: 'test'})
    expect(await entries.list()).toHaveLength(2)
    vault.lock()
    await passkeys.unlock(credentialId, prfOutput)
    expect(await entries.list()).toHaveLength(2)
})

test('adds a passkey, unlocks with it and removes it', async () => {
    const {vault, entries, passkeys} = setup()
    await vault.initialize('test')
    await addEntry(entries)

    const {passkey, credentialId, prfOutput} = await enrollPasskey(passkeys)

    expect(passkey.name).toBe('Gestor de contraseñas de Google')
    expect(await passkeys.list()).toHaveLength(1)
    expect(await passkeys.canUnlock()).toBe(true)

    vault.lock()

    // available while locked, for the lock screen
    const request = await passkeys.unlockRequest()
    expect.assert(request, 'no unlock request while locked')
    expect(request.rpId).toBe('unlock.efirmasegura.com')
    expect(request.credentials).toEqual([
        {id: credentialId, transports: ['internal', 'hybrid'], prfSalt: expect.any(String)},
    ])

    await expect(passkeys.unlock(credentialId, bytesToBase64(randomBytes(32))))
        .rejects.toThrow(INVALID_KEY_ERROR)
    expect(vault.isUnlocked()).toBe(false)

    await passkeys.unlock(credentialId, prfOutput)
    expect(await entries.list()).toHaveLength(1)
    expect((await passkeys.list())[0].lastUsedAt).not.toBeNull()

    await passkeys.remove(passkey.id)
    expect(await passkeys.list()).toHaveLength(0)
    expect(await passkeys.canUnlock()).toBe(false)

    vault.lock()
    await expect(passkeys.unlock(credentialId, prfOutput)).rejects.toThrow(UNKNOWN_PASSKEY_ERROR)
    await vault.unlock({password: 'test'})
    expect(await entries.list()).toHaveLength(1)
})

test('removing a passkey rotates the data key: its old lock no longer opens the vault', async () => {
    const {vault, entries, passkeys} = setup()
    await vault.initialize('test')
    await addEntry(entries)
    const removed = await enrollPasskey(passkeys)
    const kept = await enrollPasskey(passkeys)

    // what the removed passkey could still open: its lock in a copy taken before removal
    const oldLock = readLocks(await raw())!.locks.filter(isPasskeyLock)
        .find((lock) => lock.credentialId === removed.credentialId)!
    const oldDataKey = await openLock(oldLock, await passkeyKek(base64ToBytes(removed.prfOutput)))

    await passkeys.remove(removed.passkey.id)

    await expect(Kdbx.load(readBase64AsBytes(await raw()).buffer, dataKeyCredentials(oldDataKey)))
        .rejects.toThrow(INVALID_KEY_ERROR)

    // the session continues with the new key; the password and the other passkey open it
    await addEntry(entries)
    vault.lock()
    await vault.unlock({password: 'test'})
    expect(await entries.list()).toHaveLength(2)
    vault.lock()
    await passkeys.unlock(kept.credentialId, kept.prfOutput)
    expect(await entries.list()).toHaveLength(2)
})

test('removing a passkey keeps lock types from newer versions, sealed to the new data key', async () => {
    const {vault, passkeys} = setup()
    await vault.initialize('test')
    const {passkey} = await enrollPasskey(passkeys)

    // a newer version added a lock type this one doesn't know (say, an Argon2id password lock)
    const session = (vault as any).session
    const db = await Kdbx.load(readBase64AsBytes(await raw()).buffer, session.credentials)
    const {kek, kdf} = await newPasswordKek('future secret', 1000)
    const future = await createLock({type: 'future', kdf} as never, kek, session.dataKey)
    const locks = locksOf(db)!
    await writeLocks(db, session.dataKey, {...locks, locks: [...locks.locks, future.lock as LockRecord]},
        {...lockKeysOf(db), [future.lock.id]: future.publicKey})
    await storageService.write('kdbxDatabase', readBufferAsBase64(await db.save()))

    await passkeys.remove(passkey.id)

    const kept = readLocks(await raw())!.locks.find((lock) => lock.id === future.lock.id)
    expect.assert(kept, 'the unknown lock was dropped')
    expect(kept.sealed).not.toEqual(future.lock.sealed)

    const dataKey = await openLock(kept as never, kek)
    await Kdbx.load(readBase64AsBytes(await raw()).buffer, dataKeyCredentials(dataKey))
})

test('changing the password of a vault without locks keeps it a KeePass file keyed with the password', async () => {
    const {vault, entries} = setup()
    await vault.initialize('test')
    await addEntry(entries)

    await expect(vault.updatePassword('test1', 'new password')).rejects.toThrow(INVALID_KEY_ERROR)
    await vault.updatePassword('test', 'new password')

    // the session continues, and versions before passkeys open it with the new password
    await addEntry(entries)
    expect((await openWithPassword(await raw(), 'new password')).getDefaultGroup().entries).toHaveLength(2)

    vault.lock()
    await expect(vault.unlock({password: 'test'})).rejects.toThrow(INVALID_KEY_ERROR)
    await vault.unlock({password: 'new password'})
    expect(await entries.list()).toHaveLength(2)
})

test('changing the password keeps passkeys working and rotates the data key', async () => {
    const {vault, entries, passkeys} = setup()
    await vault.initialize('test')
    await addEntry(entries)
    const {credentialId, prfOutput} = await enrollPasskey(passkeys)

    // what the old password could still open: the data key behind a copy taken before the change
    const oldLock = readLocks(await raw())!.locks.filter(isPasskeyLock)[0]
    const oldDataKey = await openLock(oldLock, await passkeyKek(base64ToBytes(prfOutput)))

    await vault.updatePassword('test', 'new password')

    await expect(Kdbx.load(readBase64AsBytes(await raw()).buffer, dataKeyCredentials(oldDataKey)))
        .rejects.toThrow(INVALID_KEY_ERROR)
    expect(readLocks(await raw())!.locks.filter((lock) => lock.type === 'password')).toHaveLength(1)

    // the session continues with the new key; the new password and the passkey open it, the old password doesn't
    await addEntry(entries)
    vault.lock()
    await expect(vault.unlock({password: 'test'})).rejects.toThrow(INVALID_KEY_ERROR)
    await vault.unlock({password: 'new password'})
    expect(await entries.list()).toHaveLength(2)
    vault.lock()
    await passkeys.unlock(credentialId, prfOutput)
    expect(await entries.list()).toHaveLength(2)
})

test('a wrong current password changes nothing', async () => {
    const {vault, passkeys} = setup()
    await vault.initialize('test')
    await enrollPasskey(passkeys)
    const before = await raw()

    await expect(vault.updatePassword('test1', 'new password')).rejects.toThrow(INVALID_KEY_ERROR)
    expect(await raw()).toBe(before)
})

test('locking while the password changes never stores it', async () => {
    // 0, 1: checking the current password; 2: the new password's KEK, before the vault is loaded;
    // 3: the lock crypto between loading and saving
    for (const step of [0, 1, 2, 3]) {
        fakeBrowser.reset()
        const {vault, passkeys} = setup()
        await vault.initialize('test')
        await enrollPasskey(passkeys)
        const before = await raw()

        duringKeyDerivations({[step]: () => vault.lock()})

        await expect(vault.updatePassword('test', 'new password')).rejects.toThrow(LOCKED_ERROR)
        expect(await raw()).toBe(before)

        vi.restoreAllMocks()
        await vault.unlock({password: 'test'})
        expect(vault.isUnlocked()).toBe(true)
    }
})

test('a save while the password changes is kept', async () => {
    const {vault, entries, passkeys} = setup()
    await vault.initialize('test')
    await enrollPasskey(passkeys)

    const queued: Promise<unknown>[] = []
    duringKeyDerivations({
        // the new password's KEK, before the vault is loaded
        2: () => addEntry(entries),
        // the lock crypto runs inside the queue: this save waits for the re-key and uses the new key
        3: () => void queued.push(addEntry(entries)),
    })

    await vault.updatePassword('test', 'new password')
    await Promise.all(queued)
    vi.restoreAllMocks()

    expect(await entries.list()).toHaveLength(2)
    vault.lock()
    await vault.unlock({password: 'new password'})
    expect(await entries.list()).toHaveLength(2)
})

test('the readable header never holds a public key', async () => {
    const {vault, passkeys} = setup()
    await vault.initialize('test')
    await enrollPasskey(passkeys)

    const db = await Kdbx.load(readBase64AsBytes(await raw()).buffer, (vault as any).session.credentials)
    const publicKeys = Object.values(lockKeysOf(db))
    const header = JSON.stringify(readLocks(await raw()))

    expect(publicKeys).toHaveLength(2)
    for (const publicKey of publicKeys) {
        expect(header).not.toContain(publicKey)
    }
})

test('renames a passkey', async () => {
    const {vault, passkeys} = setup()
    await vault.initialize('test')
    const {passkey} = await enrollPasskey(passkeys)

    await passkeys.rename(passkey.id, '  Mi Mac  ')

    expect((await passkeys.list())[0].name).toBe('Mi Mac')
})

test('adding a passkey requires the master password', async () => {
    const {vault, passkeys} = setup()
    await vault.initialize('test')

    await expect(passkeys.beginEnrollment('test1')).rejects.toThrow(INVALID_KEY_ERROR)

    // also once the vault has locks
    await enrollPasskey(passkeys)
    await expect(passkeys.beginEnrollment('test1')).rejects.toThrow(INVALID_KEY_ERROR)

    vault.lock()
    await expect(passkeys.beginEnrollment('test')).rejects.toThrow(LOCKED_ERROR)
})

test('enrollment token is single use', async () => {
    const {vault, passkeys} = setup()
    await vault.initialize('test')

    const {enrollment} = await enrollPasskey(passkeys)

    await expect(passkeys.finishEnrollment(enrollmentResult(enrollment.token)))
        .rejects.toThrow(ENROLLMENT_EXPIRED_ERROR)
    await expect(passkeys.finishEnrollment(enrollmentResult('made-up')))
        .rejects.toThrow(ENROLLMENT_EXPIRED_ERROR)

    expect(await passkeys.list()).toHaveLength(1)
})

test('enrollment token expires', async () => {
    vi.useFakeTimers({toFake: ['Date']})

    const {vault, passkeys} = setup()
    await vault.initialize('test')

    const enrollment = await passkeys.beginEnrollment('test')

    vi.setSystemTime(Date.now() + ENROLLMENT_TTL + 60_000)

    await expect(passkeys.finishEnrollment(enrollmentResult(enrollment.token)))
        .rejects.toThrow(ENROLLMENT_EXPIRED_ERROR)
})

test('a passkey can not unlock a vault without locks', async () => {
    const {vault, passkeys} = setup()
    await vault.initialize('test')
    vault.lock()

    await expect(passkeys.unlock('credential', bytesToBase64(randomBytes(32)))).rejects.toThrow(UNKNOWN_PASSKEY_ERROR)
    expect(await passkeys.canUnlock()).toBe(false)
    expect(await passkeys.unlockRequest()).toBeNull()
})

test('a vault from a newer version asks to update, never "wrong password"', async () => {
    const db = Kdbx.create(new Credentials(null, randomBytes(32)), 'e.firma Segura');
    db.setVersion(4);
    db.setKdf(Consts.KdfId.Aes);
    const header = new VarDictionary()
    header.set('efirma-segura.locks', VarDictionary.ValueType.String, JSON.stringify({v: 2}))
    db.header.publicCustomData = header
    await storageService.write('kdbxDatabase', readBufferAsBase64(await db.save()))

    const {vault, passkeys} = setup()

    await expect(vault.unlock({password: 'test'})).rejects.toThrow(UNSUPPORTED_VAULT_ERROR)
    // the lock screen still renders
    expect(await passkeys.canUnlock()).toBe(false)
    expect(await passkeys.list()).toEqual([])
})

test('exports a KeePass file keyed with the master password alone, without locks', async () => {
    const {vault, entries, passkeys} = setup()
    await vault.initialize('test')
    await addEntry(entries)
    await enrollPasskey(passkeys)

    const before = await raw()

    await expect(vault.exportKeePass('test1')).rejects.toThrow(INVALID_KEY_ERROR)

    const base64 = await vault.exportKeePass('test')
    const keepass = await openWithPassword(base64)

    expect(keepass.getDefaultGroup().entries).toHaveLength(1)
    expect(readLocks(base64)).toBeNull()
    expect(lockKeysOf(keepass)).toEqual({})
    expect(await raw()).toBe(before)
})

test('exports a vault without locks as it is', async () => {
    await storageService.write('kdbxDatabase', await legacyVault())
    const {vault} = setup()

    expect(await vault.exportKeePass('test')).toBe(await raw())
    await expect(vault.exportKeePass('test1')).rejects.toThrow(INVALID_KEY_ERROR)
})

test('locks travel with the synced vault', async () => {
    const device = setup()
    await device.vault.initialize('test')
    await addEntry(device.entries)
    const {credentialId, prfOutput} = await enrollPasskey(device.passkeys)

    const synced = (await device.vault.export())!

    fakeBrowser.reset()

    const other = setup()
    await other.vault.import(synced)

    await other.passkeys.unlock(credentialId, prfOutput)
    expect(await other.entries.list()).toHaveLength(1)

    other.vault.lock()
    await other.vault.unlock({password: 'test'})
    expect(await other.entries.list()).toHaveLength(1)
})

test('a lock change synced from another device survives a later local save', async () => {
    const {vault, entries, passkeys} = setup()
    await vault.initialize('test')
    const {passkey} = await enrollPasskey(passkeys)

    // another device with the same vault renames the passkey, and sync brings it here
    const other = setup()
    await other.vault.unlock({password: 'test'})
    await other.passkeys.rename(passkey.id, 'Renombrada')
    expect((await passkeys.list())[0].name).toBe('Renombrada')

    await addEntry(entries)

    expect((await passkeys.list())[0].name).toBe('Renombrada')
    expect(await entries.list()).toHaveLength(1)
})

test('locks instead of overwriting a vault another device re-keyed', async () => {
    const {vault, entries} = setup()
    await vault.initialize('test')

    // another device added the first passkey: the vault has a new data key
    const other = setup()
    await other.vault.unlock({password: 'test'})
    await enrollPasskey(other.passkeys)
    const replaced = await raw()

    await expect(addEntry(entries)).rejects.toThrow(SESSION_INVALIDATED_ERROR)
    expect(vault.isUnlocked()).toBe(false)
    expect(await raw()).toBe(replaced)
})

test('locking while a passkey is added never stores its lock', async () => {
    for (const skip of [0, 1, 2]) {
        fakeBrowser.reset()
        const {vault, passkeys} = setup()
        await vault.initialize('test')
        const enrollment = await passkeys.beginEnrollment('test')
        const before = await raw()

        // 0: the PRF key before the vault is loaded; 1, 2: the lock crypto between loading and saving
        duringKeyDerivations({[skip]: () => vault.lock()})

        await expect(passkeys.finishEnrollment(enrollmentResult(enrollment.token))).rejects.toThrow(LOCKED_ERROR)
        expect(await raw()).toBe(before)

        vi.restoreAllMocks()
        await vault.unlock({password: 'test'})
        expect(await openWithPassword(await raw())).toBeTruthy()
    }
})

test('a save while a passkey is added is kept', async () => {
    const {vault, entries, passkeys} = setup()
    await vault.initialize('test')
    const enrollment = await passkeys.beginEnrollment('test')
    const result = enrollmentResult(enrollment.token)

    // one save before the vault is loaded; a save and a read queued while the lock crypto re-keys it
    const queued: Promise<unknown>[] = []
    duringKeyDerivations({
        0: () => addEntry(entries),
        1: () => void queued.push(addEntry(entries), entries.list()),
    })

    await passkeys.finishEnrollment(result)
    await Promise.all(queued)
    vi.restoreAllMocks()

    expect(await passkeys.list()).toHaveLength(1)
    expect(await entries.list()).toHaveLength(2)

    vault.lock()
    await passkeys.unlock(result.credentialId, result.prfOutput)
    expect(await entries.list()).toHaveLength(2)
})

test('storage updates never interleave: a save and a rename both survive', async () => {
    const {vault, entries, passkeys} = setup()
    await vault.initialize('test')
    const {passkey} = await enrollPasskey(passkeys)

    // the rename's write hangs until released, so an unserialised save would read the old vault meanwhile
    const write = storageService.write.bind(storageService)
    let release!: () => void
    const gate = new Promise<void>((resolve) => release = resolve)
    vi.spyOn(storageService, 'write').mockImplementationOnce(async (...args) => {
        await gate
        return write(...args)
    })

    const kdbxSave = Kdbx.prototype.save
    let saved!: () => void
    const kdbxSaved = new Promise<void>((resolve) => saved = resolve)
    vi.spyOn(Kdbx.prototype, 'save').mockImplementation(async function (this: Kdbx) {
        const result = await kdbxSave.call(this)
        saved()
        return result
    })

    const renaming = passkeys.rename(passkey.id, 'Mi llave')
    const adding = addEntry(entries)

    // the save serialised its KDBX; give it time to read and write storage if nothing holds it back
    await kdbxSaved
    await new Promise((resolve) => setTimeout(resolve, 50))
    release()

    await Promise.all([renaming, adding])

    expect(await entries.list()).toHaveLength(1)
    expect((await passkeys.list())[0].name).toBe('Mi llave')
})

test('saving after the vault locked reports it locked, without invalidating', async () => {
    const {vault, entries} = setup()
    await vault.initialize('test')

    const invalidated = vi.fn()
    vault.onInvalidate(invalidated)

    // lock between reading the vault and saving it
    const kdbxSave = Kdbx.prototype.save
    vi.spyOn(Kdbx.prototype, 'save').mockImplementationOnce(async function (this: Kdbx) {
        vault.lock()
        return kdbxSave.call(this)
    })

    await expect(addEntry(entries)).rejects.toThrow(LOCKED_ERROR)
    expect(invalidated).not.toHaveBeenCalled()

    await vault.unlock({password: 'test'})
    expect(await entries.list()).toHaveLength(0)
})

test('automatic passkey unlock is on by default and stays per browser', async () => {
    const {vault, passkeys} = setup()
    await vault.initialize('test')
    const synced = (await vault.export())!

    expect(await passkeys.autoUnlock()).toBe(true)

    await passkeys.setAutoUnlock(false)
    expect(await passkeys.autoUnlock()).toBe(false)

    // not part of the vault: a synced copy doesn't carry it
    expect(synced).toBe(await vault.export())
})
