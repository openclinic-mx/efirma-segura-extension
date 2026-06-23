<script setup lang="ts">
import type {SignatureMeta} from "@/services/signature";
import type {DropdownMenuItem} from '@nuxt/ui'
import SignatureDetails from "@/components/Signature/Details.vue"
import {computed, ref} from 'vue'
import {useSignaturesStore} from "@/stores/signatures";
import {differenceInMonths, formatDistanceToNow} from "date-fns";
import {expirationColor, expirationText, expiresInDays} from "@/utils/expiration";

const props = defineProps<{
  signature: SignatureMeta
}>()

const signaturesStore = useSignaturesStore()

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
            signaturesStore.removeSignature(props.signature.id)
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
             size="xl" class="relative">
        <template #description>
          <span>
            {{signature.rfc}}
          </span>
          <span class="block mt-1" v-if="expiresInDays(signature.expiredAt)">
            <UBadge size="sm" :color="expirationColor(signature.expiredAt)">
              {{ expirationText(signature.expiredAt)}}
            </UBadge>
          </span>
        </template>
      </UUser>
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
