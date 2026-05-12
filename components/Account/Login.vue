<script setup lang="ts">
import SyncStatus from "@/components/Sync/Status.vue";
import {useAccountStore} from "@/stores/account";
import {useSyncStore} from "@/stores/sync";

const accountStore = useAccountStore()
const syncStore = useSyncStore()

const loginAndSyncDown = async () => {
  const user = await accountStore.signIn()

  if (!user) {
    return;
  }

  if (user.has_vault) {
    await syncStore.syncDown()
  }
}
</script>

<template>
  <template v-if="accountStore.isLoggedIn">
    <template v-if="syncStore.hasRemoteVault">
      <Teleport to="#footer" defer>
        <SyncStatus/>
      </Teleport>
    </template>
    <template v-else>
      <UAlert title="No cuentas con una bóveda sincronizada"
              icon="i-lucide-triangle-alert"
              variant="outline"
              color="warning"
              description="Crea una contraseña maestra para comenzar"
              :actions="[ { label: 'Cerrar sesión', color: 'primary', variant: 'soft', onClick: accountStore.logout, loadingAuto: true}]"
      >
      </UAlert>
    </template>
  </template>

  <template v-else>
    <UButton type="button" icon="i-lucide-user" block variant="ghost" loading-auto @click="loginAndSyncDown">
      Recuperar bóveda sincronizada
    </UButton>
  </template>
</template>

