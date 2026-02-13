<script lang="ts" setup>
import {ref} from "vue";


const unlocked = ref(false);
</script>

<template>
  <UApp>

    <UDashboardPanel title="e.firma Segura" :ui="{ root: 'min-h-0' }">

      <template #header>
        <UDashboardNavbar title="e.firma Segura" icon="i-lucide-landmark" :toggle="false" :ui="{ title: 'text-base' }">
          <template #right>
            <div id="navBarRight">
              <UButton icon="i-lucide-lock" v-if="$router.ful" @click="unlocked = false" size="sm" variant="ghost">Cerrar</UButton>
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

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #54bc4ae0);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
