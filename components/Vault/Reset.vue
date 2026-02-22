<script setup lang="ts">
const resetVault = async () => {
  if (confirm('¿Reiniciar la bóveda? Se eliminarán TODAS las e.firmas guardadas. Esta acción no se puede deshacer.')) {
    return browser.runtime.sendMessage({
      type: 'VAULT_RESET',
    })
  }
}
</script>

<template>
  <UButton type="button" @click="resetVault" loading-auto block icon="i-lucide-trash" variant="ghost" color="error">Reiniciar
    bóveda
  </UButton>
</template>
