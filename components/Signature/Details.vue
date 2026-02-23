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
      <dt class="mt-0">Nombre legal</dt>
      <dd>{{ signature.legalName }}</dd>
      <dt>RFC</dt>
      <dd>{{ signature.rfc }}</dd>
      <dt>Expiración</dt>
      <dd>
        {{ formatDistanceToNow(signature.expiredAt, {addSuffix: true}) }}, <br>
        {{ format(signature.expiredAt, 'PPP') }}
      </dd>
      <dt>Emisión</dt>
      <dd>
        {{ formatDistanceToNow(signature.issuedAt, {addSuffix: true}) }}, <br>
        {{ format(signature.issuedAt, 'PPP') }}
      </dd>
    </dl>
  </article>
</template>
