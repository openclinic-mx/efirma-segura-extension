<script setup lang="ts">
import {format, parseISO} from 'date-fns'
import {computed} from "vue";
import {useAccountStore} from "@/stores/account";

const accountStore = useAccountStore()


const actions = computed(() => {
  return [
    {
      label: 'Administrar',
      color: 'primary',
      variant: 'soft',
      onClick: () => accountStore.portal(),
      loadingAuto: true,
    },
    {
      label: 'Facturación',
      color: 'primary',
      variant: 'soft',
      onClick: () => accountStore.cfdi(),
      target: '_blank',
      loadingAuto: true,
    }
  ]
})
</script>

<template>
  <template v-if="accountStore.isSubscribed">
    <UAlert icon="i-lucide-gem"
            variant="outline"
            title="Licencia activa"
            :description="`Se renueva el ${format(parseISO(accountStore.user!.subscription_renews_at), 'PPP')}`"
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

    <p class="space-y-2 text-center">
      <UButton @click="accountStore.checkout('year')" loading-auto :disabled="!accountStore.user" block
               :variant="accountStore.user ? 'solid' : 'ghost'">
        Licencia Profesional — $599/año
      </UButton>

      <span class="text-sm block">ó</span>

      <UButton @click="accountStore.checkout('month')" loading-auto :disabled="!accountStore.user" block
               :variant="accountStore.user ? 'outline' : 'ghost'">
        Licencia Profesional — $59/mes
      </UButton>
    </p>

    <p class="text-xs">Los precios mostrados están expresados en MXN e incluyen IVA.</p>
    <p class="text-xs">Puedes generar tu CFDI una vez realizado tu pago.</p>
  </template>


</template>

<style scoped>

</style>
