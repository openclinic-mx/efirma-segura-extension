<script lang="ts" setup>
import {reactive, ref, useTemplateRef, watch} from 'vue';
import {useDatabase} from '#imports'
import VaultReset from "@/components/Vault/Reset.vue";

const state = reactive({
  password: ''
})

const error = ref<string | boolean>(false)

const {unlock} = useDatabase();

const input = useTemplateRef('input')

const openVault = async () => {
  error.value = '';

  const response = await unlock(state.password)

  if (response.error) {
    error.value = response.error
    state.password = ''
    setTimeout(() => {
      input.value?.inputRef?.focus()
    }, 50)
  }
}

watch(() => state.password, (value) => {
  if (value) {
    error.value = false;
  }
})
</script>

<template>
  <UPageCard title="Ingresa tu contraseña maestra para desbloquear." variant="naked">
    <UForm @submit.prevent="openVault" class="contents" loading-auto #default="{ loading }">
      <UFormField label="Contraseña maestra" required size="xl" class="w-full" :error="error">
        <UInput type="password" required class="block" minlength="12" v-model="state.password"
                ref="input"
                placeholder="Mínimo 12 caracteres">
        </UInput>
      </UFormField>

      <UButton type="submit" block icon="i-lucide-lock-open" :loading="loading">Desbloquear</UButton>
    </UForm>
  </UPageCard>

  <Teleport to="#footer" defer>
    <VaultReset/>
  </Teleport>
</template>
