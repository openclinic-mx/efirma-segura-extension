<script setup lang="ts">
import {reactive, ref, watch} from "vue";
import {useSignature} from "../composables/signature";

const state = reactive({
  name: '',
});

const {
  key,
  cer,
  password,
  parsedCertificate
} = useSignature();

watch(parsedCertificate, (value) => {
  if (!value) return;

  state.name = value.legalName()
})

const show = ref(false)
</script>

<template>
  <UPageCard title="Nueva e.firma" variant="naked" :ui="{ container: 'w-full' }">
    <form @submit.prevent="" class="contents">
      <UFormField label="Archivo .CER" required class="w-full">
        <UFileUpload required accept=".cer" v-model="cer" position="inside" layout="list">
        </UFileUpload>
      </UFormField>

      <UFormField label="Archivo .KEY" required class="w-full">
        <UFileUpload required accept=".key" v-model="key" position="inside" layout="list">
        </UFileUpload>
      </UFormField>

      <UFormField label="Contraseña de la llave privada" required class="w-full" :ui="{ trailing: 'pe-1' }">
        <UInput :type="show ? 'text' : 'password'" required class="block" v-model="password"
                placeholder="Contraseña del .key">
          <template #trailing>
            <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="show ? 'Hide password' : 'Show password'"
                :aria-pressed="show"
                aria-controls="password"
                @click="show = !show"
            />
          </template>
        </UInput>
      </UFormField>

      <UFormField label="Nombre / Alias" required class="w-full">
        <UInput required class="block" v-model="state.name" placeholder="Ej: Mi empresa SA de CV">

        </UInput>
      </UFormField>

      <UButton type="submit" block>Guardar e.firma</UButton>
    </form>
  </UPageCard>
</template>
