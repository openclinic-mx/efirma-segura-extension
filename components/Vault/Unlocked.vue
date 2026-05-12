<script lang="ts" setup>
import SignatureAdd from "@/components/Signature/Add.vue"
import SignatureEmpty from "@/components/Signature/Empty.vue"
import SignatureList from "@/components/Signature/List.vue"
import AccountSubscribe from "@/components/Marketing/Subscribe.vue";
import VaultAutoLock from "@/components/Vault/AutoLock.vue";
import {useNavigation} from "@/composables/navigation";
import {useSignaturesStore} from "@/stores/signatures";
import {useAccountStore} from "@/stores/account";

const {view, navigate} = useNavigation()

const signaturesStore = useSignaturesStore()

const accountStore = useAccountStore()
</script>

<template>
  <SignatureAdd v-if="view === 'add'"/>

  <template v-else-if="view === 'home'">
    <SignatureList :signatures="signaturesStore.signatures" v-if="signaturesStore.signatures.length"/>
    <SignatureEmpty class="my-auto" v-else/>

    <Teleport to="#footer" defer>
      <AccountSubscribe v-if="!accountStore.isSubscribed"/>
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

  <Teleport to="#footer" defer>
    <VaultAutoLock class="order-last"/>
  </Teleport>

</template>
