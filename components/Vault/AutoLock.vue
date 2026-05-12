<script setup lang="ts">
import {onMounted, ref, computed} from "vue";
import {onMessage, sendMessage} from "@/messaging";

const lockStart = ref()
const lockDuration = ref()

const now = ref(Date.now())

const updateStatus = (status: { lockStart: number | null, lockDuration: number }) => {
  lockStart.value = status.lockStart
  lockDuration.value = status.lockDuration
}

onMounted(async () => {
  setInterval(() => {
    now.value = Date.now()
  }, 1000)

  const status = await sendMessage('TIMER_STATUS')

  updateStatus(status)

  onMessage('TIMER_START', (message) => {
    updateStatus(message.data)
  })
  onMessage('TIMER_CLEAR', (message) => {
    updateStatus(message.data)
  })
})

const resetTimer = () => {
  //
}

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
</script>

<template>
  <UButton block variant="ghost" color="neutral" leading-icon="i-lucide-lock" trailing-icon="i-lucide-lock-open">
    <UProgress :model-value="progress" v-if="progress" size="xs"/>
  </UButton>
</template>
