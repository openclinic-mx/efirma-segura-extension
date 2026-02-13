import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import ui from '@nuxt/ui/vue-plugin'

createApp(App)
    .use(ui)
    .mount('#app');
