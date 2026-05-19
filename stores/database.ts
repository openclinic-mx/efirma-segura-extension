import { defineStore } from "pinia"
import { ref } from "vue"
import { onMessage, sendMessage } from "@/messaging"

export const useDatabaseStore = defineStore("database", () => {
    const isInitialized = ref(false)
    const isUnlocked = ref(false)

    const setStatus = (status: { isInitialized: boolean, isUnlocked: boolean }) => {
        isInitialized.value = status.isInitialized
        isUnlocked.value = status.isUnlocked
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

    const exportVault = async () => {
        return sendMessage("VAULT_EXPORT")
    }

    return {
        isInitialized,
        isUnlocked,
        refreshStatus,
        unlock,
        lock,
        exportVault,
        initialize,
    }
})