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
        "https://*.sat.gob.mx/*",
    ],

    allFrames: true,

    async main(ctx) {
        const ui = createIntegratedUi(ctx, {
            position: "inline",
            anchor: "body",
            onMount: (container) => {
                const remove = onMessage('AUTOCOMPLETE_ACTION', (message) => {
                    const error = handleAutocompleteAction(message.data)

                    if (!error && message.data.submit) {
                        trySubmitForm(
                            import.meta.env.WXT_SAT_FORM_SUBMIT.split("|")
                        )
                    }

                    return {error};
                })

                const tryRenderTriggerWithNavigation = () => {
                    const trigger = tryRenderTrigger(
                        import.meta.env.WXT_SAT_FORM_ANCHOR.split("|")
                    );

                    if (!trigger) {
                        return;
                    }

                    trigger.addEventListener('click', () => {
                        const navigateToSignatureLogin = findCandidate<HTMLButtonElement>([
                            '#buttonFiel',
                        ])

                        if (navigateToSignatureLogin) {
                            navigateToSignatureLogin.click()
                        }
                    })
                }

                const observer = new MutationObserver(() => tryRenderTriggerWithNavigation());

                observer.observe(document.body, {childList: true, subtree: true});

                tryRenderTriggerWithNavigation();

                ctx.onInvalidated(() => {
                    observer.disconnect()
                    remove();
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
    submit: boolean,
}) => {
    const {cer, key, password} = action

    const signatureFormCer = findCandidate(
        import.meta.env.WXT_SAT_FORM_CER.split("|")
    );

    const signatureFormKey = findCandidate(
        import.meta.env.WXT_SAT_FORM_KEY.split("|")
    );
    const signatureFormPassword = findCandidate(
        import.meta.env.WXT_SAT_FORM_PASSWORD.split("|")
    );

    if ((signatureFormCer instanceof HTMLInputElement)
        && (signatureFormKey instanceof HTMLInputElement)
        && (signatureFormPassword instanceof HTMLInputElement)) {
        //
    } else {
        return 'Formulario no encontrado';
    }

    setFileInput(signatureFormCer, readBase64AsFile(cer, 'signature.cer', 'application/x-x509-ca-cert'))

    setFileInput(signatureFormKey, readBase64AsFile(key, 'signature.key', 'application/octet-stream'))

    setTextInput(signatureFormPassword, password)

    return null;
}
