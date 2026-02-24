<script setup lang="ts">
import {useAccount} from "@/composables/account";

const {signIn, isLoggedIn, user, logout} = useAccount()
</script>

<template>
  <template v-if="isLoggedIn">
    <UAlert icon="i-lucide-user" color="primary" variant="outline" :title="`Hola ${user?.name}!`" :actions="[
      {
        label: 'Cerrar sesión',
        color: 'primary',
        variant: 'soft',
        onClick: logout
      }
    ]"></UAlert>
  </template>
  <template v-else>
    <UButton block @click="signIn" loading-auto>Continuar con Google</UButton>
  </template>
</template>
