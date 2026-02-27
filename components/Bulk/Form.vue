<script setup lang="ts">
import {useBulk} from "@/composables/bulk";
import {getSignatureFolders} from "@/utils/dataTransfer";

const {parse} = useBulk()

const onDrop = async (e: DragEvent) => {
  const folders = await getSignatureFolders(e)

  parse(folders)
}
</script>

<template>
  <div @drop.prevent="onDrop">
    <UFileUpload
        :preview="false"
        :interactive="false"
        description="Arrastra y suelta tu carpeta de e.firmas aquí"
    >
    </UFileUpload>
  </div>

</template>

<style scoped>

</style>
