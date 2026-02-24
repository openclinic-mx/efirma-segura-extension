<script setup lang="ts">
import {useNavigation} from "@/composables/navigation";
import AccountAuth from "@/components/Account/Auth.vue"
import AccountPayment from "@/components/Account/Payment.vue"
import AccountSync from "@/components/Account/Sync.vue"

const {navigate} = useNavigation()
</script>

<template>
  <article class="prose dark:prose-invert">
    <h2>Paso 1. Crea una cuenta</h2>

    <AccountAuth/>

    <h2>Paso 2. Subscríbete</h2>

    <AccountPayment/>

    <h2>Paso 3. Activa sincronización</h2>

    <AccountSync/>

    <Teleport to="#footer">
      <UButton variant="ghost" block color="neutral" icon="i-lucide-arrow-left" @click="navigate('home')">
        Regresar
      </UButton>
    </Teleport>
  </article>
</template>

<style scoped>

</style>
