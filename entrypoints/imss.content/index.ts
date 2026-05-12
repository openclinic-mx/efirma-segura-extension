import {
    findCandidate,
    setFileInput,
    setTextInput,
    TRIGGER_SELECTOR,
    tryRenderTrigger,
    trySubmitForm
} from "@/utils/autocomplete";
import {onMessage} from "@/messaging";

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
                const remove = onMessage('AUTOCOMPLETE_ACTION', async (message) => {
                    const error = handleAutocompleteAction(message.data)

                    if (!error && message.data.submit) {
                        trySubmitForm(
                            import.meta.env.WXT_IMSS_FORM_SUBMIT.split("|")
                        )
                    }

                    return {
                        error
                    };
                })

                const imssTrigger = () => {
                    const trigger = tryRenderTrigger(
                        import.meta.env.WXT_IMSS_FORM_ANCHOR.split("|")
                    )

                    if (trigger) {
                        // IMSS doesn't space the element accordingly
                        trigger.style.marginRight = '1rem'
                    }
                }

                const observer = new MutationObserver(() => imssTrigger());

                observer.observe(document.body, {childList: true, subtree: true});

                imssTrigger();

                ctx.onInvalidated(() => {
                    observer.disconnect()
                    remove()
                    document.querySelector(TRIGGER_SELECTOR)?.remove();
                });
            },
        });

        ui.mount();
    },
});

const handleAutocompleteAction = (action: {
    taxId: string,
    cer: string,
    key: string,
    password: string,
}) => {
    const signatureFormCer = findCandidate(
        import.meta.env.WXT_IMSS_FORM_CER.split("|")
    );
    const signatureFormKey = findCandidate(
        import.meta.env.WXT_IMSS_FORM_KEY.split("|")
    );
    const signatureFormPassword = findCandidate(
        import.meta.env.WXT_IMSS_FORM_PASSWORD.split("|")
    );
    const signatureFormTaxId = findCandidate(
        import.meta.env.WXT_IMSS_FORM_TAX_ID.split("|")
    )

    const {taxId, cer, key, password} = action

    if ((signatureFormCer instanceof HTMLInputElement)
        && (signatureFormKey instanceof HTMLInputElement)
        && (signatureFormPassword instanceof HTMLInputElement)
    ) {
        //
    } else {
        return 'Formulario no encontrado'
    }

    setFileInput(signatureFormCer, readBase64AsFile(cer, 'signature.cer', 'application/x-x509-ca-cert'))

    setFileInput(signatureFormKey, readBase64AsFile(key, 'signature.key', 'application/octet-stream'))

    setTextInput(signatureFormPassword, password)

    if (signatureFormTaxId instanceof HTMLInputElement) {
        setTextInput(signatureFormTaxId, taxId)
    }

    return null
}
