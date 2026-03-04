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
        description: "Gestor seguro de e.firmas del SAT con autocompletado",
        key: import.meta.env.WXT_MANIFEST_KEY,
        oauth2: {
            client_id: import.meta.env.WXT_OAUTH2_CLIENT_ID,
            scopes: ['openid', 'email', 'profile'],
        }
    }),
    vite: () => ({
        plugins: [
            ui({
                router: false,
            })
        ]
    }),
    webExt: {
        startUrls: import.meta.env.WXT_START_URLS.split("|"),
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
