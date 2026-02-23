import {createApp} from 'vue';
import './style.css';
import App from './App.vue';
import ui from '@nuxt/ui/vue-plugin'
import { createHead } from '@unhead/vue/client'
import { es } from 'date-fns/locale'
import {setDefaultOptions} from "date-fns";

setDefaultOptions({ locale: es })

const head = createHead()

// Disable unhead tinkering with inline scripts
head.hooks.hook('tags:resolve', (ctx) => {
    ctx.tags = ctx.tags.filter((t) => t.tag !== 'style' && t.tag !== 'script')
})


createApp(App)
    .use(head)
    .use(ui)
    .mount('#app');
