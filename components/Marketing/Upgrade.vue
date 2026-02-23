<script setup lang="ts">
import {useNavigation} from "@/composables/navigation";

const { navigate } = useNavigation()
</script>

<template>
  <article class="prose dark:prose-invert">
    <h2>Paso 1. Crea una cuenta</h2>

    <UButton block>Continuar con Google</UButton>

    <h2>Paso 2. Suscríbete a Profesional</h2>

    <UAlert icon="i-lucide-clock" variant="outline" title="Precio de introducción">
      <template #description>
        Solo quedan 37 espacios disponibles. <br> Después sube a $499.00 / año
      </template>
    </UAlert>

    <p>
      <UButton variant="outline" block>Subscribirme por solo $199.00 / año</UButton>
    </p>

    <h2>Paso 3. Solicita tu factura</h2>

    <UButton variant="outline" block>Solicitar factura</UButton>

    <Teleport to="#footer">
      <UButton variant="ghost" block color="neutral" icon="i-lucide-arrow-left" @click="navigate('home')">
        Regresar
      </UButton>
    </Teleport>
  </article>
</template>

<style scoped>

</style>
