<script setup lang="ts">
import {useAccountStore} from "@/stores/account";

const accountStore = useAccountStore()
</script>

<template>
  <UAlert
      v-if="accountStore.isLoggedIn"
      color="primary"
      variant="naked"
      :title="`Buenas tardes ${accountStore.user?.name}`"
      icon="i-lucide-sparkles"
  />
</template>
