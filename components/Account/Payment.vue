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
    <UAlert icon="i-lucide-clock" variant="outline" title="Precio de introducción">
      <template #description>
        Solo quedan 16 espacios disponibles,<br>después sube a $499.00 / año
      </template>
    </UAlert>

    <p>
      <UButton @click="checkout" loading-auto :disabled="!user" block :variant="user ? 'solid' : 'outline'">Subscribirme
        por sólo $199.00 / año
      </UButton>
    </p>
  </template>


</template>

<style scoped>

</style>
