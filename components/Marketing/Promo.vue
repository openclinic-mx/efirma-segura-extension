<script setup lang="ts">
import {ButtonProps} from "@nuxt/ui/components/Button.vue";
import { useNavigation } from "@/composables/navigation";

const { navigate } = useNavigation()

const links = ref<ButtonProps[]>([
  {
    label: 'Actualizar a Profesional',
    icon: 'i-lucide-gem',
    color: 'primary',
    onClick: () => {
      navigate('upgrade')
    }
  },
])

const features = [
  {
    icon: 'i-lucide-zap',
    title: 'Entra al SAT sin manejar archivos',
    description: 'Olvídate de conectar el USB o buscar la carpeta correcta. Selecciona el cliente, autentica y sigue trabajando.',
  },
  {
    icon: 'i-lucide-lock',
    title: 'Tus e.firmas dejan de andar sueltas',
    description: 'CER, KEY y contraseña se guardan en una bóveda cifrada que solo tú puedes abrir con tu contraseña maestra. Sin archivos expuestos a cyber ataques en tu disco duro, red local o nube.',
  },
  {
    icon: 'i-lucide-infinity',
    title: 'Cambia de cliente en segundos',
    description: 'Gestiona decenas de e.firmas desde un solo lugar. Sin copiar y pegar contraseñas. Cada credencial organizada y lista para operar.',
  },
  {
    icon: 'i-lucide-cloud-check',
    title: 'Opera desde cualquier equipo',
    description: 'Inicia sesión en otro navegador y tus e.firmas están ahí. La bóveda viaja cifrada; nosotros almacenamos los datos pero no podemos ver su contenido.',
  }
]
</script>

<template>
  <div>
    <UPageSection
        id="features"
        title="Administra todas tus e.firmas en un solo lugar"
        :links="links"
        :features="features"
        :ui="{ container: 'py-4'}"
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
