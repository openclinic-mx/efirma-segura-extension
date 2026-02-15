<script lang="ts" setup>
import {reactive, watch} from 'vue';

const state = reactive({
  password: ''
})

const error = ref<string | boolean>(false)

const openVault = async () => {
  error.value = '';

  const status = await browser.runtime.sendMessage({
    type: 'VAULT_STATUS',
    payload: {}
  })

  console.log({status})

  const response = await browser.runtime.sendMessage({
    type: 'VAULT_UNLOCK',
    payload: {
      masterPassword: state.password
    }
  })

  if (response.error) {
    error.value = response.error
    state.password = ''
  }

  console.log({response});
}

watch(() => state.password, (value) => {
  if (value) {
    error.value = false;
  }
})

const resetVault = async () => {
  if (confirm('¿Reiniciar la bóveda? Se eliminarán TODAS las e.firmas guardadas. Esta acción no se puede deshacer.')) {
    return browser.runtime.sendMessage({
      type: 'VAULT_RESET',
    })
  }
}
</script>

<template>
  <UPageCard title="Ingresa tu contraseña maestra para desbloquear." variant="naked">
    <UForm @submit.prevent="openVault" class="contents" loading-auto>
      <UFormField label="Contraseña maestra" required size="xl" class="w-full" :error="error">
        <UInput type="password" required class="block" minlength="12" v-model="state.password" autofocus
                placeholder="Mínimo 12 caracteres">
        </UInput>
      </UFormField>

      <UButton type="submit" block>Desbloquear</UButton>
    </UForm>
  </UPageCard>

  <UButton type="button" @click="resetVault" loading-auto class="mt-auto" block variant="ghost" color="error">Reiniciar
    bóveda
  </UButton>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
