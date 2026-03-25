import {
    findCandidate,
    setFileInput,
    setTextInput,
    TRIGGER_SELECTOR,
    tryRenderTrigger,
    trySubmitForm
} from "@/utils/autocomplete";
import {Browser} from "wxt/browser";


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

                    const filled = handleAutocompleteAction(message, sendResponse)

                    if (filled && message.payload.submit) {
                        trySubmitForm(
                            import.meta.env.WXT_SAT_FORM_SUBMIT.split("|")
                        )
                    }

                    return true;
                }

                browser.runtime.onMessage.addListener(listener)

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
        sendResponse({
            error: 'Form not found',
        })
        return false;
    }

    setFileInput(signatureFormCer, readBase64AsFile(cer, 'signature.cer', 'application/x-x509-ca-cert'))

    setFileInput(signatureFormKey, readBase64AsFile(key, 'signature.key', 'application/octet-stream'))

    setTextInput(signatureFormPassword, password)

    sendResponse({
        error: null
    })

    return true;
}
