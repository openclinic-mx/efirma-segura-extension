import { defineStore } from "pinia"
import {computed, onMounted, ref} from "vue"
import { onMessage, sendMessage } from "@/messaging"
import {useAccountStore} from "@/stores/account";
import {formatDistanceToNow} from "date-fns";

export const useSyncStore = defineStore("sync", () => {

    const isEnabled = ref<boolean | null>(false);

    const lastSyncAt = ref<string | null>(null);

    const localHash = ref<string | null>(null);

    const accountStore = useAccountStore();

    const refreshStatus = async () => {
        const response = await sendMessage('SYNC_STATUS')

        isEnabled.value = response.isEnabled;
        lastSyncAt.value = response.lastSyncAt;
        localHash.value = response.hash;
    }

    onMounted(async () => {
        await refreshStatus();

        onMessage('SYNC_STATUS_UPDATE', message => {
            refreshStatus();
        })
    })

    const syncUp = () => {
        return sendMessage('SYNC_UP')
    }

    const syncDown = () => {
        return sendMessage('SYNC_DOWN')
    }

    const syncStop = () => {
        return sendMessage('SYNC_STOP')
    }

    const remoteHash = () => {
        return sendMessage('SYNC_REMOTE_HASH')
    }

    const lastSyncAtHumanReadable = computed(() => {
        const when = lastSyncAt.value ? formatDistanceToNow(lastSyncAt.value, {addSuffix: true}) : ''

        return `${when}`
    })

    const hasRemoteVault = computed(() => {
        return accountStore.user?.has_vault
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

})