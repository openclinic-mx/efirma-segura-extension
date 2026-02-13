<script lang="ts" setup>
import {reactive} from 'vue';


const state = reactive({
  password: ''
})


</script>

<template>
  <UEmpty variant="naked" icon="i-lucide-key" title="No tienes e.firmas guardadas"/>

  <UButton type="submit" block @click="$router.replace({ name: 'vault-signatures-create' })">Agregar e.firma</UButton>
</template>
