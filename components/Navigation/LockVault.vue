<script setup lang="ts">
import {useDatabaseStore} from "@/stores/database";

const databaseStore = useDatabaseStore()
</script>

<template>
  <UButton @click="databaseStore.lock()"
           :icon="databaseStore.isUnlocked ? 'i-lucide-unlock' : 'i-lucide-lock'"
           variant="ghost"
           :disabled="!databaseStore.isUnlocked"
  >
  </UButton>
</template>

<style scoped>

</style>