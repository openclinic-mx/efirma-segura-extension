<script setup lang="ts">
import { computed} from "vue";
import {useColorMode} from '@vueuse/core'
import type {DropdownMenuItem} from '@nuxt/ui'
import {useAccount} from "@/composables/account";
import {useDatabase} from "@/composables/database";
import {useNavigation} from "@/composables/navigation";

const colorMode = useColorMode()

const {user, logout, signIn, isSubscribed} = useAccount()

const {isUnlocked, lock} = useDatabase()

const {navigate} = useNavigation()

const {isEnabled} = useSync()

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
          onClick: () => {
            if (isEnabled.value && confirm('¿Cerrar sesión? Se deshabilitara la sincronización de tu bóveda')) {
              logout()
              return;
            }

            if (confirm('¿Cerrar sesión? ')) {
              logout()
            }
          }
        },
        {
          label: 'Licencia',
          icon: 'i-lucide-credit-card',
          onClick: () => navigate('upgrade')
        },
        {
          label: 'Sincronización',
          icon: 'i-lucide-cloud',
          onClick: () => navigate('upgrade')
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

  const items: DropdownMenuItem[][] = []

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

  <UModal title="¿Cerrar sesión?">
    <template #body>
      <article class="prose dark:prose-invert">
        <template v-if="isEnabled">
          La sincronización quedara deshabilitada y no podrás utilizar los beneficios de tu subscripción en este
          dispositivo hasta que vuelvas a iniciar sesión.
        </template>
        <template v-else-if="isSubscribed">
          Ya no podrás utilizar los beneficios de tu subscripción en este dispositivo hasta que vuelvas a iniciar
          sesión.
        </template>
      </article>
    </template>
    <template #footer>
      <div class="flex flex-col gap-4 w-full">
        <UButton block @click="logout" icon="i-lucide-log-out">
          Cerrar sesión
        </UButton>

        <template v-if="isEnabled">
          <UButton block variant="ghost" @click="logout" icon="i-lucide-log-out">
            Cerrar sesión y ocultar bóveda
          </UButton>
        </template>
      </div>

    </template>
  </UModal>
</template>
