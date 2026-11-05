import {sendMessage} from "@/messaging";
import {useToast} from "@nuxt/ui/composables";

export const usePasswordCopy = () => {

    const toast = useToast()

    // Must be called from a click handler: navigator.clipboard needs the
    // side panel to be focused and to have a recent user gesture.
    const copyPassword = async (signatureId: string) => {
        try {
            const response = await sendMessage('VAULT_PASSWORD', signatureId)

            if (response.error !== null) {
                throw new Error(response.error)
            }

            await navigator.clipboard.writeText(response.password)

            toast.add({
                title: 'Contraseña copiada',
                color: 'primary'
            })
        } catch (e) {
            toast.add({
                title: 'No pudimos copiar la contraseña.',
                description: e instanceof Error ? e.message : undefined,
                color: 'error'
            })
        }
    }

    return {
        copyPassword,
    }
}
