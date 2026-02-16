<script setup lang="ts">
import {reactive, ref, toRefs, watch} from "vue";
import {useSignature} from "@/composables/signature";
import {useNavigation} from "@/composables/navigation";
import * as z from 'zod'
import type {FormSubmitEvent} from '@nuxt/ui'
import {readFileAsBase64} from "@/utils/files";

const state = reactive({
  name: '',
  cer: null,
  key: null,
  password: '',
})

const {cer, key, password} = toRefs(state)

const {
  parsedCertificate,
  isCorrectPair,
  isValid,
  isSignature,
  isCorrectPassword
} = useSignature(
    cer,
    key,
    password,
);

const schema = z.object({
  name: z.string(),
  cer: z.file({
    error: 'El archivo .CER es requerido'
  }).refine((val) => isValid.value === null ? true : isValid.value, {
    error: `El certificado expiró`
  }).refine((val) => isSignature.value === null ? true : isSignature.value, {
    error: `El certificado corresponde a un Certificado de Sello Digital`
  }),
  key: z.file({
    error: 'El archivo .KEY es requerido'
  }).refine(() => isCorrectPair.value === null ? true : isCorrectPair.value, {
    error: `La llave privada no corresponde al certificado`,
  }),
  password: z.string({
    error: 'La contraseña es requerida'
  }).refine(() => isCorrectPassword.value === null ? true : isCorrectPassword.value, {
    error: `La contraseña no es correcta`,
  }),
})

type Schema = z.output<typeof schema>


watch(parsedCertificate, (value) => {
  if (!value) return;

  state.name = value.legalName()
})

const show = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {

  const cer = await readFileAsBase64(event.data.cer)
  const key = await readFileAsBase64(event.data.key)

  await browser.runtime.sendMessage({
    type: 'VAULT_ADD',
    payload: {
      name: state.name,
      cer,
      key,
      password: state.password,
    }
  })

  navigate('home')
}

const {navigate} = useNavigation()
</script>

<template>
  <UPageCard title="Nueva e.firma" variant="naked" :ui="{ container: 'w-full' }">

    <template #title>
      <div class="items-center flex gap-2">
        <UButton icon="i-lucide-arrow-left" variant="ghost" @click="navigate('home')"></UButton>
        <span>Nueva e.firma</span>
      </div>
    </template>

    <UForm @submit.prevent="onSubmit" :schema="schema" :state="state" class="contents">
      <UFormField label="Archivo .CER" required class="w-full" name="cer">
        <UFileUpload required accept=".cer" v-model="state.cer" position="inside" layout="list">
        </UFileUpload>
      </UFormField>

      <UFormField label="Archivo .KEY" required class="w-full" name="key">
        <UFileUpload required accept=".key" v-model="state.key" position="inside" layout="list">
        </UFileUpload>
      </UFormField>

      <UFormField label="Contraseña de la llave privada" name="password" required class="w-full"
                  :ui="{ trailing: 'pe-1' }">
        <UInput :type="show ? 'text' : 'password'" required class="block" v-model="state.password"
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

      <UFormField label="Nombre / Alias" required class="w-full" name="name">
        <UInput required class="block" v-model="state.name" placeholder="Ej: Mi empresa SA de CV">
        </UInput>
      </UFormField>
      <UButton type="submit" block>Guardar e.firma</UButton>
    </UForm>
  </UPageCard>
</template>
