import { defineStore } from "pinia"
import { ref } from "vue"
import { onMessage, sendMessage, VaultStatus } from "@/messaging"

export const useDatabaseStore = defineStore("database", () => {
    const passwordLength = 10;

    const isInitialized = ref(false)
    const isUnlocked = ref(false)
    const canUnlockWithPasskey = ref(false)

    // Automatic passkey unlock happens once per panel, and only if the panel opened with the vault locked:
    // never after an auto-lock while the panel stays open.
    let statusSeen = false
    let autoUnlockPending = false

    const consumeAutoUnlock = () => {
        const pending = autoUnlockPending
        autoUnlockPending = false
        return pending
    }

    const setStatus = (status: VaultStatus) => {
        if (!statusSeen) {
            statusSeen = true
            autoUnlockPending = status.isInitialized && !status.isUnlocked
        }

        if (status.isUnlocked) {
            autoUnlockPending = false
        }

        isInitialized.value = status.isInitialized
        isUnlocked.value = status.isUnlocked
        canUnlockWithPasskey.value = status.canUnlockWithPasskey
    }

    const refreshStatus = async () => {
        const status = await sendMessage("VAULT_STATUS")
        setStatus(status)
    }

    onMessage("VAULT_STATUS_UPDATE", (message) => {
        setStatus(message.data)
    })

    refreshStatus()

    const unlock = async (masterPassword: string) => {
        const response = await sendMessage("VAULT_UNLOCK", masterPassword)

        await refreshStatus()

        return response
    }

    const unlockWithPasskey = async (credentialId: string, prfOutput: string) => {
        const response = await sendMessage("VAULT_UNLOCK_PASSKEY", {credentialId, prfOutput})

        await refreshStatus()

        return response
    }

    const lock = async () => {
        const response = await sendMessage("VAULT_LOCK")

        await refreshStatus()

        return response
    }

    const initialize = async (masterPassword: string) => {
        const response = await sendMessage("VAULT_INITIALIZE", masterPassword)

        await refreshStatus()

        return response
    }

    const exportKeePass = async (masterPassword: string) => {
        return sendMessage("VAULT_EXPORT_KEEPASS", masterPassword)
    }

    return {
        isInitialized,
        isUnlocked,
        canUnlockWithPasskey,
        consumeAutoUnlock,
        refreshStatus,
        unlock,
        unlockWithPasskey,
        lock,
        exportKeePass,
        initialize,
        passwordLength,
    }
})