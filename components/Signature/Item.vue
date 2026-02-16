<script setup lang="ts">
import type {SignatureMeta} from "@/services/signatures";
import type {DropdownMenuItem} from '@nuxt/ui'
import {useSignatures} from "@/composables/signatures";
import {computed} from 'vue'

const props = defineProps<{
  signature: SignatureMeta
}>()

const {removeSignature} = useSignatures()

const items = computed<DropdownMenuItem[][]>(() => {
  return [
    [
      {
        label: props.signature.rfc,
        avatar: {
          icon: 'i-lucide-key'
        },
        type: 'label'
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

  </div>
</template>

<style scoped>

</style>
