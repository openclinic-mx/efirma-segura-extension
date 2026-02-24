<script setup lang="ts">
import {useColorMode} from '@vueuse/core'
import type {DropdownMenuItem} from '@nuxt/ui'
import {useAccount} from "@/composables/account";
import {useDatabase} from "@/composables/database";

const colorMode = useColorMode()

const {user, logout, signIn} = useAccount()

const {isUnlocked, lock} = useDatabase()


const userMenu = computed(() => {
  return {
    name: user.value?.name.split(' ')[0],
    avatar: user.value?.avatar ? {
      src: user.value.avatar,
      alt: user.value?.name
    } : {
      icon: 'i-lucide-user',
    }
  }
})


const items = computed<DropdownMenuItem[][]>(() => {

  const sessionItems: DropdownMenuItem[] = user.value ?
      [
        {
          label: 'Cerrar sesión',
          icon: 'i-lucide-log-out',
          onClick: () => logout()
        },
        {
          label: 'Subscripción',
          icon: 'i-lucide-credit-card'
        },
        {
          label: 'Sincronización',
          icon: 'i-lucide-cloud-check'
        }

      ]
      : [
        {
          label: 'Iniciar sesión',
          icon: 'i-lucide-log-in',
          onClick: () => signIn()
        },
      ]

  const databaseItems: DropdownMenuItem[] = isUnlocked.value ? [
    {
      label: 'Cerrar bóveda',
      icon: 'i-lucide-lock',
      onClick: () => lock()
    }
  ] : []

  const items: DropdownMenuItem[][] = [
    [{
      label: 'Apariencia',
      icon: 'i-lucide-sun-moon',
      children: [{
        label: 'Claro',
        icon: 'i-lucide-sun',
        type: 'checkbox',
        checked: colorMode.value === 'light',
        onSelect(e: Event) {
          e.preventDefault()

          colorMode.value = 'light'
        }
      }, {
        label: 'Oscuro',
        icon: 'i-lucide-moon',
        type: 'checkbox',
        checked: colorMode.value === 'dark',
        onUpdateChecked(checked: boolean) {
          if (checked) {
            colorMode.value = 'dark'
          }
        },
        onSelect(e: Event) {
          e.preventDefault()
        }
      }]
    }]
  ]

  if (sessionItems.length > 0) {
    items.unshift([...sessionItems])
  }

  if (databaseItems.length > 0) {
    items.push([...databaseItems])
  }

  return items;
})
</script>

<template>
  <UDropdownMenu
      :items="items"
      :content="{ align: 'center', collisionPadding: 12 }"
  >
    <UButton
        v-bind="{
          ...userMenu,
          label: userMenu?.name,
        }"
        color="neutral"
        variant="ghost"
        block
        class="data-[state=open]:bg-elevated"
    />

  </UDropdownMenu>
</template>
