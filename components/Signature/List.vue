<script setup lang="ts">
import {computed, ref, useTemplateRef} from 'vue'
import NavigationAddSignature from "@/components/Navigation/AddSignature.vue"
import Fuse from 'fuse.js'
import {useAutocomplete} from "@/composables/autocomplete";
import SignatureItem from "@/components/Signature/Item.vue"
import type {SignatureMeta} from "@/services/signature";
import {expiresInDays} from "@/utils/expiration";

const input = useTemplateRef('input')

const props = defineProps<{
  signatures: SignatureMeta[]
}>()

defineShortcuts({
  '/': () => {
    input.value?.inputRef?.focus()
  }
})

const autoSubmit = ref(true)



const query = ref('')

const {select} = useAutocomplete()

const loading = ref(false)

const toast = useToast()

const handleSelect = async (signature: SignatureMeta) => {
  loading.value = true

  try {
    const response = await select(signature.id, autoSubmit.value)

    if (response?.error) {
      toast.add({
        title: 'No pudimos completar el formulario.',
        description: response.error,
        color: 'error'
      })
    } else {
      toast.add({
        title: 'Autocompletado',
        color: 'primary'
      })

    }
  } finally {
    loading.value = false;
  }
}

const fuse = computed(() => {
  return new Fuse(props.signatures, {
    threshold: 0.35,
    keys: [
      'title',
      'rfc',
      'legalName',
    ]
  })
})

const expiredOrCloseFirst = (signatures: SignatureMeta[]): SignatureMeta[] => {
  const normalFiltering = signatures
      .filter(signature => !expiresInDays(signature.expiredAt))
  const soonToExpire = signatures
      .filter(signature => expiresInDays(signature.expiredAt))
      .sort((a, b) => Number(a.expiredAt) - Number(b.expiredAt))

  return [...soonToExpire,...normalFiltering]
}

const filteredResults = computed(() => {
  const results = query.value
      ? fuse.value.search(query.value).map(item => item.item)
      : props.signatures;

  const sorted = results.sort((a, b) => a.title.localeCompare(b.title))

  return expiredOrCloseFirst(sorted)
})



</script>

<template>

  <UInput :placeholder="`Buscar en ${props.signatures.length} efirma(s)...`" v-model="query" icon="i-lucide-search" ref="input">
    <template #trailing>
      <UKbd value="/"/>
    </template>
  </UInput>

  <USwitch label="Autocompletar y enviar formulario" v-model="autoSubmit"/>

  <UPageList class="space-y-2">

    <template v-if="filteredResults.length === 0">
      <div class="text-center py-4.5">Sin resultados</div>
    </template>

    <template v-else>
      <template v-for="(signature) in filteredResults"
                :key="signature.id">
        <SignatureItem :signature="signature" @autocomplete="handleSelect(signature)"/>
      </template>
    </template>

  </UPageList>
</template>
