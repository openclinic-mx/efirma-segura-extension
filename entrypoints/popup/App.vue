<script lang="ts" setup>
import LockedVault from '@/components/LockedVault.vue';
import AddSignature from '@/components/AddSignature.vue';
import OpenVault from "../../components/OpenVault.vue";
import {ref} from "vue";


const unlocked = ref(false);

const page = ref('/');
</script>

<template>
  <UApp>

    <UDashboardPanel title="e.firma Segura" :ui="{ root: 'min-h-0' }">

      <template #header>
        <UDashboardNavbar title="e.firma Segura" icon="i-lucide-landmark" :toggle="false" :ui="{ title: 'text-base' }">

          <template #right v-if="page === '/signatures/create'">
            <UButton icon="i-lucide-arrow-left" @click="page = '/'" size="sm" variant="ghost">Regresar</UButton>
          </template>

          <template #right v-else-if="unlocked">
            <UButton icon="i-lucide-lock" @click="unlocked = false" size="sm" variant="ghost">Cerrar</UButton>
          </template>

        </UDashboardNavbar>
      </template>

      <template #body>
        <LockedVault v-if="!unlocked" @unlock="unlocked = true"/>
        <template v-else>
          <OpenVault v-if="page === '/'" @navigate="page = $event"/>
          <AddSignature v-if="page === '/signatures/create'"/>
        </template>
      </template>
    </UDashboardPanel>
  </UApp>

</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #54bc4ae0);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
