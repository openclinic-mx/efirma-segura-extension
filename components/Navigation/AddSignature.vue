<script setup lang="ts">
import AccountLimit from "@/components/Account/Limit.vue";
import {useAccountStore} from "@/stores/account";
import {useNavigationStore} from "@/stores/navigation";
import {storeToRefs} from "pinia";

const navigationStore = useNavigationStore()
const {navigate} = navigationStore
const {view} = storeToRefs(navigationStore)
const accountStore = useAccountStore()
</script>

<template>
  <template v-if="accountStore.limitReached">
    <AccountLimit>
      <UButton icon="i-lucide-gem"
               variant="ghost"
      >
        <span class="text-nowrap">Nueva e.firma</span>
      </UButton>
    </AccountLimit>
  </template>

  <template v-else>
    <UButton @click="navigate('add')"
             icon="i-lucide-plus"
             variant="ghost"
             :disabled="view === 'add'"
    >
      <span class="text-nowrap">Nueva e.firma</span>
    </UButton>
  </template>
</template>