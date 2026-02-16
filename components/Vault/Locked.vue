<script lang="ts" setup>
import {reactive, watch, ref} from 'vue';
import { useDatabase } from '#imports'

const state = reactive({
  password: ''
})

const error = ref<string | boolean>(false)

const { unlock } = useDatabase();

const openVault = async () => {
  error.value = '';

  const response = await unlock(state.password)

  if (response.error) {
    error.value = response.error
    state.password = ''
  }
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

      <UButton type="submit" block icon="i-lucide-lock-open">Desbloquear</UButton>
    </UForm>
  </UPageCard>

  <UButton type="button" @click="resetVault" loading-auto class="mt-auto" block variant="ghost" color="error">Reiniciar
    bóveda
  </UButton>
</template>
