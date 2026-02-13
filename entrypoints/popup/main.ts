import {createApp} from 'vue';
import './style.css';
import App from './App.vue';
import ui from '@nuxt/ui/vue-plugin'
import {createMemoryHistory, createRouter} from 'vue-router'

import LockedVault from '@/components/LockedVault.vue';
import AddSignature from '@/components/AddSignature.vue';
import OpenVault from "@/components/OpenVault.vue";


const router = createRouter({
    routes: [
        {
            path: '/',
            component: LockedVault,
        },
        {
            path: '/vault',
            name: 'vault',
            component: OpenVault,
        },
        {
            path: '/vault/signatures/create',
            name: 'vault-signatures-create',
            component: AddSignature,
        }
    ],
    history: createMemoryHistory()
})

createApp(App)
    .use(router)
    .use(ui)
    .mount('#app');
