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
                trigger.addEventListener('click', () => {
                    browser.runtime.sendMessage({source: 'ui', type: 'autocomplete'})
                })

                if (passwordForm) {
                    // browser.runtime.sendMessage({source: 'ui', type: 'enableTab'})

                    const anchor = passwordForm.querySelector('#buttonFiel')
                    if (!anchor) {
                        return;
                    }
                    anchor.parentNode!.prepend(trigger)
                    return;
                } else if (signatureFormCer && signatureFormKey && signatureFormPassword) {
                    // browser.runtime.sendMessage({source: 'ui', type: 'enableTab'})
                    const anchor = document.querySelector('#contrasena')
                    if (!anchor) {
                        return;
                    }
                    anchor.parentNode!.prepend(trigger)
                    return;
                } else {
                    // browser.runtime.sendMessage({source: 'ui', type: 'disableTab'})
                }
            },
        });

        ui.mount();
    },
});
