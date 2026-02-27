<script setup lang="ts">
import {useBulk} from "@/composables/bulk";
import {getSignatureFolders} from "@/utils/dataTransfer";
import {useToast} from "@nuxt/ui/composables";
import {useNavigation} from "@/composables/navigation";

const {parse} = useBulk()

const { navigate } = useNavigation()

const toast = useToast()

const onDrop = async (e: DragEvent) => {
  const folders = await getSignatureFolders(e)

  const response: {ids: string[] | null, error: null | string} = await parse(folders)

  if (response.ids && response.ids.length) {
    toast.add({
      color: 'primary',
      title: `${response.ids.length} e.firma(s) agregada(s)`,
    })

    navigate('home')
  } else {
    toast.add({
      color: 'error',
      title: `Algo salio mal`
    })
  }

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
