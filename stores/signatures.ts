import { defineStore } from "pinia"
import {onMounted, ref, watch} from "vue"
import { onMessage, sendMessage } from "@/messaging"
import {useDatabaseStore} from "@/stores/database";
import {SignatureMeta} from "@/services/signature";
import {readFileAsBase64} from "@/utils/files";

export const useSignaturesStore = defineStore("signatures", () => {
    const databaseStore = useDatabaseStore()

    const signatures = ref<SignatureMeta[]>([]);

    const refreshSignatures = async () => {
        if (databaseStore.isUnlocked) {
            const response = await sendMessage('VAULT_LIST')
            signatures.value = response.signatures
        } else {
            signatures.value = []
        }
    }

    watch(() => databaseStore.isUnlocked, refreshSignatures)

    onMounted(async () => {
        await refreshSignatures();
        onMessage('VAULT_LIST_UPDATE', message => {
            signatures.value = message.data.signatures;
        })
    })

    const addSignature = async (name: string, cer: File, key: File, password: string) => {
        return sendMessage('VAULT_ADD', {
            name: name,
            cer: await readFileAsBase64(cer),
            key: await readFileAsBase64(key),
            password: password,
        })
    }

    const addSignatures = async (signatures: { name: string, cer: File, key: File, password: string }[]) => {
        return sendMessage('VAULT_ADD_MANY', await Promise.all(signatures.map(async signature => {
            return {
                name: signature.name,
                cer: await readFileAsBase64(signature.cer),
                key: await readFileAsBase64(signature.key),
                password: signature.password,
            }
        })))
    }


    const removeSignature = async (uuid: string) => {
        return sendMessage('VAULT_REMOVE', uuid)
    }

    return {
        signatures,
        addSignature,
        addSignatures,
        removeSignature,
    }
})
