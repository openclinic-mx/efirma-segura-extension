<script setup lang="ts">
import {computed, reactive, ref, useTemplateRef, watch} from 'vue'
import {usePasskeysStore} from "@/stores/passkeys";
import {useAccountStore} from "@/stores/account";
import {
  createPasskey,
  evaluatePasskey,
  forgetPasskey,
  hasPasskeyPermission,
  requestPasskeyPermission
} from "@/utils/webauthn";
import {PASSKEY_RP_ID, PASSKEY_RP_NAME} from "@/utils/passkeys";
import {usePasskeyEnrollment} from "@/composables/passkeyEnrollment";

const passkeysStore = usePasskeysStore()
const accountStore = useAccountStore()

const {state, password, working, saving, start, stop, confirmPassword, allowAndCreate, verifyAgain, retry} =
    usePasskeyEnrollment({
      beginEnrollment: passkeysStore.beginEnrollment,
      finishEnrollment: passkeysStore.finishEnrollment,
      isRegistered: passkeysStore.isRegistered,
      hasPermission: hasPasskeyPermission,
      requestPermission: requestPasskeyPermission,
      createPasskey,
      evaluatePasskey,
      forgetPasskey: (credentialId) => forgetPasskey(PASSKEY_RP_ID, credentialId),
      userName: () => accountStore.user?.email || PASSKEY_RP_NAME,
    })

const open = ref(false)

watch(open, (value) => value ? start() : stop())

// UForm needs an object; writing form.password writes the composable's ref
const form = reactive({password})

const passwordInput = useTemplateRef('passwordInput')

// back on the password step (wrong password, expired token): after the DOM update, once the input exists
watch(state, (value) => {
  if (value.step === 'password') passwordInput.value?.inputRef?.focus()
}, {flush: 'post'})

const title = computed(() => state.value.step === 'password' ? 'Confirma tu contraseña maestra' : 'Agregar llave de acceso')
</script>

<template>
  <UModal v-model:open="open" :title="title" :dismissible="!saving" :close="!saving">
    <UButton block icon="i-lucide-plus">Agregar llave de acceso</UButton>

    <template #body>
      <UForm v-if="state.step === 'password'" id="passkey-password-form" :state="form" @submit="confirmPassword"
             class="flex flex-col gap-4">
        <UAlert v-if="state.notice" color="neutral" variant="subtle" :title="state.notice"/>

        <UFormField label="Contraseña maestra" required :error="state.error ?? false">
          <UInput ref="passwordInput" type="password" v-model="form.password" required class="w-full" autofocus/>
        </UFormField>
      </UForm>

      <p v-else-if="state.step === 'permission'">
        Tu navegador te pedirá permiso para {{ PASSKEY_RP_ID }}, el nombre con el que se guarda tu llave.
      </p>

      <div v-else-if="state.step === 'create'" class="flex justify-center py-2" role="status">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" aria-hidden="true"/>
        <span class="sr-only">Creando tu llave de acceso…</span>
      </div>

      <p v-else-if="state.step === 'verify'" role="status">
        Confírmala una vez más para comprobar que funciona.
      </p>

      <p v-else-if="state.step === 'done'" role="status">
        Tu llave de acceso está lista. Úsala la próxima vez que desbloquees tu bóveda.
      </p>

      <div v-else-if="state.step === 'error'" role="alert">
        <UAlert v-if="state.kind === 'cancelled'" color="neutral" variant="subtle"
                title="No se completó. Puedes intentarlo de nuevo cuando quieras."/>

        <UAlert v-else-if="state.kind === 'exists'" color="neutral" variant="subtle"
                title="Ya tienes una llave de acceso guardada ahí."
                description="Al crearla, elige guardarla en otro lugar."/>

        <UAlert v-else-if="state.kind === 'permission'" color="warning" variant="subtle"
                title="Sin este permiso Chrome no puede usar tu llave de acceso."/>

        <!-- TODO(passkeys): add the screenshot of Chrome's passkey dialog showing where to choose another location -->
        <UAlert v-else-if="state.kind === 'no-prf'" color="warning" variant="subtle"
                title="Esta llave no puede proteger tu bóveda."
                description="Al crearla, elige guardarla en otro lugar."/>

        <UAlert v-else color="error" variant="subtle" title="Algo salió mal. Intenta de nuevo."/>
      </div>
    </template>

    <!-- nothing to press while the browser's dialog is up -->
    <template v-if="state.step !== 'create'" #footer>
      <UButton v-if="state.step === 'password'" type="submit" form="passkey-password-form" block :loading="working">
        Continuar
      </UButton>

      <UButton v-else-if="state.step === 'permission'" block :loading="working" @click="allowAndCreate">
        Continuar
      </UButton>

      <UButton v-else-if="state.step === 'verify'" block :loading="working" :disabled="!state.failed"
               @click="verifyAgain">
        Comprobar
      </UButton>

      <UButton v-else-if="state.step === 'done'" block @click="open = false">Listo</UButton>

      <UButton v-else-if="state.step === 'error'" block :loading="working" @click="retry">Intentar de nuevo</UButton>
    </template>
  </UModal>
</template>
