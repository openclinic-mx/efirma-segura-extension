<script setup lang="ts">
import {useNavigation} from "@/composables/navigation";
import {useSyncStore} from "@/stores/sync";

const syncStore = useSyncStore()
const {navigate} = useNavigation()
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
