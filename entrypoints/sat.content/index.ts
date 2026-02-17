import {findCandidate, setFileInput, setTextInput} from "@/utils/autocomplete";

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
                const passwordForm = document.querySelector('#IDPLogin');

                const signatureFormCer = findCandidate(['#fileCertificate']);
                const signatureFormKey = findCandidate(['#filePrivateKey']);
                const signatureFormPassword = findCandidate(['#privateKeyPassword']);

                const trigger = document.createElement("button");
                trigger.type = 'button';
                trigger.classList.add('btn', 'btn-success')
                trigger.textContent = "Autocompletar";

                browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
                    const {cer, key, password, submit} = message.payload

                    if ((signatureFormCer instanceof HTMLInputElement)
                        && (signatureFormKey instanceof HTMLInputElement)
                        && (signatureFormPassword instanceof HTMLInputElement)) {

                        setFileInput(signatureFormCer, readBase64AsFile(cer, 'signature.cer', 'application/x-x509-ca-cert'))

                        setFileInput(signatureFormKey, readBase64AsFile(key, 'signature.key', 'application/octet-stream'))

                        setTextInput(signatureFormPassword, password)

                        sendResponse({
                            success: true
                        })

                        if (submit) {
                            await new Promise((resolve) => setTimeout(resolve, 500))

                            const submit = document.querySelector('#submit')

                            if (submit) {
                                submit.click()
                                window.addEventListener("pagehide", (e) => {
                                    browser.runtime.sendMessage({type: 'CLOSE_TAB'})
                                });
                            }
                        }
                    } else {
                        sendResponse({
                            success: false
                        })
                    }

                    return true;
                })

                const anchor = document.querySelector('#contrasena') ?? document.querySelector('#submit')

                if (passwordForm) {
                    const automation = passwordForm.querySelector('#buttonFiel')

                    if (!automation) {
                        return;
                    }

                    if (!anchor) {
                        return;
                    }

                    anchor.parentNode!.prepend(trigger)

                    trigger.addEventListener('click', () => {
                        browser.runtime.sendMessage({type: 'OPEN_TAB'})

                        if (automation) {
                            automation.click();
                        }
                    })

                    return;
                } else if (signatureFormCer && signatureFormKey && signatureFormPassword) {
                    if (!anchor) {
                        return;
                    }

                    anchor.parentNode!.prepend(trigger)

                    trigger.addEventListener('click', () => {
                        browser.runtime.sendMessage({type: 'TOGGLE_TAB'})
                    })
                    return;
                } else {
                    //
                }
            },
        });

        ui.mount();
    },
});
