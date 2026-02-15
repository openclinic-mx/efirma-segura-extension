<script setup lang="ts">
import {ref, useTemplateRef} from 'vue'
import {useNavigation} from "@/composables/navigation";
import {SignatureMeta} from "@/services/signatures";

const input = useTemplateRef('input')

defineShortcuts({
  '/': () => {
    input.value?.inputRef?.focus()
  }
})


const signatures = ref<SignatureMeta[]>([])

const autoSubmit = ref(true)

const {navigate} = useNavigation()

onMounted(async () => {
  const response = await browser.runtime.sendMessage({
    type: 'VAULT_LIST',
  })

  signatures.value = response.signatures
})

async function getActiveTabId() {
  const [tab] = await browser.tabs.query({active: true, currentWindow: true});
  return tab?.id;
}

async function onSelect(signature: SignatureMeta) {
  const response = await browser.runtime.sendMessage({
    type: 'AUTOCOMPLETE_REQUEST',
    payload: {
      id: signature.id,
      tabId: await getActiveTabId(),
      submit: autoSubmit.value
    }
  })

  console.log(response)
}
</script>

<template>

  <UInput placeholder="Buscar..." icon="i-lucide-search" ref="input">
    <template #trailing>
      <UKbd value="/"/>
    </template>
  </UInput>


  <USwitch label="Autocompletar y enviar formulario" v-model="autoSubmit"/>

  <UButton type="submit" block @click="navigate('create')"
           icon="i-lucide-plus"
           variant="ghost"
  >
    Agregar e.firma
  </UButton>

  <UPageList>
    <UPageCard
        v-for="(signature, index) in signatures"
        :key="index"
        variant="ghost"
        class="cursor-pointer group text-left -mx-4"
        as="button"
        @click="onSelect(signature)"
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
</template>

<style scoped>

</style>
