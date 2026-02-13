import { defineConfig } from 'wxt';
import ui from '@nuxt/ui/vite'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [
        ui()
    ]
  })
});
