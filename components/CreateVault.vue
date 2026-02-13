<script lang="ts" setup>
import {reactive} from 'vue';


const state = reactive({
  password: ''
})


</script>

<template>


  <UPageCard title="Crea una contraseña maestra para proteger tu(s) e.firma(s)." variant="naked" >

    <form @submit="" class="contents">
      <UFormField label="Contraseña maestra" required size="xl" class="w-full">
        <UInput type="password" required class="block" placeholder="Mínimo 10 caracteres">
        </UInput>
      </UFormField>

      <UFormField label="Confirmar contraseña" required size="xl" class="w-full">
        <UInput type="password" required class="block" placeholder="Repite tu contraseña">
        </UInput>
      </UFormField>

      <UButton type="submit" block>Crear bóveda</UButton>
    </form>

  </UPageCard>
</template>
