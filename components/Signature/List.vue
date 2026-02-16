<script setup lang="ts">
import {ref, useTemplateRef} from 'vue'
import {useNavigation} from "@/composables/navigation";
import Fuse from 'fuse.js'
import {useDatabase} from "@/composables/database";
import {useAutocomplete} from "@/composables/autocomplete";

const input = useTemplateRef('input')

defineShortcuts({
  '/': () => {
    input.value?.inputRef?.focus()
  }
})

const autoSubmit = ref(true)

const {navigate} = useNavigation()

const query = ref('')

const {signatures} = useDatabase();

const {select} = useAutocomplete()

const fuse = computed(() => {
  return new Fuse(signatures.value, {
    keys: [
      'rfc',
      'legalName',
    ]
  })
})

const filteredResults = computed(() => {
  return query.value ? fuse.value.search(query.value).map(item => item.item) : signatures.value;
})
</script>

<template>

  <UInput placeholder="Buscar..." v-model="query" icon="i-lucide-search" ref="input">
    <template #trailing>
      <UKbd value="/"/>
    </template>
  </UInput>

  <USwitch label="Autocompletar y enviar formulario" v-model="autoSubmit"/>

  <UPageList>
    <UPageCard
        v-for="(signature, index) in filteredResults"
        :key="index"
        variant="ghost"
        class="cursor-pointer group text-left -mx-4"
        as="button"
        @click="select(signature.id, autoSubmit)"
        :ui="{
          body: 'w-full flex items-center justify-between ',
        }"
    >
      <template #body>
        <UUser :name="signature.legalName"
               :description="signature.rfc"
               :avatar="{ icon: 'i-lucide-key' }"
               size="xl" class="relative"/>


        <UIcon name="i-lucide-arrow-right"
               class="size-5 group-hover:opacity-100 group-focus-visible:opacity-100 opacity-0 transition text-primary"></UIcon>
      </template>
    </UPageCard>
  </UPageList>

  <UButton type="submit" block @click="navigate('add')"
           icon="i-lucide-plus"
           variant="ghost"
  >
    Agregar e.firma
  </UButton>
</template>

<style scoped>

</style>
