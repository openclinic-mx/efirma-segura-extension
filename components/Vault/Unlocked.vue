<script lang="ts" setup>
import SignatureAdd from "@/components/Signature/Add.vue"
import SignatureEmpty from "@/components/Signature/Empty.vue"
import SignatureList from "@/components/Signature/List.vue"
import AccountPromo from "@/components/Account/Promo.vue"
import {useSignatures} from "@/composables/signatures";
import AccountSubscribe from "@/components/Account/Subscribe.vue";
import VaultAutoLock from "@/components/Vault/AutoLock.vue";

const {view} = useNavigation()

const { signatures } = useSignatures()
</script>

<template>
  <SignatureAdd v-if="view === 'add'"/>

  <template v-if="view === 'home'">
    <SignatureList :signatures="signatures" v-if="signatures.length"/>
    <SignatureEmpty class="my-auto" v-else/>
  </template>

  <AccountPromo v-if="view === 'promo'"/>

  <Teleport to="#footer">
    <AccountSubscribe v-if="view !== 'promo'"/>
    <VaultAutoLock/>
  </Teleport>

</template>
