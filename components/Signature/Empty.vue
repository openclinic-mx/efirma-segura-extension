<script setup lang="ts">

import {useNavigationStore} from "@/stores/navigation";

const {navigate} = useNavigationStore()

const actions = [
  {
    icon: 'i-lucide-plus',
    label: 'Agregar e.firma',
    color: 'primary',
    onClick: () => {
      navigate('add')
    }
  }
]

</script>

<template>
  <UEmpty variant="naked" icon="i-lucide-key" title="No tienes e.firmas guardadas"
          :actions="actions"
  />
</template>
