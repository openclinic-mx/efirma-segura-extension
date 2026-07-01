<script setup lang="ts">
import {useSyncStore} from "@/stores/sync";
import {useNavigationStore} from "@/stores/navigation";

const syncStore = useSyncStore()
const {navigate} = useNavigationStore()
</script>

<template>
  <UButton block variant="ghost" icon="i-lucide-cloud-check" v-if="syncStore.isEnabled" @click="navigate('upgrade')">
    {{ syncStore.lastSyncAtHumanReadable }}
  </UButton>
  <UButton block color="neutral" variant="ghost" icon="i-lucide-cloud-off" v-else @click="navigate('upgrade')">
    Sincronización deshabilitada
  </UButton>
</template>

<style scoped>

</style>
