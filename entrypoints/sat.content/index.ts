import {setFileInput, setTextInput} from "@/utils/autocomplete";

export default defineContentScript({
    matches: [
        "https://login.siat.sat.gob.mx/*",
        "https://loginda.siat.sat.gob.mx/*",
    ],

    allFrames: true,

    cssInjectionMode: "ui",

    async main(ctx) {
        const ui = createIntegratedUi(ctx, {
            position: "inline",
            anchor: "body",
            onMount: (container) => {
                const passwordForm = document.querySelector('#IDPLogin');

                const signatureFormCer = document.querySelector('#fileCertificate');
                const signatureFormKey = document.querySelector('#filePrivateKey');
                const signatureFormPassword = document.querySelector('#privateKeyPassword');

                const trigger = document.createElement("button");
                trigger.type = 'button';
                trigger.classList.add('btn', 'btn-success')
                trigger.textContent = "Autocompletar";

                browser.runtime.onMessage.addListener(async (message) => {
                    const {cer, key, password, submit} = message.payload

                    if (signatureFormCer && signatureFormKey && signatureFormPassword) {

                        if (signatureFormCer instanceof HTMLInputElement) {
                            setFileInput(signatureFormCer, readBase64AsFile(cer, 'signature.cer', 'application/x-x509-ca-cert'))
                        }


                        if (signatureFormKey instanceof HTMLInputElement) {
                            setFileInput(signatureFormKey, readBase64AsFile(key, 'signature.key', 'application/octet-stream'))
                        }

                        if (signatureFormPassword instanceof HTMLInputElement) {
                            setTextInput(signatureFormPassword, password)
                        }

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
                        return;
                    }
                })


                if (passwordForm) {
                    const anchor = passwordForm.querySelector('#buttonFiel')
                    if (!anchor) {
                        return;
                    }
                    // anchor.parentNode!.prepend(trigger)
                    //
                    // trigger.addEventListener('click', () => {
                    //     browser.runtime.sendMessage({type: 'OPEN_TAB'})
                    //
                    //     if (anchor) {
                    //         console.log('Clicking fiel');
                    //         anchor.click();
                    //     }
                    // })

                    return;
                } else if (signatureFormCer && signatureFormKey && signatureFormPassword) {
                    const anchor = document.querySelector('#contrasena')
                    if (!anchor) {
                        return;
                    }
                    anchor.parentNode!.prepend(trigger)

                    trigger.addEventListener('click', () => {
                        browser.runtime.sendMessage({type: 'TOGGLE_TAB'})
                    })
                    return;
                } else {

                }
            },
        });

        ui.mount();
    },
});
