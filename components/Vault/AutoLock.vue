<script setup lang="ts">
import {useAutoLockStore} from "@/stores/autoLock";

const autoLockStore = useAutoLockStore()
</script>

<template>
  <UButton block variant="ghost" color="neutral" leading-icon="i-lucide-lock" trailing-icon="i-lucide-lock-open"
           class="pointer-events-none">
    <UProgress :model-value="autoLockStore.progress" v-if="autoLockStore.progress" size="xs"/>
  </UButton>
</template>
