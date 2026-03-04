import {
    findCandidate,
    setFileInput,
    setTextInput,
    TRIGGER_SELECTOR,
    tryRenderTrigger,
    trySubmitForm
} from "@/utils/autocomplete";
import {Browser} from "@wxt-dev/browser";

export default defineContentScript({
    matches: [
        "https://*.imss.gob.mx/*",
    ],

    allFrames: true,

    async main(ctx) {
        const ui = createIntegratedUi(ctx, {
            position: "inline",
            anchor: "body",
            onMount: (container) => {
                const listener = (message: any, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) => {
                    if (message.type !== 'AUTOCOMPLETE_ACTION') {
                        return;
                    }

                    handleAutocompleteAction(message, sendResponse)

                    if (message.payload.submit) {
                        trySubmitForm([
                            '#botonValidarCert',
                            '#botonFirma',
                            '#btnFirmaNoApplet'
                        ])
                    }

                    return true;
                }

                browser.runtime.onMessage.addListener(listener)

                const imssTrigger = () => tryRenderTrigger([
                    '#inputFirma',
                    '#botonFirma',
                    '#botonValidarCert',
                    '#btnFirmaNoApplet',
                ])

                const observer = new MutationObserver(() => imssTrigger());

                observer.observe(document.body, {childList: true, subtree: true});

                imssTrigger();

                ctx.onInvalidated(() => {
                    observer.disconnect()
                    browser.runtime.onMessage.removeListener(listener)
                    document.querySelector(TRIGGER_SELECTOR)?.remove();
                });
            },
        });

        ui.mount();
    },
});

const handleAutocompleteAction = (message: any, sendResponse: (response?: any) => void) => {
    const signatureFormCer = findCandidate([
        '#localCertificate',
        '#certificado',
        '#inputCertificado'
    ]);
    const signatureFormKey = findCandidate([
        '#localPrivateKey',
        '#llave',
        '#inputKey'
    ]);
    const signatureFormPassword = findCandidate([
        '#localPassword',
        '#password',
        '#inputPassword'
    ]);
    const signatureFormTaxId = findCandidate([
        '#localRFC',
        '#idUsuario',
        '#inputRFC'
    ])

    const {taxId, cer, key, password} = message.payload

    if ((signatureFormCer instanceof HTMLInputElement)
        && (signatureFormKey instanceof HTMLInputElement)
        && (signatureFormPassword instanceof HTMLInputElement)
    ) {
        //
    } else {
        sendResponse({
            error: 'Form not found',
        })
        return
    }

    setFileInput(signatureFormCer, readBase64AsFile(cer, 'signature.cer', 'application/x-x509-ca-cert'))

    setFileInput(signatureFormKey, readBase64AsFile(key, 'signature.key', 'application/octet-stream'))

    setTextInput(signatureFormPassword, password)

    if (signatureFormTaxId instanceof HTMLInputElement) {
        setTextInput(signatureFormTaxId, taxId)
    }

    sendResponse({
        error: null
    })
}
