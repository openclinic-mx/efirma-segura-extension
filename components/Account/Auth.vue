<script setup lang="ts">
import {useAccountStore} from "@/stores/account";

const accountStore = useAccountStore()

const handleContinue = () => {
  return accountStore.signIn()
};
</script>

<template>
  <template v-if="accountStore.isLoggedIn">
    <UAlert icon="i-lucide-user" color="primary" variant="outline" :title="`Hola ${accountStore.user?.name}!`" :actions="[
      {
        label: 'Cerrar sesión',
        color: 'primary',
        variant: 'soft',
        onClick: accountStore.logout
      }
    ]"></UAlert>
  </template>
  <template v-else>
    <UButton block @click="handleContinue" loading-auto>Continuar con Google</UButton>

    <p class="text-xs ">Al crear una cuenta aceptas el <a target="_blank" href="https://efirmasegura.com/aviso-de-privacidad">Aviso de privacidad</a> y los <a target="_blank" href="https://efirmasegura.com/terminos-y-condiciones">Términos y condiciones</a>.</p>
  </template>
</template>
