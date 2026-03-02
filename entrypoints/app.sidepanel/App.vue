<script lang="ts" setup>
import VaultCreate from '@/components/Vault/Create.vue'
import VaultLocked from '@/components/Vault/Locked.vue'
import VaultUnlocked from '@/components/Vault/Unlocked.vue'
import AccountLogin from "@/components/Account/Login.vue"
import AccountMenu from "@/components/Account/Menu.vue"
import SyncStatus from "@/components/Sync/Status.vue"
import AccountPromo from "@/components/Marketing/Promo.vue"
import AccountUpgrade from "@/components/Marketing/Upgrade.vue"
import { useDatabase} from "@/composables/database";
import { useNavigation} from "@/composables/navigation";
import BulkForm from "@/components/Bulk/Form.vue";

const {isInitialized, isUnlocked} = useDatabase()

const {isSubscribed} = useAccount()

const {view} = useNavigation()
</script>

<template>
  <UApp>
    <UDashboardPanel :ui="{ root: '' }">
      <template #header>
        <UDashboardNavbar title="Bóveda" icon="i-lucide-landmark" :toggle="false" :ui="{ title: 'text-base' }">
          <template #right v-if="isUnlocked">
            <AccountMenu/>
          </template>

          <template #right >
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

        <template v-else-if="isInitialized">
          <template v-if="isUnlocked">
            <VaultUnlocked/>
          </template>
          <template v-else>
            <VaultLocked/>
          </template>

          <Teleport to="#footer">
            <SyncStatus v-if="isSubscribed"/>
          </Teleport>
        </template>
        <template v-else>
          <VaultCreate/>
          <AccountLogin/>
        </template>
        <div class="mt-auto gap-4 flex flex-col" id="footer">

        </div>
      </template>
    </UDashboardPanel>
  </UApp>

</template>
