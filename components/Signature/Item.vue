<script setup lang="ts">
import type {SignatureMeta} from "@/services/signature";
import type {DropdownMenuItem} from '@nuxt/ui'
import {useSignatures} from "@/composables/signatures";
import SignatureDetails from "@/components/Signature/Details.vue"
import {computed, ref} from 'vue'

const props = defineProps<{
  signature: SignatureMeta
}>()

const {removeSignature} = useSignatures()

const open = ref(false)

const items = computed<DropdownMenuItem[][]>(() => {
  return [
    [
      {
        label: props.signature.rfc,
        icon: 'i-lucide-user',
        type: 'label'
      },

      {
        label: 'Detalles',
        icon: 'i-lucide-info',
        onClick: () => {
          open.value = true
        }
      },

      {
        label: 'Autocompletar',
        icon: 'i-lucide-key',
        onClick: () => {
          emits('autocomplete')
        }
      },

    ],
    [
      {
        label: 'Eliminar',
        icon: 'i-lucide-trash',
        onClick: () => {
          if (confirm('¿Eliminar esta e.firma? Esta acción no se puede deshacer.')) {
            removeSignature(props.signature.id)
          }
        }
      }
    ]
  ]
})

const emits = defineEmits(['autocomplete'])
</script>

<template>
  <div class="flex gap-1">
    <UButton
        variant="ghost"
        color="primary"
        class="text-left justify-start cursor-pointer"
        block
        @click="emits('autocomplete')"
    >
      <UUser :name="signature.title"
             :description="signature.rfc"
             :avatar="{ icon: 'i-lucide-key' }"
             size="xl" class="relative"/>
    </UButton>
    <UDropdownMenu :items="items">
      <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis-vertical"></UButton>
    </UDropdownMenu>

    <UModal v-model:open="open"
            :title="signature.title"
    >
      <template #body>
        <SignatureDetails :signature="signature"/>
      </template>
    </UModal>
  </div>
</template>
