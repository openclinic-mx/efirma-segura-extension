<script lang="ts" setup>
import VaultCreate from '@/components/Vault/Create.vue'
import VaultLocked from '@/components/Vault/Locked.vue'
import VaultUnlocked from '@/components/Vault/Unlocked.vue'

const {lock, isInitialized, isUnlocked} = useDatabase()

const {view} = useNavigation()
</script>

<template>
  <UApp>
    <UDashboardPanel :ui="{ root: '' }">
      <template #header>
        <UDashboardNavbar title="Bóveda" icon="i-lucide-landmark" :toggle="false" :ui="{ title: 'text-base' }">
          <template #right v-if="isUnlocked">
            <UButton icon="i-lucide-lock" color="neutral" size="sm" variant="ghost" @click="lock"
                     title="Cerrar bóveda"></UButton>
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <div id="header"></div>
        <template v-if="isUnlocked">
          <VaultUnlocked/>
        </template>
        <template v-else>
          <template v-if="isInitialized">
            <VaultLocked/>
          </template>
          <VaultCreate v-else/>
        </template>
        <div class="mt-auto not-empty:space-y-4" id="footer">
        </div>
      </template>
    </UDashboardPanel>
  </UApp>

</template>
