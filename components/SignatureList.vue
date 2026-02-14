<script setup lang="ts">
import {ref, useTemplateRef} from 'vue'

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
  {
    name: 'Romain Hamel',
    description: 'romhml',
    to: 'https://github.com/romhml',
    target: '_blank',
    avatar: {
      src: 'https://github.com/romhml.png',
      alt: 'romhml'
    }
  },
  {
    name: 'Sébastien Chopin',
    description: 'atinux',
    to: 'https://github.com/atinux',
    target: '_blank',
    avatar: {
      src: 'https://github.com/atinux.png',
      alt: 'atinux'
    }
  },
  {
    name: 'Hugo Richard',
    description: 'HugoRCD',
    to: 'https://github.com/HugoRCD',
    target: '_blank',
    avatar: {
      src: 'https://github.com/HugoRCD.png',
      alt: 'HugoRCD'
    }
  },
  {
    name: 'Sandro Circi',
    description: 'sandros94',
    to: 'https://github.com/sandros94',
    target: '_blank',
    avatar: {
      src: 'https://github.com/sandros94.png',
      alt: 'sandros94'
    }
  },
  {
    name: 'Daniel Roe',
    description: 'danielroe',
    to: 'https://github.com/danielroe',
    target: '_blank',
    avatar: {
      src: 'https://github.com/danielroe.png',
      alt: 'danielroe'
    }
  },
  {
    name: 'Jakub Michálek',
    description: 'J-Michalek',
    to: 'https://github.com/J-Michalek',
    target: '_blank',
    avatar: {
      src: 'https://github.com/J-Michalek.png',
      alt: 'J-Michalek'
    }
  },
  {
    name: 'Eugen Istoc',
    description: 'genu',
    to: 'https://github.com/genu',
    target: '_blank',
    avatar: {
      src: 'https://github.com/genu.png',
      alt: 'genu'
    }
  }
])

const input = useTemplateRef('input')

defineShortcuts({
  '/': () => {

    console.log('input!')

    input.value?.inputRef?.focus()
  }
})

function onSelect() {

}

const autoSubmit = ref(true)
</script>

<template>

  <UInput placeholder="Buscar..." icon="i-lucide-search" ref="input">
    <template #trailing>
      <UKbd value="/"/>
    </template>
  </UInput>

  <USwitch label="Autocompletar y enviar formulario" v-model="autoSubmit"/>

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
               size="xl" class="relative" />


        <UIcon name="i-lucide-arrow-right" class="size-5 group-hover:opacity-100 group-focus-visible:opacity-100 opacity-0 transition text-primary"></UIcon>
      </template>
    </UPageCard>
  </UPageList>
</template>

<style scoped>

</style>
