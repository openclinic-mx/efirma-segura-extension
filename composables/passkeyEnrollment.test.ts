import {expect, test, vi} from 'vitest'
import {effectScope} from 'vue'
import {
    ENROLLMENT_EXPIRED_NOTICE,
    type EnrollmentDeps,
    PASSWORD_UNAVAILABLE,
    usePasskeyEnrollment,
    WRONG_PASSWORD
} from './passkeyEnrollment'
import {type CreatedPasskey, PasskeyError} from "@/utils/webauthn";
import {ENROLLMENT_EXPIRED_ERROR, ENROLLMENT_TTL, PASSKEY_ALREADY_REGISTERED_ERROR} from "@/utils/passkeys";
import {INVALID_KEY_ERROR} from "@/vault/errors";

const enrollment = {
    token: 'token',
    rpId: 'unlock.example.com',
    userHandle: 'user-handle',
    excludeCredentialIds: [],
    prfSalt: 'salt',
}

const created = (credentialId = 'credential-1'): CreatedPasskey => ({
    credentialId,
    prfEnabled: true,
    aaguid: null,
    backupEligible: true,
    transports: ['internal'],
    authenticatorAttachment: 'platform',
})

const deferred = <T>() => {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return {promise, resolve, reject}
}

const setup = (overrides: Partial<EnrollmentDeps> = {}) => {
    let clock = 0
    let count = 0

    const deps = {
        beginEnrollment: vi.fn(async () => enrollment),
        finishEnrollment: vi.fn(async () => ({passkey: {}})),
        isRegistered: vi.fn(async () => false),
        hasPermission: vi.fn(async () => true),
        requestPermission: vi.fn(async () => true),
        createPasskey: vi.fn(async () => created(`credential-${++count}`)),
        evaluatePasskey: vi.fn(async () => ({prfOutput: 'prf'})),
        forgetPasskey: vi.fn(async () => {}),
        userName: () => 'user@example.com',
        now: () => clock,
        ...overrides,
    } satisfies EnrollmentDeps

    const scope = effectScope()
    const enrollmentFlow = scope.run(() => usePasskeyEnrollment(deps))!
    enrollmentFlow.start()

    const submit = (password = 'secret') => {
        enrollmentFlow.password.value = password
        return enrollmentFlow.confirmPassword()
    }

    return {
        ...enrollmentFlow,
        deps: vi.mocked(deps),
        scope,
        submit,
        advance: (ms: number) => clock += ms,
    }
}

test('confirms the password, creates and verifies the passkey, then saves its lock', async () => {
    const flow = setup()

    await flow.submit('secret')

    expect(flow.deps.beginEnrollment).toHaveBeenCalledWith('secret')
    expect(flow.deps.createPasskey).toHaveBeenCalledWith(expect.objectContaining({
        rpId: enrollment.rpId,
        userHandle: enrollment.userHandle,
        userName: 'user@example.com',
        prfSalt: enrollment.prfSalt,
    }))
    expect(flow.deps.evaluatePasskey).toHaveBeenCalledWith(expect.objectContaining({
        credentials: [{id: 'credential-1', transports: ['internal'], prfSalt: enrollment.prfSalt}],
    }))
    expect(flow.deps.finishEnrollment).toHaveBeenCalledWith(expect.objectContaining({
        token: enrollment.token,
        credentialId: 'credential-1',
        prfOutput: 'prf',
        name: 'Llave de acceso',
    }))
    expect(flow.state.value).toEqual({step: 'done'})
    expect(flow.password.value).toBe('')
    expect(flow.working.value).toBe(false)
    expect(flow.deps.forgetPasskey).not.toHaveBeenCalled()
})

test('a wrong password stays on the password step', async () => {
    const flow = setup({beginEnrollment: vi.fn(async () => ({error: `${INVALID_KEY_ERROR}: bad`}))})

    await flow.submit()

    expect(flow.state.value).toEqual({step: 'password', error: WRONG_PASSWORD})
    expect(flow.password.value).toBe('')
    expect(flow.deps.createPasskey).not.toHaveBeenCalled()
})

test('a failed password check keeps what the user typed', async () => {
    const flow = setup({beginEnrollment: vi.fn(async () => Promise.reject(new Error('offline')))})

    await flow.submit('secret')

    expect(flow.state.value).toEqual({step: 'password', error: PASSWORD_UNAVAILABLE})
    expect(flow.password.value).toBe('secret')
})

