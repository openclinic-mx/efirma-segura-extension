<script lang="ts" setup>
import SignatureAdd from "@/components/Signature/Add.vue"
import SignatureEmpty from "@/components/Signature/Empty.vue"
import SignatureList from "@/components/Signature/List.vue"
import AccountPromo from "@/components/Marketing/Promo.vue"
import AccountUpgrade from "@/components/Marketing/Upgrade.vue"
import {useSignatures} from "@/composables/signatures";
import AccountSubscribe from "@/components/Marketing/Subscribe.vue";
import VaultAutoLock from "@/components/Vault/AutoLock.vue";

const {view} = useNavigation()

const {signatures} = useSignatures()
</script>

<template>
  <SignatureAdd v-if="view === 'add'"/>

  <template v-if="view === 'home'">
    <SignatureList :signatures="signatures" v-if="signatures.length"/>
    <SignatureEmpty class="my-auto" v-else/>

    <Teleport to="#footer">
      <AccountSubscribe/>
    </Teleport>
  </template>

  <AccountPromo v-if="view === 'promo'"/>

  <AccountUpgrade v-if="view === 'upgrade'"/>

  <Teleport to="#footer">
    <VaultAutoLock class="order-last"/>
  </Teleport>

</template>
