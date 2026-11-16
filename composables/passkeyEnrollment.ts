// Adding a passkey: confirm the master password, create the passkey, unlock once with it, save its lock.

import {getCurrentScope, onScopeDispose, readonly, ref, shallowRef} from "vue";
import type {PasskeyEnrollment, PasskeyEnrollmentResult} from "@/vault/passkeyLocks";
import {INVALID_KEY_ERROR} from "@/vault/errors";
import {
    type createPasskey,
    type CreatedPasskey,
    type evaluatePasskey,
    PasskeyError,
    type PasskeyErrorKind
} from "@/utils/webauthn";
import {
    ENROLLMENT_EXPIRED_ERROR,
    ENROLLMENT_TTL,
    PASSKEY_ALREADY_REGISTERED_ERROR,
    passkeyNameFor
} from "@/utils/passkeys";

export type EnrollmentState =
    | { step: 'password', error?: string, notice?: string }
    | { step: 'permission' }
    // the browser's passkey dialog is up
    | { step: 'create' }
    // failed: the verification ran without a click and didn't complete, so the user can try it again
    | { step: 'verify', failed: boolean }
    | { step: 'done' }
    | { step: 'error', kind: PasskeyErrorKind }

export type EnrollmentDeps = {
    beginEnrollment: (masterPassword: string) => Promise<PasskeyEnrollment | { error: string }>,
    finishEnrollment: (result: PasskeyEnrollmentResult) => Promise<{ passkey: unknown } | { error: string }>,
    isRegistered: (credentialId: string) => Promise<boolean>,
    hasPermission: () => Promise<boolean>,
    requestPermission: () => Promise<boolean>,
    createPasskey: typeof createPasskey,
    evaluatePasskey: (options: Parameters<typeof evaluatePasskey>[0]) => Promise<{ prfOutput: string }>,
    forgetPasskey: (credentialId: string) => Promise<void>,
    userName: () => string,
    now?: () => number,
}

// leave room for the user to finish the biometric prompt before the background token expires
export const ENROLLMENT_MARGIN = 60 * 1000

export const WRONG_PASSWORD = 'Contraseña incorrecta'

export const PASSWORD_UNAVAILABLE = 'No pudimos confirmar tu contraseña. Intenta de nuevo.'

export const ENROLLMENT_EXPIRED_NOTICE = 'Pasó mucho tiempo. Confirma tu contraseña maestra de nuevo.'

/**
 * A passkey created in the password manager that the vault may not hold a lock for yet. It ends up either kept
 * (the vault has, or may have, a lock for it) or forgotten, so the password manager doesn't keep a passkey that
 * unlocks nothing. While its lock is being saved, only the outcome of that save decides.
 */
const holdPasskey = (passkey: CreatedPasskey, forgetPasskey: (credentialId: string) => Promise<void>) => {
    let status: 'held' | 'saving' | 'settled' = 'held'

    const forget = async () => {
        if (status === 'settled') return
        status = 'settled'
        await forgetPasskey(passkey.credentialId)
    }

    return {
        passkey,
        forget,
        keep: () => {
            status = 'settled'
        },
        startSaving: () => {
            status = 'saving'
        },
        // not saved, and it can be verified again with a new token
        stopSaving: () => {
            if (status === 'saving') status = 'held'
        },
        // the modal went away: forget it, unless a save in flight decides
        release: async () => {
            if (status === 'held') await forget()
        },
    }
}

type PendingPasskey = ReturnType<typeof holdPasskey>

/** Everything that belongs to one opening of the modal. Aborting it cancels the browser's passkey dialog. */
type Session = {
    controller: AbortController,
    // single-use token from the background, after confirming the master password
    enrollment: PasskeyEnrollment | null,
    expiresAt: number,
    pending: PendingPasskey | null,
}

