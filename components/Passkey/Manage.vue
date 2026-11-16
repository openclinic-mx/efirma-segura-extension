<script setup lang="ts">
import PasskeyAdd from "@/components/Passkey/Add.vue"
import PasskeyItem from "@/components/Passkey/Item.vue"
import {usePasskeysStore} from "@/stores/passkeys";
import {useNavigationStore} from "@/stores/navigation";

// the store loads the list once and follows PASSKEY_LIST_UPDATE broadcasts
const passkeysStore = usePasskeysStore()

const {navigate} = useNavigationStore()
</script>

<template>
  <UPageCard description="Desbloquea tu bóveda con tu huella, tu rostro o el bloqueo de pantalla de tu equipo."
             variant="naked">
    <template #title>
      <div class="items-center flex gap-1.5">
        <UButton icon="i-lucide-arrow-left" variant="ghost" aria-label="Regresar" @click="navigate('home')"></UButton>
        <span>Llaves de acceso</span>
      </div>
    </template>

    <template v-if="passkeysStore.passkeys.length">
      <UPageList class="space-y-2">
        <PasskeyItem v-for="passkey in passkeysStore.passkeys" :key="passkey.id" :passkey="passkey"/>
      </UPageList>

      <UCheckbox v-if="passkeysStore.autoUnlock !== null"
                 :model-value="passkeysStore.autoUnlock"
                 @update:model-value="passkeysStore.setAutoUnlock($event === true)"
                 label="Usar llave de acceso automáticamente"
                 description="Al abrir e.firma Segura en este navegador, te pediremos tu llave de acceso sin dar clic."/>
    </template>

    <template v-else>
      <UEmpty variant="naked" icon="i-lucide-key-round"
              title="No tienes llaves de acceso"
              description="Agrega una para desbloquear sin escribir tu contraseña."/>

      <div class="flex flex-col gap-4 text-sm">
        <div>
          <p class="font-medium text-highlighted">¿Qué es una llave de acceso?</p>
          <p class="text-muted">Una llave cifrada que creas con tu huella, tu rostro o el bloqueo de pantalla.</p>
        </div>
        <div>
          <p class="font-medium text-highlighted">¿Dónde se guarda?</p>
          <p class="text-muted">En el gestor de contraseñas de tu equipo, para que puedas usarla en tus otros dispositivos.</p>
        </div>
      </div>
    </template>

    <PasskeyAdd/>
  </UPageCard>
</template>
