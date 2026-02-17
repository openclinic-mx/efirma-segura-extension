import { ref, watch, onMounted } from "vue"

export const useDatabase = () => {
    const { navigate } = useNavigation()

    const isInitialized = ref(false);
    const isUnlocked = ref(false);

    const refreshStatus = async () => {
        const response = await browser.runtime.sendMessage({
            type: 'VAULT_STATUS',
        })

        isUnlocked.value = response.isUnlocked;
        isInitialized.value = response.isInitialized;
    }

    watch(isUnlocked, (unlocked) => {
        if (!unlocked) {
            navigate('home')
        }
    })

    onMounted(async () => {
        await refreshStatus();

        browser.runtime.onMessage.addListener(async (message) => {
            if (message.type === 'VAULT_STATUS_UPDATE') {
                await refreshStatus();
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
        return browser.runtime.sendMessage({
            type: 'VAULT_INITIALIZE',
            payload: {
                masterPassword
            }
        })
    }

    return {
        isUnlocked,
        isInitialized,
        unlock,
        lock,
        initialize,
        refreshStatus,
    }
}
