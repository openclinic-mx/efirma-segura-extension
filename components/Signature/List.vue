<script setup lang="ts">
import {computed, ref, useTemplateRef} from 'vue'
import {useNavigation} from "@/composables/navigation";
import Fuse from 'fuse.js'
import {useAutocomplete} from "@/composables/autocomplete";
import SignatureItem from "@/components/Signature/Item.vue"
import type {SignatureMeta} from "@/services/signature";

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

const {navigate} = useNavigation()

const query = ref('')

const {select} = useAutocomplete()

const loading = ref(false)

const toast = useToast()

const handleSelect = async (signature: SignatureMeta) => {
  loading.value = true

  try {
    const response = await select(signature.id, autoSubmit.value)

    console.log(response)

    if (response.error) {
      toast.add({
        title: response.error,
        color: 'error'
      })
    } else {
      toast.add({
        title: 'Autocompletado',
        color: 'primary'
      })

    }
  } finally {
    // loading.value = false;
  }
}

const fuse = computed(() => {
  return new Fuse(props.signatures, {
    keys: [
      'title',
      'rfc',
      'legalName',
    ]
  })
})

const filteredResults = computed(() => {
  return query.value ? fuse.value.search(query.value).map(item => item.item) : props.signatures;
})


</script>

<template>

  <UInput placeholder="Buscar..." v-model="query" icon="i-lucide-search" ref="input">
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
      <template v-for="(signature, index) in filteredResults"
                :key="index">
        <SignatureItem :signature="signature" @autocomplete="handleSelect(signature)"/>
      </template>
    </template>

  </UPageList>

  <UButton type="submit" block @click="navigate('add')"
           icon="i-lucide-plus"
           variant="ghost"
  >
    Agregar e.firma
  </UButton>
</template>
