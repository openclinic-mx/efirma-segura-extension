import {onMounted} from "vue";
import {formatDistanceToNow} from "date-fns";
import {useAccount} from "@/composables/account";

export const useSync = () => {
    const isEnabled = ref(false);

    const lastSyncAt = ref<string | null>(null);

    const localHash = ref<string | null>(null);

    const {user} = useAccount();

    const refreshStatus = async () => {
        const response = await browser.runtime.sendMessage({
            type: 'SYNC_STATUS',
        })

        isEnabled.value = response.isEnabled;
        lastSyncAt.value = response.lastSyncAt;
        localHash.value = response.hash;
    }

    onMounted(async () => {
        await refreshStatus();

        browser.runtime.onMessage.addListener(async (message) => {
            if (message.type === 'SYNC_STATUS_UPDATE') {
                await refreshStatus();
            }
        })
    })

    const syncUp = async () => {
        return await browser.runtime.sendMessage({
            type: 'SYNC_UP'
        })
    }

    const syncDown = async () => {
        return await browser.runtime.sendMessage({
            type: 'SYNC_DOWN'
        })
    }

    const syncStop = async () => {
        return await browser.runtime.sendMessage({
            type: 'SYNC_STOP'
        })
    }

    const remoteHash = async () => {
        return await browser.runtime.sendMessage({
            type: 'SYNC_REMOTE_HASH'
        })
    }

    const lastSyncAtHumanReadable = computed(() => {
        const when = lastSyncAt.value ? formatDistanceToNow(lastSyncAt.value, {addSuffix: true}) : ''

        return `Ultima sincronización ${when}`
    })

    const hasRemoteVault = computed(() => {
        return user.value?.has_vault
    })

    return {
        isEnabled,
        lastSyncAt,
        lastSyncAtHumanReadable,
        localHash,
        hasRemoteVault,
        syncUp,
        syncDown,
        syncStop,
        remoteHash
    }
}
