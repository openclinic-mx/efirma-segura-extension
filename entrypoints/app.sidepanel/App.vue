<script lang="ts" setup>
import VaultCreate from '@/components/Vault/Create.vue'
import VaultLocked from '@/components/Vault/Locked.vue'
import VaultUnlocked from '@/components/Vault/Unlocked.vue'

const {lock, isInitialized, isUnlocked} = useDatabase()
</script>

<template>
  <UApp>
    <UDashboardPanel :ui="{ root: '' }">
      <template #header>
        <UDashboardNavbar title="Bóveda" icon="i-lucide-landmark" :toggle="false" :ui="{ title: 'text-base' }">
          <template #right v-if="isUnlocked">
            <UButton icon="i-lucide-lock" size="sm" variant="ghost" @click="lock">Cerrar</UButton>
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <template v-if="isUnlocked">
          <VaultUnlocked/>
        </template>
        <template v-else>
          <VaultLocked v-if="isInitialized"/>
          <VaultCreate v-else/>
        </template>
      </template>
    </UDashboardPanel>
  </UApp>

</template>
