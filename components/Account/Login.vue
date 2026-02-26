<script setup lang="ts">
import SyncStatus from "@/components/Sync/Status.vue";
import {useAccount} from "@/composables/account";
import {useSync} from "@/composables/sync";

const {signIn, isLoggedIn, logout, isSubscribed} = useAccount()
const {hasRemoteVault, syncDown} = useSync()

const loginAndSyncDown = async () => {
  const user = await signIn()

  if (!user) {
    return;
  }

  if (user.has_vault) {
    await syncDown()
  }
}
</script>

<template>
  <template v-if="isLoggedIn">
    <template v-if="hasRemoteVault">
      <Teleport to="#footer">
        <SyncStatus/>
      </Teleport>
    </template>
    <template v-else>
      <UAlert title="No cuentas con una bóveda sincronizada"
              icon="i-lucide-triangle-alert"
              variant="outline"
              color="warning"
              description="Crea una contraseña maestra para comenzar"
              :actions="[ { label: 'Cerrar sesión', color: 'primary', variant: 'soft', onClick: logout, loadingAuto: true}]"
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

