import {defineStore} from "pinia"
import {ref} from "vue"
import {onMessage} from "@/messaging";

export const useNavigationStore = defineStore("navigation", () => {

    const view = ref('home')

    const navigate = (to: string)  => {
        console.log('navigate', to)
        view.value = to;

        console.log({ view: view.value })
    }

    onMessage('VIEW_ADD_SIGNATURE', () => {
        navigate('add')
    })

    return {
        view,
        navigate
    }

})