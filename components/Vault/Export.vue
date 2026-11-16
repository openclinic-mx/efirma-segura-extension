<script setup lang="ts">
import {reactive, ref, useTemplateRef, watch} from "vue";
import {formatISO} from "date-fns";
import {useDatabaseStore} from "@/stores/database";

const open = defineModel<boolean>('open', {default: false})

const databaseStore = useDatabaseStore()

const state = reactive({password: ''})

const error = ref<string | false>(false)

const loading = ref(false)

const passwordInput = useTemplateRef('passwordInput')

const focusPassword = () => {
  // after the disabled submit button lets go of the focus
  setTimeout(() => passwordInput.value?.inputRef?.focus(), 50)
}

const canDownload = () => "showSaveFilePicker" in window

watch(open, () => {
  state.password = ''
  error.value = false
})

const download = async (base64: string) => {
  const response = await fetch(`data:${'application/x-keepass'};base64,${base64}`);

  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `boveda-${formatISO(new Date())}.kdbx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const exportVault = async () => {
  if (loading.value) return;

  error.value = false

  if (!canDownload()) {
    error.value = 'Tu navegador no permite descargar la bóveda.'
    return
  }

  loading.value = true

  try {
    const response = await databaseStore.exportKeePass(state.password)

    state.password = ''

    if ('error' in response) {
      error.value = response.error.startsWith('Error InvalidKey')
          ? 'Contraseña incorrecta'
          : 'No pudimos exportar tu bóveda. Intenta de nuevo.'
      focusPassword()
      return
    }

    await download(response.base64)

    open.value = false
  } catch {
    error.value = 'No pudimos exportar tu bóveda. Intenta de nuevo.'
    focusPassword()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open"
          title="Exportar bóveda"
          description="Ingresa tu contraseña maestra. El archivo se abre en KeePass con esa contraseña.">
    <template #body>
      <UForm id="export-form" :state="state" @submit="exportVault">
        <UFormField label="Contraseña maestra" required :error="error">
          <UInput ref="passwordInput" type="password" v-model="state.password" required class="w-full" autofocus/>
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton type="submit" form="export-form" block icon="i-lucide-download" :loading="loading">Exportar</UButton>
    </template>
  </UModal>
</template>
