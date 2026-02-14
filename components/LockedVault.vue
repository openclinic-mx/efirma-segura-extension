<script lang="ts" setup>
import {reactive} from 'vue';


const state = reactive({
  password: ''
})


</script>

<template>
  <UPageCard title="Ingresa tu contraseña maestra para desbloquear." variant="naked" class="my-auto">
    <form @submit.prevent="$router.replace({ name: 'vault' })" class="contents">
      <UFormField label="Contraseña maestra" required size="xl" class="w-full">
        <UInput type="password" required class="block" autofocus placeholder="Mínimo 10 caracteres">
        </UInput>
      </UFormField>

      <UButton type="submit" block>Desbloquear</UButton>
    </form>
  </UPageCard>

  <UButton type="button" block variant="ghost" color="error">Reiniciar bóveda</UButton>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
