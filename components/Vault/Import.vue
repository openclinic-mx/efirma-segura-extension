<script setup lang="ts">
import {sendMessage} from "@/messaging";
import {Credentials, Kdbx, ProtectedValue} from 'kdbxweb';
import {reactive, ref} from "vue";
import {readFileAsBase64} from "@/utils/files";
import * as z from "zod"

const passwordLength = 12;

const schema = z.object({
  password: z.string()
      .min(passwordLength, "La contraseña debe ser de al menos 12 caracteres"),
  database: z.file()
      .min(1)
}).refine(async (data) => {
  const credentials = new Credentials(
      ProtectedValue.fromString(state.password)
  )

  try {
    await Kdbx.load(await state.database.arrayBuffer(), credentials);
    return true;
  } catch (e) {
    return false;
  }
}, {
  message: "La contraseña es incorrecta o la bóveda esta dañada.",
  path: ["password"],
})

const state = reactive<z.output<typeof schema>>({
  password: '',
  database: null as unknown as File,
})

const importVault = async () => {

  if (!state.database) {
    return;
  }

  const credentials = new Credentials(
      ProtectedValue.fromString(state.password)
  )

  try {
    await Kdbx.load(await state.database.arrayBuffer(), credentials);
    await sendMessage('VAULT_IMPORT', await readFileAsBase64(state.database))
    await sendMessage('VAULT_UNLOCK', state.password)
  } catch (e) {
    console.error(e)
  }
}
</script>

<template>
  <UModal title="Importar bóveda" description="Selecciona y autentica tu bóveda previamente exportada.">
    <UButton type="button"
             loading-auto
             block
             icon="i-lucide-upload"
             variant="ghost"
             color="info"
    >Importar bóveda
    </UButton>

    <template #body>
      <UForm id="import-form" :schema="schema" :state="state"  @submit="importVault">
        <UFormField label="Bóveda" name="database">
          <UFileUpload accept=".kdbx"  v-model="state.database"/>
        </UFormField>

        <UFormField label="Contraseña" class="mt-4" name="password">
          <UInput type="password" class="w-full"  placeholder="Mínimo 12 caracteres" v-model="state.password"/>
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton type="submit" block form="import-form" color="primary">Importar</UButton>
    </template>
  </UModal>

</template>
