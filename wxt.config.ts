import {defineConfig} from 'wxt';
import ui from '@nuxt/ui/vite'

// See https://wxt.dev/api/config.html
export default defineConfig({
    modules: ['@wxt-dev/module-vue'],
    manifest: {
        permissions: ['storage'],
        name: 'e.firma Segura',
    },
    vite: () => ({
        plugins: [
            ui({
                router: false
            })
        ]
    }),
    webExt: {
        startUrls: [
            "https://pstcdypisr.clouda.sat.gob.mx/",
            "https://wwwmat.sat.gob.mx/personas/iniciar-sesion"
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
