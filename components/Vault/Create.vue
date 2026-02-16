<script lang="ts" setup>
import * as z from "zod"
import {reactive} from 'vue';

const passwordLength = 12;

const schema = z.object({
  password: z.string().min(passwordLength, "La contraseña debe ser de al menos 12 caracteres"),
  repeatPassword: z.string().min(passwordLength, "La confirmación de la contraseña es requerida")
}).refine((data) => data.password === data.repeatPassword, {
  message: "La contraseña maestra no coincide",
  path: ["repeatPassword"],
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  password: '',
  repeatPassword: ''
})

const { initialize } = useDatabase();
</script>

<template>
  <UPageCard title="Crea una contraseña maestra para proteger tu e.firma." variant="naked">

    <UForm @submit.prevent="initialize(state.password)" loading-auto :schema="schema" :state="state" class="contents">
      <UFormField label="Contraseña maestra" required size="xl" class="w-full" name="password">
        <UInput type="password" v-model="state.password" required class="block" :minlength="passwordLength"
                :placeholder="`Mínimo ${passwordLength} caracteres`">
        </UInput>
      </UFormField>

      <UFormField label="Confirmar contraseña" required size="xl" class="w-full" name="repeatPassword">
        <UInput type="password" v-model="state.repeatPassword" required class="block" :minlength="passwordLength"
                placeholder="Repite tu contraseña">
        </UInput>
      </UFormField>

      <UButton type="submit" icon="i-lucide-landmark" block>Crear bóveda</UButton>
    </UForm>

  </UPageCard>
</template>
