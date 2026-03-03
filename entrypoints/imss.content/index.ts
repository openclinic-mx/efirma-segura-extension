import {findCandidate, setFileInput, setTextInput} from "@/utils/autocomplete";

export default defineContentScript({
    matches: [
        "https://idse.imss.gob.mx/*",
        "https://serviciosdigitales.imss.gob.mx/*"
    ],

    allFrames: true,

    async main(ctx) {
        const ui = createIntegratedUi(ctx, {
            position: "inline",
            anchor: "body",
            onMount: (container) => {
                const signatureFormCer = findCandidate(['#certificado', '#inputCertificado']);
                const signatureFormKey = findCandidate(['#llave', '#inputKey']);
                const signatureFormPassword = findCandidate(['#password', '#inputPassword']);
                const signatureFormTaxId = findCandidate(['#idUsuario', '#inputRFC'])

                const trigger = document.createElement("button");
                trigger.type = 'button';
                trigger.classList.add('btn', 'btn-success', 'boton')
                trigger.style.marginRight = '1rem'
                trigger.textContent = "Autocompletar";



                const anchor = document.querySelector('#botonFirma')
                ?? document.querySelector('#botonValidarCert')

                if (signatureFormCer && signatureFormKey && signatureFormPassword && signatureFormTaxId) {
                    if (!anchor) {
                        return;
                    }

                    browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
                        const {taxId, cer, key, password, submit} = message.payload

                        if (message.type !== 'AUTOCOMPLETE_ACTION') {
                            return;
                        }

                        if ((signatureFormCer instanceof HTMLInputElement)
                            && (signatureFormKey instanceof HTMLInputElement)
                            && (signatureFormPassword instanceof HTMLInputElement)
                            && (signatureFormTaxId instanceof  HTMLInputElement)
                        ) {

                            setFileInput(signatureFormCer, readBase64AsFile(cer, 'signature.cer', 'application/x-x509-ca-cert'))

                            setFileInput(signatureFormKey, readBase64AsFile(key, 'signature.key', 'application/octet-stream'))

                            setTextInput(signatureFormPassword, password)

                            setTextInput(signatureFormTaxId, taxId)

                            sendResponse({
                                error: null
                            })

                            if (submit) {
                                await new Promise((resolve) => setTimeout(resolve, 500))

                                const submitButton = document.querySelector<HTMLButtonElement>('#botonValidarCert')
                                    ?? document.querySelector<HTMLButtonElement>('#botonFirma')

                                if (submitButton) {
                                    window.addEventListener("pagehide", (e) => {
                                        browser.runtime.sendMessage({type: 'CLOSE_TAB'})
                                    });
                                    submitButton.click()
                                }
                            }
                        } else {
                            sendResponse({
                                error: 'Form not found',
                            })
                        }

                        return true;
                    })

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
