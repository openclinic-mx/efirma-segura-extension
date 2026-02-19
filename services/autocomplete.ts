import {readBytesAsBase64} from "@/utils/files";
import {SignatureService} from "@/services/signature";
import {AutoLockService} from "@/services/autoLock";

export class AutocompleteService {

    private signatureService: SignatureService
    private autoLockService: AutoLockService;

    constructor(signatureService: SignatureService, autoLockService: AutoLockService) {
        this.signatureService = signatureService;
        this.autoLockService = autoLockService;
    }

    async request(message: any): Promise<{ error: string | null }> {
        this.autoLockService.resetTimer()

        const id = message.payload.id;
        const tabId = message.payload.tabId;
        const submit = message.payload.submit;

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

        try {
            const response = await browser.tabs.sendMessage(tabId, {
                type: 'AUTOCOMPLETE_ACTION',
                payload: {
                    password: signature.password,
                    cer: readBytesAsBase64(signature.cer),
                    key: readBytesAsBase64(signature.key),
                    submit: submit
                }
            })

            return {
                error: response.success ? null : 'Could not autocomplete',
            }
        } catch (e) {
            console.error(e)
            return {
                error: 'Something went wrong',
            }
        }

    }

}
