<script setup lang="ts">
import {ref, useTemplateRef} from 'vue'
import {useNavigation} from "@/composables/navigation";

const users = ref([
  {
    name: 'Benjamin Canac',
    description: 'benjamincanac',
    to: 'https://github.com/benjamincanac',
    target: '_blank',
    avatar: {
      src: 'https://github.com/benjamincanac.png',
      alt: 'benjamincanac'
    }
  },
])

const input = useTemplateRef('input')

defineShortcuts({
  '/': () => {
    input.value?.inputRef?.focus()
  }
})

function onSelect() {

}

const autoSubmit = ref(true)

const {navigate} = useNavigation()

onMounted(async () => {
  const response = await browser.runtime.sendMessage({
    type: 'VAULT_LIST',
  })

  console.log(response)
})
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
        v-for="(user, index) in users"
        :key="index"
        variant="ghost"
        class="cursor-pointer group text-left -mx-4"
        as="button"
        @click=""
        :target="user.target"
        :ui="{
          body: 'w-full flex items-center justify-between ',
        }"
    >
      <template #body>
        <UUser :name="user.name"
               description="AUGO970113P27"
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
