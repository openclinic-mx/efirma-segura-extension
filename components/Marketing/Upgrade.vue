<script setup lang="ts">
import AccountAuth from "@/components/Account/Auth.vue"
import AccountPayment from "@/components/Account/Payment.vue"
import AccountSync from "@/components/Account/Sync.vue"
import {useNavigationStore} from "@/stores/navigation";

const {navigate} = useNavigationStore()
</script>

<template>
  <article class="prose dark:prose-invert">
    <h2>Paso 1. Crea una cuenta</h2>

    <AccountAuth/>

    <h2>Paso 2. Activa tu licencia</h2>

    <AccountPayment/>

    <h2>Paso 3. Activa sincronización</h2>

    <AccountSync/>

    <Teleport to="#footer" defer>
      <UButton variant="ghost" block color="neutral" icon="i-lucide-arrow-left" @click="navigate('home')">
        Regresar
      </UButton>
    </Teleport>
  </article>
</template>

<style scoped>

</style>
