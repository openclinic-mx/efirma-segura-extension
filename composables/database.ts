import {SignatureMeta} from "@/services/signatures";

export const useDatabase = () => {
    const isInitialized = ref(false);
    const isUnlocked = ref(false);

    const isLoading = ref(false);

    const signatures = ref<SignatureMeta[]>([]);

    const refreshList = async () => {
        if (isInitialized.value) {
            const response = await browser.runtime.sendMessage({
                type: 'VAULT_LIST',
            })

            signatures.value = response.signatures
        }
    }

    const refreshStatus = async () => {
        const response = await browser.runtime.sendMessage({
            type: 'VAULT_STATUS',
        })

        isUnlocked.value = response.isUnlocked;
        isInitialized.value = response.isInitialized;
    }

    onMounted(async () => {

        await refreshStatus();

        await refreshList();

        browser.runtime.onMessage.addListener(async (message) => {
            if (message.type === 'VAULT_STATUS_UPDATE') {
                await refreshStatus();
            }
            if (message.type === 'VAULT_UNLOCKED') {
                await refreshStatus();
                await refreshList();
            }
            if (message.type === 'VAULT_LIST_UPDATE') {
                await refreshList();
            }
        })
    })

    const unlock = async (masterPassword: string) => {
        return await browser.runtime.sendMessage({
            type: 'VAULT_UNLOCK',
            payload: {
                masterPassword
            }
        })
    }

    const lock = () => {
        return browser.runtime.sendMessage({
            type: 'VAULT_LOCK',
            payload: {}
        })
    }

    const initialize = (masterPassword: string) => {
        const response = browser.runtime.sendMessage({
            type: 'VAULT_INITIALIZE',
            payload: {
                masterPassword
            }
        })

        console.log(response)
    }

    return {
        signatures,
        isUnlocked,
        isInitialized,
        unlock,
        lock,
        initialize,
        isLoading,
    }
}
