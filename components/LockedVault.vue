<script lang="ts" setup>
import {reactive} from 'vue';


const state = reactive({
  password: ''
})


</script>

<template>
  <UPageCard title="Ingresa tu contraseña maestra para desbloquear." variant="naked">

    <form @submit.prevent="$emit('unlock')" class="contents">
      <UFormField label="Contraseña maestra" required size="xl" class="w-full">
        <UInput type="password" required class="block" placeholder="Mínimo 10 caracteres">
        </UInput>
      </UFormField>

      <UButton type="submit" block>Desbloquear</UButton>

      <UButton type="button" block variant="ghost" color="error">Reiniciar bóveda</UButton>
    </form>

  </UPageCard>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
