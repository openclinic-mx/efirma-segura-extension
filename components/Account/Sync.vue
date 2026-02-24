<script setup lang="ts">
import {useAccount} from "@/composables/account";
import {useSync} from "@/composables/sync";

const {isSubscribed, user} = useAccount()

const {
  syncUp,
  syncDown,
  syncStop,
  isEnabled,
  lastSyncAtHumanReadable,
  hasRemoteVault,
} = useSync()

</script>

<template>
  <template v-if="isEnabled">
    <UAlert title="Sincronización activa"
            :description="lastSyncAtHumanReadable"
            variant="outline"
            icon="i-lucide-cloud-check"
            :actions="[{
              label: 'Desactivar',
               color: 'primary',
                variant: 'soft',
                onClick: () => syncStop()
            }]"
    >
    </UAlert>
  </template>

  <template v-else>

    <UModal title="Opera desde cualquier equipo">

      <UButton :disabled="!isSubscribed"
               :variant="isSubscribed ? 'solid' : 'outline'"
               block
               loading-auto
               icon="i-lucide-cloud"
      >
        Sincronizar bóveda
      </UButton>



      <template #body v-if="hasRemoteVault">
        <article class="prose dark:prose-invert ">
          <p>Ya tienes una bóveda guardada en tu cuenta.</p>
          <p><strong>Descargar bóveda remota:</strong> <br> Remplazaremos tu bóveda local con tus datos remotos.</p>
          <p><strong>Cargar bóveda local:</strong> <br> Remplazaremos tu bóveda remota con tus datos locales.</p>
        </article>
      </template>
      <template #footer v-if="hasRemoteVault">
        <div class="flex flex-col gap-4 w-full">
          <UButton loading-auto block icon="i-lucide-download" @click="syncDown">Descargar bóveda remota</UButton>
          <UButton loading-auto block icon="i-lucide-upload" variant="ghost" @click="syncUp">Cargar bóveda local
          </UButton>
        </div>
      </template>

      <template #body v-if="!hasRemoteVault">
        <article class="prose dark:prose-invert ">
          <p>Inicia sesión en otro navegador y tus e.firmas están ahí.</p>
          <p>La bóveda viaja cifrada; nosotros almacenamos los datos pero <strong>no</strong> podemos ver su contenido.
          </p>
        </article>
      </template>
      <template #footer v-if="!hasRemoteVault">
        <UButton block loading-auto icon="i-lucide-cloud" @click="syncUp">Activar sincronización</UButton>
      </template>
    </UModal>
  </template>


</template>
