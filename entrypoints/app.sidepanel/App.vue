<script lang="ts" setup>
import CreateVault from "@/components/CreateVault.vue";
import LockedVault from "@/components/LockedVault.vue";
import OpenVault from "@/components/OpenVault.vue";
import AddSignature from "@/components/AddSignature.vue";
import {useNavigation} from "@/composables/navigation";
import {ref, onMounted} from 'vue';

const isLoading = ref(true);
const isInitialized = ref(false);
const isUnlocked = ref(false);

async function getActiveTabId() {
  const [tab] = await browser.tabs.query({active: true, currentWindow: true});
  return tab?.id;
}

onMounted(async () => {
  isLoading.value = true;

  const status = await browser.runtime.sendMessage({
    type: 'VAULT_STATUS',
    payload: {}
  })

  isUnlocked.value = status.isUnlocked
  isInitialized.value = status.isInitialized
  isLoading.value = false;

  browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'VAULT_STATUS_UPDATE') {
      isUnlocked.value = message.payload.isUnlocked;
      isInitialized.value = message.payload.isInitialized;
    }
    if (message.type === 'VAULT_UNLOCKED') {
      isUnlocked.value = message.payload.isUnlocked;
      isInitialized.value = message.payload.isInitialized;
    }
  })
})

const lock = () => {
  browser.runtime.sendMessage({
    type: 'VAULT_LOCK',
    payload: {}
  })
}

const {view} = useNavigation()
</script>

<template>
  <UApp>
    <UDashboardPanel title="e.firma Segura" :ui="{ root: '' }">
      <template #header>
        <UDashboardNavbar title="e.firma Segura" icon="i-lucide-landmark" :toggle="false" :ui="{ title: 'text-base' }">
          <template #right v-if="isUnlocked">
            <UButton icon="i-lucide-lock" size="sm" variant="ghost" @click="lock">Cerrar</UButton>
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <template v-if="isUnlocked">
          <OpenVault v-if="view === 'home'"/>
          <AddSignature v-if="view === 'create'"/>
        </template>
        <template v-else>
          <LockedVault v-if="isInitialized"/>
          <CreateVault v-else/>
        </template>
      </template>
    </UDashboardPanel>
  </UApp>

</template>
