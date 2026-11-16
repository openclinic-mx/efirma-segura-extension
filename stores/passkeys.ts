import {defineStore} from "pinia"
import {ref} from "vue"
import {onMessage, sendMessage} from "@/messaging"
import type {PasskeyEnrollmentResult, PasskeySummary} from "@/vault/passkeyLocks";

export const usePasskeysStore = defineStore("passkeys", () => {
    const passkeys = ref<PasskeySummary[]>([])

    const refresh = async () => {
        passkeys.value = await sendMessage('PASSKEY_LIST')
    }

    // best effort: the background also broadcasts PASSKEY_LIST_UPDATE after every change
    const refreshQuietly = () => {
        refresh().catch(() => {})
    }

    onMessage('PASSKEY_LIST_UPDATE', (message) => {
        passkeys.value = message.data
    })

    refreshQuietly()

    // null until loaded: the lock screen waits for it before deciding whether to ask for the passkey
    const autoUnlock = ref<boolean | null>(null)

    sendMessage('PASSKEY_AUTO_UNLOCK')
        .then((value) => autoUnlock.value = value)
        .catch(() => autoUnlock.value = false)

    const setAutoUnlock = async (enabled: boolean) => {
        const previous = autoUnlock.value
        autoUnlock.value = enabled

        const response = await sendMessage('PASSKEY_SET_AUTO_UNLOCK', enabled).catch(() => null)

        if (typeof response !== 'boolean') {
            autoUnlock.value = previous
        }
    }

    const unlockRequest = () => {
        return sendMessage('PASSKEY_UNLOCK_REQUEST')
    }

    const beginEnrollment = (masterPassword: string) => {
        return sendMessage('PASSKEY_ENROLL_BEGIN', masterPassword)
    }

    // a failed refresh must not turn a completed change into a failure
    const finishEnrollment = async (result: PasskeyEnrollmentResult) => {
        const response = await sendMessage('PASSKEY_ENROLL_FINISH', result)
        refreshQuietly()
        return response
    }

    /** Whether the vault has a lock for this credential (the answer to a finish whose response was lost). */
    const isRegistered = async (credentialId: string) => {
        const list = await sendMessage('PASSKEY_LIST')
        passkeys.value = list
        return list.some((passkey) => passkey.credentialId === credentialId)
    }

    const remove = async (id: string) => {
        const response = await sendMessage('PASSKEY_REMOVE', id)
        refreshQuietly()
        return response
    }

    const rename = async (id: string, name: string) => {
        const response = await sendMessage('PASSKEY_RENAME', {id, name})
        refreshQuietly()
        return response
    }

    return {
        passkeys,
        autoUnlock,
        setAutoUnlock,
        refresh,
        unlockRequest,
        beginEnrollment,
        finishEnrollment,
        isRegistered,
        remove,
        rename,
    }
})
