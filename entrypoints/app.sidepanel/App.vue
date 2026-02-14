<script lang="ts" setup>
import {ref} from "vue";

</script>

<template>
  <UApp>

    <UDashboardPanel title="e.firma Segura" :ui="{ root: '' }">

      <template #header>
        <UDashboardNavbar title="e.firma Segura" icon="i-lucide-landmark" :toggle="false" :ui="{ title: 'text-base' }">
          <template #right>
            <div id="navBarRight">
              <UButton icon="i-lucide-lock" v-if="$route.name === 'vault'" to="/" size="sm" variant="ghost">Cerrar</UButton>
            </div>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <RouterView />
      </template>
    </UDashboardPanel>
  </UApp>

</template>
