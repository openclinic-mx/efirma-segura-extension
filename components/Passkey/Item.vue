<script setup lang="ts">
import type {DropdownMenuItem} from '@nuxt/ui'
import type {PasskeySummary} from "@/vault/passkeyLocks";
import {computed, reactive, ref} from 'vue'
import {format, formatDistanceToNow, parseISO} from "date-fns";
import {usePasskeysStore} from "@/stores/passkeys";
import {forgetPasskey} from "@/utils/webauthn";
import {PASSKEY_RP_ID} from "@/utils/passkeys";

const props = defineProps<{
  passkey: PasskeySummary
}>()

const passkeysStore = usePasskeysStore()

const renameOpen = ref(false)
const removeOpen = ref(false)

const rename = reactive({name: ''})
const renameError = ref<string | false>(false)
const removeError = ref<string | false>(false)
const renaming = ref(false)
const removing = ref(false)

const details = computed(() => {
  const added = `Agregada el ${format(parseISO(props.passkey.createdAt), 'PPP')}`

  if (!props.passkey.lastUsedAt) {
    return added
  }

  return `${added} · Último uso ${formatDistanceToNow(parseISO(props.passkey.lastUsedAt), {addSuffix: true})}`
})

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: 'Cambiar nombre',
      icon: 'i-lucide-pencil',
      onSelect: () => {
        rename.name = props.passkey.name
        renameError.value = false
        renameOpen.value = true
      }
    },
    {
      label: 'Eliminar',
      icon: 'i-lucide-trash',
      color: 'error',
      onSelect: () => {
        removeError.value = false
        removeOpen.value = true
      }
    },
  ]
])

const saveName = async () => {
  if (renaming.value) return;

  renameError.value = false
  renaming.value = true

  try {
    const response = await passkeysStore.rename(props.passkey.id, rename.name)

    if ('error' in response) {
      renameError.value = 'No pudimos cambiar el nombre. Intenta de nuevo.'
      return
    }

    renameOpen.value = false
  } catch {
    renameError.value = 'No pudimos cambiar el nombre. Intenta de nuevo.'
  } finally {
    renaming.value = false
  }
}

const remove = async () => {
  if (removing.value) return;

  removeError.value = false
  removing.value = true

  try {
    const response = await passkeysStore.remove(props.passkey.id)

    if ('error' in response) {
      removeError.value = 'No pudimos eliminar la llave. Intenta de nuevo.'
      return
    }

    removeOpen.value = false

    // so it stops showing up in the user's password manager
    await forgetPasskey(PASSKEY_RP_ID, response.credentialId)
  } catch {
    removeError.value = 'No pudimos eliminar la llave. Intenta de nuevo.'
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <div class="flex gap-1 items-center">
    <UUser :name="passkey.name"
           :avatar="{ icon: 'i-lucide-key-round' }"
           size="xl"
           class="flex-1 px-2.5 py-1.5">
      <template #description>
        <span class="block">{{ details }}</span>
        <span class="block mt-1">
          <UBadge size="sm" variant="subtle" :color="passkey.backupEligible ? 'success' : 'neutral'">
            {{ passkey.backupEligible ? 'Sincronizada' : 'Solo en este equipo' }}
          </UBadge>
        </span>
      </template>
    </UUser>

    <UDropdownMenu :items="items">
      <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis-vertical"
               :aria-label="`Opciones de ${passkey.name}`"/>
    </UDropdownMenu>

    <UModal v-model:open="renameOpen" title="Cambiar nombre">
      <template #body>
        <UForm :id="`rename-${passkey.id}`" :state="rename" @submit="saveName">
          <UFormField label="Nombre" required :error="renameError">
            <UInput v-model="rename.name" required maxlength="64" class="w-full" autofocus/>
          </UFormField>
        </UForm>
      </template>
      <template #footer>
        <UButton type="submit" :form="`rename-${passkey.id}`" block :loading="renaming">Guardar</UButton>
      </template>
    </UModal>

    <UModal v-model:open="removeOpen"
            :title="`¿Eliminar ${passkey.name}?`"
            description="Ya no podrás desbloquear tu bóveda con esta llave. Bórrala también de iCloud o Google si ya no la usas.">
      <template #body v-if="removeError">
        <UAlert color="error" variant="subtle" :title="removeError" role="alert"/>
      </template>
      <template #footer>
        <div class="flex gap-3 w-full">
          <UButton color="neutral" variant="outline" class="flex-1 justify-center" @click="removeOpen = false">
            Cancelar
          </UButton>
          <UButton color="error" class="flex-1 justify-center" icon="i-lucide-trash" :loading="removing" @click="remove">
            Eliminar
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
