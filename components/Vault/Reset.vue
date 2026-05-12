<script setup lang="ts">
import {sendMessage} from "@/messaging";
import {useSyncStore} from "@/stores/sync";

const syncStore = useSyncStore()

const resetVault = async () => {
  if (confirm('¿Reiniciar la bóveda? Se eliminarán TODAS las e.firmas guardadas. Esta acción no se puede deshacer.')) {
    await sendMessage('VAULT_RESET')
  }
}
</script>

<template>
  <UButton type="button"
           @click="resetVault"
           loading-auto
           block
           icon="i-lucide-trash"
           variant="ghost"
           color="error"
  >Reiniciar
    bóveda {{ syncStore.isEnabled ? 'sincronizada' : 'local' }}
  </UButton>
</template>
