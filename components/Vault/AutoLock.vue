<script setup lang="ts">
import {onMounted, ref, computed} from "vue";

const lockStart = ref()
const lockDuration = ref()

const now = ref(Date.now())

const updateStatus = (status: { lockStart: number, lockDuration: number }) => {
  lockStart.value = status.lockStart
  lockDuration.value = status.lockDuration
}

onMounted(async () => {
  setInterval(() => {
    now.value = Date.now()
  }, 1000)

  const status = await browser.runtime.sendMessage({
    type: 'TIMER_STATUS'
  })

  updateStatus(status)

  browser.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'TIMER_START') {
      updateStatus(message.payload)
    }

    if (message.type === 'TIMER_CLEAR') {
      updateStatus(message.payload)
    }
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
  return (lockProgress / lockDuration.value) * 100
})
</script>

<template>
  <UButton block variant="ghost" color="neutral" leading-icon="i-lucide-lock" trailing-icon="i-lucide-lock-open">
    <UProgress :model-value="progress" v-if="progress" size="xs"/>
  </UButton>
</template>