test('ignores a second submit while the first one runs', async () => {
    const begin = deferred<typeof enrollment>()
    const flow = setup({beginEnrollment: vi.fn(() => begin.promise)})

    const first = flow.submit()
    await flow.submit()
    begin.resolve(enrollment)
    await first

    expect(flow.deps.beginEnrollment).toHaveBeenCalledTimes(1)
})

test('asks for the host permission during the click, before any await', async () => {
    const flow = setup({hasPermission: vi.fn(async () => false), requestPermission: vi.fn(async () => false)})

    await flow.submit()
    expect(flow.state.value).toEqual({step: 'permission'})

    const pending = flow.allowAndCreate()
    expect(flow.deps.requestPermission).toHaveBeenCalledTimes(1)
    await pending

    expect(flow.state.value).toEqual({step: 'error', kind: 'permission'})

    // retrying hands off to the permission request synchronously too
    flow.deps.requestPermission.mockResolvedValue(true)
    const retried = flow.retry()
    expect(flow.deps.requestPermission).toHaveBeenCalledTimes(2)
    await retried

    expect(flow.state.value).toEqual({step: 'done'})
})

test('forgets a passkey created without PRF', async () => {
    const flow = setup({createPasskey: vi.fn(async () => ({...created(), prfEnabled: false}))})

    await flow.submit()

    expect(flow.state.value).toEqual({step: 'error', kind: 'no-prf'})
    expect(flow.deps.forgetPasskey).toHaveBeenCalledWith('credential-1')
    expect(flow.deps.evaluatePasskey).not.toHaveBeenCalled()
})

test('a cancelled creation can be retried with the same token', async () => {
    const flow = setup()
    flow.deps.createPasskey.mockRejectedValueOnce(new PasskeyError('cancelled'))

    await flow.submit()
    expect(flow.state.value).toEqual({step: 'error', kind: 'cancelled'})

    await flow.retry()

    expect(flow.deps.beginEnrollment).toHaveBeenCalledTimes(1)
    expect(flow.deps.createPasskey).toHaveBeenCalledTimes(2)
    expect(flow.state.value).toEqual({step: 'done'})
})

test('a cancelled verification keeps the passkey and can be confirmed again', async () => {
    const flow = setup()
    flow.deps.evaluatePasskey.mockRejectedValueOnce(new PasskeyError('cancelled'))

    await flow.submit()
    expect(flow.state.value).toEqual({step: 'verify', failed: true})

    await flow.verifyAgain()

    expect(flow.deps.createPasskey).toHaveBeenCalledTimes(1)
    expect(flow.deps.forgetPasskey).not.toHaveBeenCalled()
    expect(flow.state.value).toEqual({step: 'done'})
})

test('a passkey that fails to unlock is forgotten, and retrying creates a new one', async () => {
    const flow = setup()
    flow.deps.evaluatePasskey.mockRejectedValueOnce(new PasskeyError('no-prf'))

    await flow.submit()

    expect(flow.state.value).toEqual({step: 'error', kind: 'no-prf'})
    expect(flow.deps.forgetPasskey).toHaveBeenCalledWith('credential-1')

    await flow.retry()

    expect(flow.deps.finishEnrollment).toHaveBeenCalledWith(expect.objectContaining({credentialId: 'credential-2'}))
    expect(flow.state.value).toEqual({step: 'done'})
})

test('asks for the password again when the token expires before verifying, keeping the passkey', async () => {
    const flow = setup()
    flow.deps.evaluatePasskey.mockRejectedValueOnce(new PasskeyError('cancelled'))

    await flow.submit()
    flow.advance(ENROLLMENT_TTL)
    await flow.verifyAgain()

    expect(flow.state.value).toEqual({step: 'password', notice: ENROLLMENT_EXPIRED_NOTICE})
    expect(flow.deps.evaluatePasskey).toHaveBeenCalledTimes(1)

    await flow.submit()

    expect(flow.deps.createPasskey).toHaveBeenCalledTimes(1)
    expect(flow.deps.forgetPasskey).not.toHaveBeenCalled()
    expect(flow.state.value).toEqual({step: 'done'})
})

test('a token the background already expired sends the user back to the password, keeping the passkey', async () => {
    const flow = setup()
    flow.deps.finishEnrollment.mockResolvedValueOnce({error: ENROLLMENT_EXPIRED_ERROR})

    await flow.submit()
    expect(flow.state.value).toEqual({step: 'password', notice: ENROLLMENT_EXPIRED_NOTICE})

    await flow.submit()

    expect(flow.deps.createPasskey).toHaveBeenCalledTimes(1)
    expect(flow.deps.finishEnrollment).toHaveBeenCalledTimes(2)
    expect(flow.deps.forgetPasskey).not.toHaveBeenCalled()
    expect(flow.state.value).toEqual({step: 'done'})
})

