<script setup lang="ts">
import {reactive, ref, toRefs, watch} from "vue";
import {useSignature} from "@/composables/signature";
import {useNavigation} from "@/composables/navigation";
import * as z from 'zod'
import type {FormSubmitEvent} from '@nuxt/ui'
import {useSignatures} from "@/composables/signatures";
import BulkForm from "@/components/Bulk/Form.vue"
import {useAccount} from "@/composables/account";

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
  }).refine((file) => file.size > 0, {message: "El archivo .CER está vacio"})
      .refine((val) => isValid.value === null ? true : isValid.value, {
        error: `El certificado expiró`
      }).refine((val) => isSignature.value === null ? true : isSignature.value, {
        error: `El certificado corresponde a un Certificado de Sello Digital`
      }),
  key: z.file({
    error: 'El archivo .KEY es requerido'
  }).refine((file) => file.size > 0, {message: "El archivo .KEY está vacio"})
      .refine(() => isCorrectPair.value === null ? true : isCorrectPair.value, {
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

const {addSignature} = useSignatures()

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {

  try {
    await addSignature(
        event.data.name,
        event.data.cer,
        event.data.key,
        event.data.password,
    )

    navigate('home')

    toast.add({
      title: 'e.firma agregada'
    })
  } catch (e) {
    toast.add({
      color: 'error',
      title: 'Algo salio mal'
    })
  }


}

const {navigate} = useNavigation()

const { isSubscribed } = useAccount()
</script>

<template>
  <UPageCard title="Nueva e.firma" variant="naked" :ui="{ container: 'w-full' }">

    <template #title>
      <div class="items-center flex gap-2">
        <UButton icon="i-lucide-arrow-left" variant="ghost" @click="navigate('home')"></UButton>
        <span>Nueva e.firma</span>
      </div>
    </template>


    <UForm @submit.prevent="onSubmit" loading-auto :schema="schema" :state="state" class="contents"
           #default="{loading}">
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
      <UButton type="submit" icon="i-lucide-save" block :loading="loading">Guardar e.firma</UButton>

      <UModal title="Carga masiva">
        <UButton variant="ghost" icon="i-lucide-gem" block>Carga masiva</UButton>

        <template #body>

          <article class="prose dark:prose-invert prose-sm">

            <h3>Cada e.firma en un folder</h3>

            <p>Cada e.firma debera estar en un folder que contenga los archivos .key, .cer y la contraseña en un archivo
              .txt</p>

            <h3>Archivo .txt</h3>

            <p>Asegura que el archivo .txt contiene únicamente la contraseña de tu e.firma, sin espacios al principio,
              al final o cualquier otro texto.</p>

            <h3>Archivos</h3>

            <p>Los nombres de los archivos .key, .cer y .txt no importan, únicamente su extensión</p>




          </article>
        </template>

        <template #footer>
          <template v-if="!isSubscribed">
            <UButton block color="primary" @click="navigate('upgrade')" icon="i-lucide-gem">Activar Licencia
              Profesional
            </UButton>
          </template>

          <template v-else>
            <BulkForm/>
          </template>
        </template>

      </UModal>
    </UForm>
  </UPageCard>
</template>
