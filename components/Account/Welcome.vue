<script setup lang="ts">
const {isLoggedIn, user} = useAccount()
</script>

<template>
  <UAlert
      v-if="isLoggedIn"
      color="primary"
      variant="naked"
      :title="`Buenas tardes ${user?.name}`"
      icon="i-lucide-sparkles"
  />
</template>
