<script setup lang="ts">

import {useNavigation} from "@/composables/navigation";


const {navigate} = useNavigation()
</script>

<template>
  <UModal title="Limite alcanzado" >
    <slot></slot>

    <template #body>
      <article class="prose dark:prose-invert">
        <p>Haz alcanzado el limite de e.firmas que puedes agregar en la version gratuita.</p>

        <p>Para poder administrar mas e.firmas necesitas actualizar al plan Profesional.</p>
      </article>
    </template>

    <template #footer>
      <div class="flex flex-col gap-4 w-full">
        <UButton block color="primary" @click="navigate('upgrade')" icon="i-lucide-gem">Actualizar a Profesional</UButton>
        <UButton block color="neutral" icon="i-lucide-info" variant="ghost" @click="navigate('promo')">Más información
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>

</style>
