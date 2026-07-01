<script setup lang="ts">
import {format, formatDistanceToNow} from "date-fns"
import {SignatureMeta} from "@/services/signature";

const props = defineProps<{
  signature: SignatureMeta
}>()

</script>

<template>
  <article class="prose dark:prose-invert">
    <dl>
      <dt class="mt-0">Razón social</dt>
      <dd>{{ signature.legalName }}</dd>
      <dt>RFC</dt>
      <dd>{{ signature.rfc }}</dd>
      <dt>Expira {{ formatDistanceToNow(signature.expiredAt, {addSuffix: true}) }}</dt>
      <dd>
        {{ format(signature.expiredAt, 'PPP') }}
      </dd>
      <dt>Emisión {{ formatDistanceToNow(signature.issuedAt, {addSuffix: true}) }}</dt>
      <dd>
        {{ format(signature.issuedAt, 'PPP') }}
      </dd>
      <dt>Numero de serie</dt>
      <dd>
        {{ signature.serialNumber }}
      </dd>
    </dl>
  </article>
</template>
