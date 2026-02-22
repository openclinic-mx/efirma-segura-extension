<script setup lang="ts">
import {ButtonProps} from "@nuxt/ui/components/Button.vue";

const links = ref<ButtonProps[]>([
  {
    label: 'Actualizar a Profesional',
    icon: 'i-lucide-gem',
    color: 'primary'
  },
])

const { navigate } = useNavigation()
</script>

<template>
  <div>
    <UPageSection
        id="features"
        title="Administra todas tus e.firmas en un solo lugar"
        :links="links"
        :features="[{
        icon: 'i-lucide-lock',
        title: 'Más seguro que un USB',
        description: 'Protege las credenciales de tus clientes y empresas con seguridad bancaria AES-256',
      }, {
        icon: 'i-lucide-cloud-check',
        title: 'Accede en cualquier lugar',
        description: 'Sincroniza de forma segura tu bóveda en todos tus dispositivos',
      }, {
        icon: 'i-lucide-zap',
        title: 'Accede con un solo clic',
        description: 'Inicia sesión en las aplicaciones web del SAT con un solo clic',
      }
      ]"
        :ui="{ container: 'py-8'}"
    />
  </div>

  <Teleport to="#footer">
    <UButton variant="ghost" block color="neutral" icon="i-lucide-arrow-left" @click="navigate('home')">
      Regresar
    </UButton>
  </Teleport>
</template>

<style scoped>

</style>
