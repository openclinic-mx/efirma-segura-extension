<script lang="ts" setup>
import SignatureAdd from "@/components/Signature/Add.vue"
import SignatureEmpty from "@/components/Signature/Empty.vue"
import SignatureList from "@/components/Signature/List.vue"
import AccountSubscribe from "@/components/Marketing/Subscribe.vue";
import VaultAutoLock from "@/components/Vault/AutoLock.vue";
import SyncStatus from "@/components/Sync/Status.vue";
import {useSignatures} from "@/composables/signatures";
import {useNavigation} from "@/composables/navigation";

const {view, navigate} = useNavigation()

const {signatures} = useSignatures()

const {isSubscribed} = useAccount()
</script>

<template>
  <SignatureAdd v-if="view === 'add'"/>

  <template v-else-if="view === 'home'">
    <SignatureList :signatures="signatures" v-if="signatures.length"/>
    <SignatureEmpty class="my-auto" v-else/>

    <Teleport to="#footer">
      <AccountSubscribe v-if="!isSubscribed"/>
    </Teleport>
  </template>

  <template v-else>
    <UError
        :error="{
      statusCode: 404,
      statusMessage: 'Pagina no encontrada',
      message: 'La pagina que buscas no existe'
    }"
    >
      <template #links>
        <UButton @click="navigate('home')">Regresar al inicio</UButton>
      </template>
    </UError>
  </template>

  <Teleport to="#footer">
    <VaultAutoLock class="order-last"/>
  </Teleport>

</template>
