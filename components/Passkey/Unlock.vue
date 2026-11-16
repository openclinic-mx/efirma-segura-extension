<script lang="ts" setup>
// Unlocking with a passkey, below the password form of the lock screen.
import {computed, onBeforeUnmount, ref, watch} from 'vue';
import {storeToRefs} from "pinia";
import {useDatabaseStore} from "@/stores/database";
import {usePasskeysStore} from "@/stores/passkeys";
import type {PasskeyUnlockRequest} from "@/vault/passkeyLocks";
import {evaluatePasskey, forgetPasskey, hasPasskeyPermission, PasskeyError, requestPasskeyPermission} from "@/utils/webauthn";
import {UNKNOWN_PASSKEY_ERROR} from "@/utils/passkeys";

/** Whether the passkey button shows. */
const available = defineModel<boolean>('available', {default: false})

/** The passkey was cancelled, or there is none left: back to the password. */
const emit = defineEmits<{ fallback: [] }>()

const databaseStore = useDatabaseStore();

const passkeysStore = usePasskeysStore();

const { canUnlockWithPasskey } = storeToRefs(databaseStore)

// loaded before the click (the permission prompt must be the click's first await) and refreshed when sync
// changes the vault's passkeys
const unlockRequest = ref<PasskeyUnlockRequest | null>(null)
const permissionGranted = ref(false)
const error = ref('')
const loading = ref(false)

// the button shows once the request is loaded; the lock screen's title follows it
const visible = computed(() => canUnlockWithPasskey.value && unlockRequest.value !== null)

watch(visible, (value) => available.value = value, {immediate: true})

// only the latest load may write: an older, slower answer must not overwrite a newer one
let loads = 0

// the first load finished (with or without passkeys): the automatic unlock can decide
const requestLoaded = ref(false)

const loadUnlockRequest = async () => {
  const load = ++loads

  if (!canUnlockWithPasskey.value) {
    unlockRequest.value = null
    requestLoaded.value = true
    return
  }

  try {
    // permission first: the button shows up only once we know whether the click must ask for it
    const granted = await hasPasskeyPermission()
    const request = await passkeysStore.unlockRequest()

    if (load !== loads) return

    permissionGranted.value = granted
    unlockRequest.value = request
  } catch {
    // background waking up or the vault went away: the password still works
    if (load === loads) unlockRequest.value = null
  } finally {
    if (load === loads) requestLoaded.value = true
  }
}

watch([canUnlockWithPasskey, () => passkeysStore.passkeys], loadUnlockRequest, {immediate: true})

// the vault can be unlocked from another window while the browser's passkey dialog is up
let unlockAbort: AbortController | null = null

onBeforeUnmount(() => unlockAbort?.abort())

const unlock = async () => {
  if (loading.value || !unlockRequest.value) return;

  error.value = ''
  loading.value = true

  try {
    if (!permissionGranted.value) {
      permissionGranted.value = await requestPasskeyPermission().catch(() => false)

      if (!permissionGranted.value) {
        error.value = 'Sin este permiso Chrome no puede usar tu llave de acceso.'
        return
      }
    }

    // fresh: a passkey may have been added or removed on another device since the screen loaded
    const request = await passkeysStore.unlockRequest()

    if (!request) {
      // every passkey was removed: only the password is left
      unlockRequest.value = null
      emit('fallback')
      return
    }

    unlockAbort = new AbortController()
    const signal = unlockAbort.signal

    const assertion = await evaluatePasskey({rpId: request.rpId, credentials: request.credentials, signal})

    // the lock screen went away (unlocked elsewhere): don't replace that session
    if (signal.aborted) return

    const response = await databaseStore.unlockWithPasskey(assertion.credentialId, assertion.prfOutput)

    if ('error' in response) {
      if (response.error === UNKNOWN_PASSKEY_ERROR) {
        error.value = 'Esta llave ya no está registrada en tu bóveda.'
        // stop offering it in the password manager
        await forgetPasskey(request.rpId, assertion.credentialId)
      } else {
        error.value = 'No pudimos desbloquear tu bóveda con esta llave.'
      }
    }
  } catch (e) {
    if (e instanceof PasskeyError && e.kind === 'cancelled') {
      emit('fallback')
      return
    }

    if (e instanceof PasskeyError && e.kind === 'permission') {
      permissionGranted.value = false
      error.value = 'Sin este permiso Chrome no puede usar tu llave de acceso.'
      return
    }

    error.value = 'No pudimos desbloquear tu bóveda con esta llave.'
  } finally {
    loading.value = false
  }
}

// "Usar llave de acceso automáticamente": ask right away when the panel opens locked. Only when the permission is
// already granted (the first time needs a click) and the panel has focus (Chrome refuses the dialog otherwise).
// A cancel lands on the password field, as with the button.
watch([requestLoaded, () => passkeysStore.autoUnlock], ([loaded, auto]) => {
  if (!loaded || auto === null || !databaseStore.consumeAutoUnlock()) return

  if (auto && visible.value && permissionGranted.value && document.hasFocus()) {
    unlock()
  }
}, {immediate: true})
</script>

<template>
  <template v-if="visible">
    <USeparator label="o"/>

    <div class="flex flex-col gap-2">
      <!-- outline: the password form stays the main action -->
      <UButton block variant="outline" icon="i-lucide-fingerprint" :loading="loading" @click="unlock">
        Llave de acceso
      </UButton>

      <p v-if="!permissionGranted" class="text-sm text-muted">
        La primera vez, Chrome te pedirá permiso para unlock.efirmasegura.com.
      </p>

      <p v-if="error" class="text-sm text-error" role="alert">
        {{ error }}
      </p>
    </div>
  </template>
</template>
