import {defineConfig} from 'wxt';
import ui from '@nuxt/ui/vite'

// See https://wxt.dev/api/config.html
export default defineConfig({
    modules: [
        '@wxt-dev/module-vue',
        '@wxt-dev/auto-icons'
    ],
    manifest: () => ({
        permissions: ['storage', 'alarms'],
        optional_permissions: ['identity'],
        name: 'e.firma Segura',
        key: import.meta.env.WXT_MANIFEST_KEY,
        oauth2: {
            client_id: import.meta.env.WXT_OAUTH2_CLIENT_ID,
            scopes: ['openid', 'email', 'profile'],
        },
        action: {
            default_title: "Da clic para mostrar tu bóveda"
        },
    }),
    vite: () => ({
        plugins: [
            ui({
                router: false,
            })
        ]
    }),
    webExt: {
        startUrls: [
            // Declaraciones
            "https://pstcdypisr.clouda.sat.gob.mx/",
            // CertiSAT
            "https://aplicacionesc.mat.sat.gob.mx/certisat/",
            // Buzón
            "https://wwwmat.sat.gob.mx/personas/iniciar-sesion",
            // Comprobantes
            "https://wwwmat.sat.gob.mx/consultas/operacion/42968/consulta-y-recuperacion-de-comprobantes-(nuevo)",
            // IMSS
            "https://idse.imss.gob.mx/imss/",
        ],
        chromiumArgs: [
            '--user-data-dir=./.wxt/chrome-data',
            // https://github.com/wxt-dev/wxt/issues/1890
            '--disable-blink-features=AutomationControlled'
        ],
    },
    // https://github.com/wxt-dev/wxt/issues/1272
    hooks: {
        'build:manifestGenerated': (wxt, manifest) => {
            // @ts-ignore
            delete manifest.side_panel;
        },
    },
});
