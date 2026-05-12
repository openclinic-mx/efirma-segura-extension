import {readBytesAsBase64} from "@/utils/files";
import {SignatureService} from "@/services/signature";
import {sendMessage} from "@/messaging";

export class AutocompleteService {

    private events = new EventTarget();

    private signatureService: SignatureService

    constructor(signatureService: SignatureService) {
        this.signatureService = signatureService;
    }

    onRequest(handler: () => void) {
        this.events.addEventListener("request", handler);
    }

    async request(request: {
        id: string
        tabId: number,
        submit: boolean,
    }): Promise<{ error: string | null }> {
        this.events.dispatchEvent(new Event("request"));

        try {
            const signature = await this.signatureService.getSignature(request.id);

            if (!signature) {
                return {
                    error: 'Signature not found',
                }
            }

            if (!request.tabId) {
                return {
                    error: 'Need a tab id to autocomplete',
                }
            }

            const response = await sendMessage('AUTOCOMPLETE_ACTION', {
                taxId: signature.rfc,
                password: signature.password,
                cer: readBytesAsBase64(signature.cer),
                key: readBytesAsBase64(signature.key),
                submit: request.submit
            }, {
                tabId: request.tabId,
            })

            return {
                error: response.error,
            }
        } catch (e) {
            console.error(e)
            return {
                error: 'Algo salio mal. Intenta abrir tu bóveda de nuevo.',
            }
        }

    }

}
