<script setup lang="ts">
import {useNavigation} from "#imports";

const { navigate} = useNavigation()

const messages = [
    "¿Necesitas más e.firmas?",
    "¿Te gustaría sincronizar tu bóveda?"
]
</script>

<template>
  <UButton block variant="ghost" icon="i-lucide-sparkles" @click="navigate('promo')">
    {{ messages[1] }}
  </UButton>
</template>

<style scoped>

</style>
