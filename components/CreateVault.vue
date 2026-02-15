<script lang="ts" setup>
import * as z from "zod"
import {reactive} from 'vue';

const schema = z.object({
  password: z.string().min(12, "La contraseña debe ser de al menos 12 caracteres"),
  repeatPassword: z.string().min(12, "La confirmación de la contraseña es requerida")
}).refine((data) => data.password === data.repeatPassword, {
  message: "La contraseña maestra no coincide",
  path: ["repeatPassword"],
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  password: '',
  repeatPassword: ''
})

const initializeVault = async () => {
  await browser.runtime.sendMessage({
    type: 'VAULT_INITIALIZE',
    payload: {
      masterPassword: state.password
    }
  })
}
</script>

<template>
  <UPageCard title="Crea una contraseña maestra para proteger tu e.firma." variant="naked">

    <UForm @submit.prevent="initializeVault" loading-auto :schema="schema" :state="state" class="contents">
      <UFormField label="Contraseña maestra" required size="xl" class="w-full" name="password">
        <UInput type="password" v-model="state.password" required class="block" minlength="12"
                placeholder="Mínimo 12 caracteres">
        </UInput>
      </UFormField>

      <UFormField label="Confirmar contraseña" required size="xl" class="w-full" name="repeatPassword">
        <UInput type="password" v-model="state.repeatPassword" required class="block" minlength="12"
                placeholder="Repite tu contraseña">
        </UInput>
      </UFormField>

      <UButton type="submit" block>Crear bóveda</UButton>
    </UForm>

  </UPageCard>
</template>
