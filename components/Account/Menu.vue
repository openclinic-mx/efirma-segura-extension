<script setup lang="ts">
import {computed} from "vue";
import type {DropdownMenuItem} from '@nuxt/ui'
import {useDatabaseStore} from "@/stores/database";
import {useAccountStore} from "@/stores/account";
import {useSyncStore} from "@/stores/sync";
import { formatISO } from "date-fns";
import {useNavigationStore} from "@/stores/navigation";

const accountStore = useAccountStore()

const databaseStore = useDatabaseStore()

const {navigate} = useNavigationStore()

const syncStore = useSyncStore()

const userMenu = computed(() => {

  const user = accountStore.user

  return {
    name: user?.name.split(' ')[0],
    avatar: user?.avatar ? {
      src: user.avatar,
      alt: user?.name
    } : {
      icon: 'i-lucide-user',
    }
  }
})


const items = computed<DropdownMenuItem[][]>(() => {

  const sessionItems: DropdownMenuItem[] = accountStore.user ?
      [
        {
          label: 'Cerrar sesión',
          icon: 'i-lucide-log-out',
          onClick: () => {
            if (syncStore.isEnabled && confirm('¿Cerrar sesión? Se deshabilitara la sincronización de tu bóveda')) {
              accountStore.logout()
              return;
            }

            if (confirm('¿Cerrar sesión? ')) {
              accountStore.logout()
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
          onClick: () => accountStore.signIn()
        },
      ]

  const exportVault = async () => {
    const vault = await databaseStore.exportVault();

    if (!("showSaveFilePicker" in window)) {
      return;
    }

    const response = await fetch(`data:${'application/x-keepass'};base64,${vault.base64}`);

    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `boveda-${formatISO(new Date())}.kdbx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const databaseItems: DropdownMenuItem[] = databaseStore.isUnlocked ? [
    {
      label: 'Exportar bóveda',
      icon: 'i-lucide-download',
      onClick: exportVault
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
        <template v-if="syncStore.isEnabled">
          La sincronización quedara deshabilitada y no podrás utilizar los beneficios de tu subscripción en este
          dispositivo hasta que vuelvas a iniciar sesión.
        </template>
        <template v-else-if="accountStore.isSubscribed">
          Ya no podrás utilizar los beneficios de tu subscripción en este dispositivo hasta que vuelvas a iniciar
          sesión.
        </template>
      </article>
    </template>
    <template #footer>
      <div class="flex flex-col gap-4 w-full">
        <UButton block @click="accountStore.logout" icon="i-lucide-log-out">
          Cerrar sesión
        </UButton>

        <template v-if="syncStore.isEnabled">
          <UButton block variant="ghost" @click="accountStore.logout" icon="i-lucide-log-out">
            Cerrar sesión y ocultar bóveda
          </UButton>
        </template>
      </div>

    </template>
  </UModal>
</template>
