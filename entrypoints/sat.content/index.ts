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
        "https://*.sat.gob.mx/*",
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
                        trySubmitForm()
                    }

                    return true;
                }

                const tryRenderTriggerWithNavigation = () => {
                    const trigger = tryRenderTrigger([
                        '#contrasena',
                        '#submit',
                        '#btnValidaOSCP'
                    ]);

                    const passwordForm = document.querySelector('#IDPLogin');

                    if (passwordForm && trigger) {
                        trigger.addEventListener('click', () => {
                            const navigateToSignatureLogin = passwordForm.querySelector<HTMLButtonElement>('#buttonFiel')

                            if (navigateToSignatureLogin) {
                                navigateToSignatureLogin.click()
                            }
                        })

                        return;
                    }
                }

                const observer = new MutationObserver(() => tryRenderTriggerWithNavigation());

                observer.observe(document.body, {childList: true, subtree: true});

                tryRenderTriggerWithNavigation();

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
    const {cer, key, password, submit} = message.payload

    const signatureFormCer = findCandidate([
        '#localCertificate',
        '#fileCertificate',
        '#certificate'
    ]);
    const signatureFormKey = findCandidate([
        '#localPrivateKey',
        '#filePrivateKey',
        '#privateKey'
    ]);
    const signatureFormPassword = findCandidate([
        '#localPassword',
        '#privateKeyPassword'
    ]);

    if ((signatureFormCer instanceof HTMLInputElement)
        && (signatureFormKey instanceof HTMLInputElement)
        && (signatureFormPassword instanceof HTMLInputElement)) {
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

    if (submit) {
        trySubmitForm(['#submit'])
    }
}
