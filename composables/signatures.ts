import {SignatureMeta} from "@/services/signatures";
import {readFileAsBase64} from "@/utils/files";

export const useSignatures = () => {

    const {isUnlocked} = useDatabase();

    const signatures = ref<SignatureMeta[]>([]);

    const refreshSignatures = async () => {
        if (isUnlocked.value) {
            const response = await browser.runtime.sendMessage({
                type: 'VAULT_LIST',
            })

            signatures.value = response.signatures
        } else {
            signatures.value = []
        }
    }

    watch(isUnlocked, refreshSignatures)

    onMounted(async () => {
        await refreshSignatures();

        browser.runtime.onMessage.addListener(async (message) => {
            if (message.type === 'VAULT_LIST_UPDATE') {
                await refreshSignatures();
            }
        })
    })

    const addSignature = async (name: string, cer: File, key: File, password: string) => {
        const response = await browser.runtime.sendMessage({
            type: 'VAULT_ADD',
            payload: {
                name: name,
                cer: await readFileAsBase64(cer),
                key: await readFileAsBase64(key),
                password: password,
            }
        })

        // signatures.value = response.signatures;

        return response;
    }

    const removeSignature = async (uuid: string) => {
        const response = await browser.runtime.sendMessage({
            type: 'VAULT_REMOVE',
            payload: {
                id: uuid,
            }
        })

        // signatures.value = response.signatures;

        return response
    }

    return {
        signatures,
        addSignature,
        removeSignature,
    }
}
