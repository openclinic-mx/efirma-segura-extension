<script lang="ts" setup>
import {computed, reactive, ref, useTemplateRef, watch} from 'vue';
import VaultReset from "@/components/Vault/Reset.vue";
import VaultImport from "@/components/Vault/Import.vue";
import PasskeyUnlock from "@/components/Passkey/Unlock.vue";
import {useDatabaseStore} from "@/stores/database";

const state = reactive({
  password: ''
})

const error = ref<string | boolean>(false)

const databaseStore = useDatabaseStore();

const { passwordLength } = databaseStore

const input = useTemplateRef('input')

const focusPassword = () => {
  setTimeout(() => {
    input.value?.inputRef?.focus()
  }, 50)
}

const openVault = async () => {
  error.value = '';

  const response = await databaseStore.unlock(state.password)

  if ('error' in response) {
    error.value = {
      'Error InvalidKey': 'Contraseña incorrecta',
    }[response.error] ?? response.error;
    state.password = ''
    focusPassword()
  }
}

watch(() => state.password, (value) => {
  if (value) {
    error.value = false;
  }
})

// the title follows the passkey button below the form
const passkeyAvailable = ref(false)

const title = computed(() => passkeyAvailable.value
    ? 'Desbloquea tu bóveda.'
    : 'Ingresa tu contraseña maestra para desbloquear tu bóveda.')
</script>

<template>
  <UPageCard :title="title" variant="naked">
    <UForm @submit.prevent="openVault" class="contents" loading-auto #default="{ loading }">
      <UFormField label="Contraseña maestra" required size="xl" class="w-full" :error="error">
        <UInput type="password" required class="block" :minlength="passwordLength" v-model="state.password"
                ref="input"
                :placeholder="`Mínimo ${passwordLength} caracteres`">
        </UInput>
      </UFormField>

      <UButton type="submit" block icon="i-lucide-lock-open" :loading="loading">Desbloquear</UButton>
    </UForm>

    <PasskeyUnlock v-model:available="passkeyAvailable" @fallback="focusPassword"/>
  </UPageCard>

  <Teleport to="#footer" defer>
    <VaultReset/>
  </Teleport>
</template>
