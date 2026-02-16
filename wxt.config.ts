import {defineConfig} from 'wxt';
import ui from '@nuxt/ui/vite'

// See https://wxt.dev/api/config.html
export default defineConfig({
    modules: ['@wxt-dev/module-vue'],
    manifest: {
        permissions: ['storage'],
        name: 'e.firma Segura',
        description: "Gestor seguro de e.firmas del SAT con autocompletado"
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
            // Declaraciones
            "https://pstcdypisr.clouda.sat.gob.mx/",
            // CertiSAT
            "https://aplicacionesc.mat.sat.gob.mx/certisat/",
            // Buzón
            "https://wwwmat.sat.gob.mx/personas/iniciar-sesion",
            // Comprobantes
            "https://wwwmat.sat.gob.mx/consultas/operacion/42968/consulta-y-recuperacion-de-comprobantes-(nuevo)",
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
