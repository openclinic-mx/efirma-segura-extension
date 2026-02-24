<script setup lang="ts">
import {useSync} from "@/composables/sync";
import {useNavigation} from "@/composables/navigation";

const {isEnabled, lastSyncAt, lastSyncAtHumanReadable} = useSync()
const {navigate} = useNavigation()
</script>

<template>
  <UButton block variant="ghost" icon="i-lucide-cloud-check" v-if="isEnabled" @click="navigate('upgrade')">
    {{ lastSyncAtHumanReadable }}
  </UButton>
  <UButton block color="neutral" variant="ghost" icon="i-lucide-cloud-off" v-else @click="navigate('upgrade')">
    Sincronización deshabilitada
  </UButton>
</template>

<style scoped>

</style>
