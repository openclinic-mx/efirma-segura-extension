import {readBytesAsBase64} from "@/utils/files";
import {SignatureService} from "@/services/signature";

export class AutocompleteService {

    private events = new EventTarget();

    private signatureService: SignatureService

    constructor(signatureService: SignatureService) {
        this.signatureService = signatureService;
    }

    onRequest(handler: () => void) {
        this.events.addEventListener("request", handler);
    }

    async request(message: any): Promise<{ error: string | null }> {
        this.events.dispatchEvent(new Event("request"));

        const id = message.payload.id;
        const tabId = message.payload.tabId;
        const submit = message.payload.submit;

        try {
            const signature = await this.signatureService.getSignature(id);

            if (!signature) {
                return {
                    error: 'Signature not found',
                }
            }

            if (!tabId) {
                return {
                    error: 'Need a tab id to autocomplete',
                }
            }

            const response = await browser.tabs.sendMessage(tabId, {
                type: 'AUTOCOMPLETE_ACTION',
                payload: {
                    taxId: signature.rfc,
                    password: signature.password,
                    cer: readBytesAsBase64(signature.cer),
                    key: readBytesAsBase64(signature.key),
                    submit: submit
                }
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
