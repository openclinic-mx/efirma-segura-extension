<script lang="ts" setup>
import SignatureAdd from "@/components/Signature/Add.vue"
import SignatureEmpty from "@/components/Signature/Empty.vue"
import SignatureList from "@/components/Signature/List.vue"
import {useSignatures} from "@/composables/signatures";

const {view} = useNavigation()

const { signatures } = useSignatures()
</script>

<template>
  <SignatureAdd v-if="view === 'add'"/>

  <template v-if="view === 'home'">
    <SignatureList :signatures="signatures" v-if="signatures.length"/>
    <SignatureEmpty class="my-auto" v-else/>
  </template>
</template>
