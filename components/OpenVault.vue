<script lang="ts" setup>
import {reactive} from 'vue';
import SignatureList from "./SignatureList.vue";


const state = reactive({
  password: ''
})

const actions = [
  {
    icon: 'i-lucide-plus',
    label: 'Agregar e.firma',
    color: 'success',
    to: {name: 'vault-signatures-create', replace: true},
  }
]
</script>

<template>

  <template v-if="true">
    <SignatureList/>
  </template>


  <UEmpty v-else variant="naked" class="my-auto" icon="i-lucide-key" title="No tienes e.firmas guardadas"
          :actions="actions"
  />


</template>
