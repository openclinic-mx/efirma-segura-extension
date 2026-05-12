<script lang="ts" setup>
import VaultCreate from '@/components/Vault/Create.vue'
import VaultLocked from '@/components/Vault/Locked.vue'
import VaultUnlocked from '@/components/Vault/Unlocked.vue'
import AccountLogin from "@/components/Account/Login.vue"
import AccountMenu from "@/components/Account/Menu.vue"
import SyncStatus from "@/components/Sync/Status.vue"
import AccountPromo from "@/components/Marketing/Promo.vue"
import AccountUpgrade from "@/components/Marketing/Upgrade.vue"
import {useNavigation} from "@/composables/navigation";
import {usePort} from "@/composables/port";
import {useDatabaseStore} from "@/stores/database";
import {useAccountStore} from "@/stores/account";
import {storeToRefs} from "pinia";

const databaseStore = useDatabaseStore()

const accountStore = useAccountStore()

const {view} = useNavigation()

const {isUnlocked} = storeToRefs(databaseStore)

usePort(isUnlocked)
</script>

<template>
  <UApp>
    <UDashboardPanel :ui="{ root: '' }">
      <template #header>
        <UDashboardNavbar title="Bóveda" icon="i-lucide-landmark" :toggle="false" :ui="{ title: 'text-base' }">
          <template #right v-if="databaseStore.isUnlocked">
            <AccountMenu/>
          </template>

          <template #right>
            <AccountMenu/>
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <div id="header" class="empty:hidden">
        </div>

        <template v-if="view === 'promo'">
          <AccountPromo/>
        </template>

        <template v-else-if="view === 'upgrade'">
          <AccountUpgrade/>
        </template>

        <template v-else-if="databaseStore.isInitialized">
          <template v-if="databaseStore.isUnlocked">
            <VaultUnlocked/>
          </template>
          <template v-else>
            <VaultLocked/>
          </template>

          <Teleport to="#footer" defer>
            <SyncStatus v-if="accountStore.isSubscribed"/>
          </Teleport>
        </template>
        <template v-else>
          <VaultCreate/>
          <Teleport to="#footer" defer>
            <AccountLogin/>
          </Teleport>
        </template>
        <div class="mt-auto gap-4 flex flex-col" id="footer">
        </div>
      </template>
    </UDashboardPanel>
  </UApp>

</template>
