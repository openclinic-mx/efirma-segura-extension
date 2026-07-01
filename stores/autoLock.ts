import {defineStore} from "pinia"
import {computed, onMounted, ref} from "vue"
import {onMessage, sendMessage} from "@/messaging";

export const useAutoLockStore = defineStore("autoLock", () => {
    const lockStart = ref()
    const lockDuration = ref()
    const now = ref(Date.now())

    const updateStatus = (status: { lockStart: number | null, lockDuration: number }) => {
        lockStart.value = status.lockStart
        lockDuration.value = status.lockDuration
    }

    onMessage('TIMER_START', (message) => {
        updateStatus(message.data)
    })

    onMessage('TIMER_CLEAR', (message) => {
        updateStatus(message.data)
    })

    onMounted(async () => {
        setInterval(() => {
            now.value = Date.now()
        }, 1000)

        const status = await sendMessage('TIMER_STATUS')

        updateStatus(status)
    })

    const progress = computed(() => {

        if (!lockDuration.value || !lockStart.value) {
            return 0
        }

        // need to return percentage

        // start at + duration = end time
        const lockEnd = lockStart.value + lockDuration.value

        // end time - now time = elapsed time
        const lockProgress = lockEnd - now.value

        // elapsed time / total time = progress
        const progress = (lockProgress / lockDuration.value) * 100

        return Math.max(0, Math.min(100, progress))
    })

    return {
        progress,
    }

})