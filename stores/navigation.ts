import {defineStore} from "pinia"
import {ref} from "vue"
import {onMessage} from "@/messaging";

export const useNavigationStore = defineStore("navigation", () => {

    const view = ref('home')

    const navigate = (to: string)  => {
        view.value = to;
    }

    onMessage('VIEW_ADD_SIGNATURE', () => {
        navigate('add')
    })

    return {
        view,
        navigate
    }

})