export const usePasskeyEnrollment = (deps: EnrollmentDeps) => {
    const now = deps.now ?? Date.now

    const state = shallowRef<EnrollmentState>({step: 'password'})
    const password = ref('')
    const working = ref(false)
    // saving the lock: the modal must not be closed meanwhile
    const saving = ref(false)

    let session: Session | null = null

    const live = (s: Session) => !s.controller.signal.aborted

    const show = (s: Session, next: EnrollmentState) => {
        if (live(s)) state.value = next
    }

    const showError = (s: Session, e: unknown) => {
        show(s, {step: 'error', kind: e instanceof PasskeyError ? e.kind : 'unknown'})
    }

    const start = () => {
        stop()
        session = {controller: new AbortController(), enrollment: null, expiresAt: 0, pending: null}
        state.value = {step: 'password'}
        password.value = ''
        working.value = false
    }

    const stop = () => {
        if (!session) return

        session.controller.abort()
        void session.pending?.release()
        session = null
    }

    if (getCurrentScope()) {
        onScopeDispose(stop)
    }

    /** Runs one user action. Called synchronously from the click, so `task` keeps the user gesture until its first await. */
    const run = async (task: (s: Session) => Promise<void>) => {
        const s = session
        if (!s || working.value) return

        working.value = true

        try {
            await task(s)
        } finally {
            if (live(s)) working.value = false
        }
    }

    /** Back to the password step for a new token. A passkey already created is kept and verified next. */
    const backToPassword = (s: Session, expired: boolean) => {
        if (!live(s)) return

        s.enrollment = null
        password.value = ''
        show(s, {step: 'password', notice: expired ? ENROLLMENT_EXPIRED_NOTICE : undefined})
    }

    /** The token if it's still usable; otherwise asks for the password again and returns null. */
    const requireEnrollment = (s: Session) => {
        if (s.enrollment && now() < s.expiresAt) return s.enrollment

        backToPassword(s, s.enrollment !== null)
        return null
    }

    const dropPending = async (s: Session) => {
        const pending = s.pending
        s.pending = null
        await pending?.forget()
    }

    const create = async (s: Session) => {
        const enrollment = requireEnrollment(s)
        if (!enrollment || !live(s)) return

        show(s, {step: 'create'})

        let passkey: CreatedPasskey

        try {
            passkey = await deps.createPasskey({
                rpId: enrollment.rpId,
                userHandle: enrollment.userHandle,
                userName: deps.userName(),
                excludeCredentialIds: enrollment.excludeCredentialIds,
                prfSalt: enrollment.prfSalt,
                signal: s.controller.signal,
            })
        } catch (e) {
            showError(s, e)
            return
        }

        if (!live(s)) {
            // closed while the browser's dialog was up, and it completed anyway
            await deps.forgetPasskey(passkey.credentialId)
            return
        }

        s.pending = holdPasskey(passkey, deps.forgetPasskey)

        if (passkey.prfEnabled === false) {
            await dropPending(s)
            show(s, {step: 'error', kind: 'no-prf'})
            return
        }

        await verify(s)
    }

    // Always unlock once with the new passkey before saving it: some password managers report PRF support
    // when the passkey is created and then fail every unlock.
    const verify = async (s: Session) => {
        const pending = s.pending

        if (!pending) {
            backToPassword(s, false)
            return
        }

        // ask for the password before asking for biometrics again
        const enrollment = requireEnrollment(s)
        if (!enrollment) return

        show(s, {step: 'verify', failed: false})

        let prfOutput: string

        try {
            ({prfOutput} = await deps.evaluatePasskey({
                rpId: enrollment.rpId,
                credentials: [{
                    id: pending.passkey.credentialId,
                    transports: pending.passkey.transports,
                    prfSalt: enrollment.prfSalt,
                }],
                signal: s.controller.signal,
            }))
        } catch (e) {
            // closed meanwhile: stop() already released the passkey
            if (!live(s)) return

            if (e instanceof PasskeyError && e.kind === 'cancelled') {
                show(s, {step: 'verify', failed: true})
                return
            }

            // it can't unlock (or Chrome can't reach it): trying again creates a new one
            await dropPending(s)
            showError(s, e)
            return
        }

        if (!live(s)) return

        await finish(s, enrollment, pending, prfOutput)
    }

    const saveSlot = async (enrollment: PasskeyEnrollment, pending: PendingPasskey, prfOutput: string) => {
        const {passkey} = pending

        try {
            const response = await deps.finishEnrollment({
                token: enrollment.token,
                credentialId: passkey.credentialId,
                prfOutput,
                aaguid: passkey.aaguid,
                backupEligible: passkey.backupEligible,
                transports: passkey.transports,
                name: passkeyNameFor(passkey),
            })

            if (!('error' in response) || response.error === PASSKEY_ALREADY_REGISTERED_ERROR) return 'saved'
            if (response.error === ENROLLMENT_EXPIRED_ERROR) return 'expired'
            return 'failed'
        } catch {
            // the answer was lost, not necessarily the change: ask the vault before forgetting the passkey
            try {
                return await deps.isRegistered(passkey.credentialId) ? 'saved' : 'failed'
            } catch {
                return 'unknown'
            }
        }
    }

    const finish = async (s: Session, enrollment: PasskeyEnrollment, pending: PendingPasskey, prfOutput: string) => {
        pending.startSaving()
        saving.value = true

        let outcome: Awaited<ReturnType<typeof saveSlot>>

        try {
            outcome = await saveSlot(enrollment, pending, prfOutput)
        } finally {
            saving.value = false
        }

        // the token is spent either way
        s.enrollment = null

        switch (outcome) {
            case 'saved':
                pending.keep()
                s.pending = null
                show(s, {step: 'done'})
                break

            case 'unknown':
                // it may be saved: forgetting it could leave the vault with a lock nobody can use
                pending.keep()
                s.pending = null
                show(s, {step: 'error', kind: 'unknown'})
                break

            case 'failed':
                await dropPending(s)
                show(s, {step: 'error', kind: 'unknown'})
                break

            case 'expired':
                pending.stopSaving()

                if (live(s)) {
                    // keep the passkey: after the password it is verified again with a new token
                    backToPassword(s, true)
                } else {
                    await dropPending(s)
                }
                break
        }
    }

    const confirmPassword = () => run(async (s) => {
        let response: Awaited<ReturnType<EnrollmentDeps['beginEnrollment']>>

        try {
            response = await deps.beginEnrollment(password.value)
        } catch {
            show(s, {step: 'password', error: PASSWORD_UNAVAILABLE})
            return
        }

        if (!live(s)) return

        password.value = ''

        if ('error' in response) {
            show(s, {
                step: 'password',
                error: response.error.startsWith(INVALID_KEY_ERROR) ? WRONG_PASSWORD : PASSWORD_UNAVAILABLE,
            })
            return
        }

        s.enrollment = response
        s.expiresAt = now() + ENROLLMENT_TTL - ENROLLMENT_MARGIN

        if (s.pending) {
            // came back for a new token: the passkey already exists, only verify it
            await verify(s)
        } else if (await deps.hasPermission().catch(() => false)) {
            await create(s)
        } else {
            show(s, {step: 'permission'})
        }
    })

    const allowAndCreate = () => run(async (s) => {
        // first await of the click: Chrome only shows the permission prompt during a user gesture
        const granted = await deps.requestPermission().catch(() => false)

        if (!granted) {
            show(s, {step: 'error', kind: 'permission'})
            return
        }

        await create(s)
    })

    const verifyAgain = () => run(verify)

    const retry = () => {
        const s = session
        if (!s || working.value || !requireEnrollment(s)) return

        if (state.value.step === 'error' && state.value.kind === 'permission') {
            // synchronous hand-off: the permission request stays the click's first await
            return allowAndCreate()
        }

        return run((s) => s.pending ? verify(s) : create(s))
    }

    return {
        state: readonly(state),
        password,
        working: readonly(working),
        saving: readonly(saving),
        start,
        stop,
        confirmPassword,
        allowAndCreate,
        verifyAgain,
        retry,
    }
}
