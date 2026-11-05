import {sendMessage} from "@/messaging";
import {useToast} from "@nuxt/ui/composables";
import {extractionLifetimeMinutes} from "@/services/extraction";

export const useExtraction = () => {

    const toast = useToast()

    // Must be called from a click handler: permissions.request needs a user gesture,
    // and Firefox rejects it if anything is awaited before it.
    const extract = async (signatureId: string) => {
        try {
            const granted = await browser.permissions.request({permissions: ['downloads']})

            if (!granted) {
                throw new Error('Necesitamos permiso para descargar los archivos.')
            }

            const response = await sendMessage('VAULT_EXTRACT', signatureId)

            if (response.error !== null) {
                throw new Error(response.error)
            }

            toast.add({
                title: 'Archivos colocados en tu carpeta de descargas',
                description: `Los eliminaremos en ${extractionLifetimeMinutes} minutos o al bloquear tu bóveda, lo que suceda primero.`,
                color: 'primary',
                actions: [{
                    label: 'Mostrar archivos',
                    icon: 'i-lucide-folder-open',
                    color: 'primary',
                    variant: 'soft',
                    // opens the file manager with the file selected
                    onClick: () => browser.downloads.show(response.downloadIds[0]),
                }],
            })
        } catch (e) {
            toast.add({
                title: 'No pudimos extraer los archivos.',
                description: e instanceof Error ? e.message : undefined,
                color: 'error'
            })
        }
    }

    return {
        extract,
    }
}
