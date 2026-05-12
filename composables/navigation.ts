import {ref} from 'vue';
import {onMessage} from "@/messaging";

const view = ref('home')

onMessage('VIEW_ADD_SIGNATURE', () => {
    navigate('add')
})

const navigate = (to: string)  => {
    view.value = to;
}

export const useNavigation = () => {
    return {
        view,
        navigate,
    }
}
