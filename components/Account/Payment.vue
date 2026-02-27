<script setup lang="ts">
import {useAccount} from "@/composables/account";
import {format, parseISO} from 'date-fns'
import {computed} from "vue";

const {user, checkout, portal, isSubscribed} = useAccount()


const actions = computed(() => {
  return [{
    label: 'Administrar',
    color: 'primary',
    variant: 'soft',
    onClick: () => portal(),
    loadingAuto: true,
  }]
})
</script>

<template>
  <template v-if="isSubscribed">
    <UAlert icon="i-lucide-gem"
            variant="outline"
            title="Subscripción activa"
            :description="`Se renueva el ${format(parseISO(user!.subscription_renews_at), 'PPP')}`"
            :actions="actions"
    >
    </UAlert>
  </template>

  <template v-else>
    <UAlert icon="i-lucide-shield-check" variant="outline" title="Pago seguro con tarjeta de crédito o débito">
      <template #description>
        Cancela en cualquier momento sin cargos adicionales.
      </template>
    </UAlert>

    <p>
      <UButton @click="checkout" loading-auto :disabled="!user" block :variant="user ? 'solid' : 'outline'">
        Activar mi Licencia Profesional — $599/año
      </UButton>
    </p>

    <p class="text-xs text-center">Los precios mostrados están expresados en MXN</p>
  </template>


</template>

<style scoped>

</style>