test('a passkey the vault already holds counts as saved', async () => {
    const flow = setup()
    flow.deps.finishEnrollment.mockResolvedValueOnce({error: PASSKEY_ALREADY_REGISTERED_ERROR})

    await flow.submit()

    expect(flow.state.value).toEqual({step: 'done'})
    expect(flow.deps.forgetPasskey).not.toHaveBeenCalled()
})

test('a rejected save forgets the passkey', async () => {
    const flow = setup()
    flow.deps.finishEnrollment.mockResolvedValueOnce({error: 'Error Something'})

    await flow.submit()

    expect(flow.state.value).toEqual({step: 'error', kind: 'unknown'})
    expect(flow.deps.forgetPasskey).toHaveBeenCalledWith('credential-1')
})

test.each([
    {registered: async () => true, state: {step: 'done'}, forgotten: false},
    {registered: async () => false, state: {step: 'error', kind: 'unknown'}, forgotten: true},
    {registered: async () => Promise.reject(new Error('offline')), state: {step: 'error', kind: 'unknown'}, forgotten: false},
])('a lost save response asks the vault before forgetting the passkey (forgotten: $forgotten)', async ({registered, state, forgotten}) => {
    const flow = setup({isRegistered: vi.fn(registered)})
    flow.deps.finishEnrollment.mockRejectedValueOnce(new Error('disconnected'))

    await flow.submit()

    expect(flow.deps.isRegistered).toHaveBeenCalledWith('credential-1')
    expect(flow.state.value).toEqual(state)
    expect(flow.deps.forgetPasskey).toHaveBeenCalledTimes(forgotten ? 1 : 0)
})

test('closing during the browser dialog cancels it and forgets a passkey created anyway', async () => {
    const dialog = deferred<CreatedPasskey>()
    const flow = setup({createPasskey: vi.fn(() => dialog.promise)})

    const submitted = flow.submit()
    await vi.waitFor(() => expect(flow.state.value).toEqual({step: 'create'}))

    flow.stop()
    expect(flow.deps.createPasskey.mock.calls[0][0].signal?.aborted).toBe(true)

    dialog.resolve(created())
    await submitted

    expect(flow.deps.forgetPasskey).toHaveBeenCalledWith('credential-1')
    expect(flow.deps.evaluatePasskey).not.toHaveBeenCalled()
})

test('closing during verification forgets the passkey', async () => {
    const dialog = deferred<{ prfOutput: string }>()
    const flow = setup({evaluatePasskey: vi.fn(() => dialog.promise)})

    const submitted = flow.submit()
    await vi.waitFor(() => expect(flow.state.value).toEqual({step: 'verify', failed: false}))

    flow.stop()
    dialog.reject(new PasskeyError('cancelled'))
    await submitted

    expect(flow.deps.forgetPasskey).toHaveBeenCalledWith('credential-1')
    expect(flow.deps.finishEnrollment).not.toHaveBeenCalled()
})

test.each([
    {response: {passkey: {}}, forgotten: false},
    {response: {error: ENROLLMENT_EXPIRED_ERROR}, forgotten: true},
])('closing while saving lets the outcome decide (forgotten: $forgotten)', async ({response, forgotten}) => {
    const save = deferred<{ passkey: unknown } | { error: string }>()
    const flow = setup({finishEnrollment: vi.fn(() => save.promise)})

    const submitted = flow.submit()
    await vi.waitFor(() => expect(flow.saving.value).toBe(true))

    flow.scope.stop()
    expect(flow.deps.forgetPasskey).not.toHaveBeenCalled()

    save.resolve(response)
    await submitted

    expect(flow.saving.value).toBe(false)
    expect(flow.deps.forgetPasskey).toHaveBeenCalledTimes(forgotten ? 1 : 0)
})

test('reopening starts over on the password step', async () => {
    const flow = setup()
    flow.deps.createPasskey.mockRejectedValueOnce(new PasskeyError('exists'))

    await flow.submit()
    expect(flow.state.value).toEqual({step: 'error', kind: 'exists'})

    flow.stop()
    flow.start()

    expect(flow.state.value).toEqual({step: 'password'})

    // the old token belonged to the closed session
    await flow.retry()
    expect(flow.deps.createPasskey).toHaveBeenCalledTimes(1)
})
