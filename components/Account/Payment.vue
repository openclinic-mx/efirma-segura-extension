<script setup lang="ts">
import {useAccount} from "@/composables/account";
import {format, parseISO} from 'date-fns'
import {computed} from "vue";

const {user, checkout, portal, cfdi, isSubscribed} = useAccount()


const actions = computed(() => {
  return [
    {
      label: 'Administrar',
      color: 'primary',
      variant: 'soft',
      onClick: () => portal(),
      loadingAuto: true,
    },
    {
      label: 'Facturación',
      color: 'primary',
      variant: 'soft',
      onClick: () => cfdi(),
      target: '_blank',
      loadingAuto: true,
    }
  ]
})
</script>

<template>
  <template v-if="isSubscribed">
    <UAlert icon="i-lucide-gem"
            variant="outline"
            title="Licencia activa"
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

    <p class="text-xs">Los precios mostrados están expresados en MXN e incluyen IVA.</p>
    <p class="text-xs">Puede solicitar tu CFDI una vez realizado tu pago.</p>
  </template>


</template>

<style scoped>

</style>
