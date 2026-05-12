import {createApp} from 'vue';
import './style.css';
import App from './App.vue';
import ui from '@nuxt/ui/vue-plugin'
import { createHead } from '@unhead/vue/client'
import { es } from 'date-fns/locale'
import {setDefaultOptions} from "date-fns";
import {createPinia} from "pinia";

setDefaultOptions({ locale: es })

const head = createHead()

const pinia = createPinia()

// Disable unhead tinkering with inline scripts
head.hooks.hook('tags:resolve', (ctx) => {
    ctx.tags = ctx.tags.filter((t) => t.tag !== 'style' && t.tag !== 'script')
})


createApp(App)
    .use(pinia)
    .use(head)
    .use(ui)
    .mount('#app');
