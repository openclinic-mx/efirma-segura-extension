import { defineStore } from "pinia"
import {computed, onMounted, ref} from "vue"
import { onMessage, sendMessage } from "@/messaging"
import {useAccountStore} from "@/stores/account";
import {formatDistanceToNow} from "date-fns";
import type {SyncStatus} from "@/messaging";

export const useSyncStore = defineStore("sync", () => {

    const isEnabled = ref<boolean | null>(false);

    const lastSyncAt = ref<string | null>(null);

    const localHash = ref<string | null>(null);

    const error = ref<SyncStatus['error']>(null);

    const toast = useToast();

    const accountStore = useAccountStore();

    const refreshStatus = async () => {
        const response = await sendMessage('SYNC_STATUS')

        isEnabled.value = response.isEnabled;
        lastSyncAt.value = response.lastSyncAt;
        localHash.value = response.hash;
        error.value = response.error;
    }

    // for syncs the user started: background syncs only show up in the sync status
    const notifyFailure = (status: SyncStatus) => {
        if (status.error) {
            toast.add({
                title: 'No pudimos sincronizar tu bóveda.',
                description: status.error.message,
                color: 'error'
            })
        }
    }

    onMounted(async () => {
        await refreshStatus();

        onMessage('SYNC_STATUS_UPDATE', message => {
            refreshStatus();
        })
    })

    const syncUp = async () => {
        notifyFailure(await sendMessage('SYNC_UP'))
    }

    const syncDown = async ( ) => {
        notifyFailure(await sendMessage('SYNC_DOWN'))
    }

    const syncStop = async () => {
        await sendMessage('SYNC_STOP')
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
        error,
        hasRemoteVault,
        syncUp,
        syncDown,
        syncStop,
        remoteHash
    }

})