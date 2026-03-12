import {ref} from 'vue';

const view = ref('home')

export const useNavigation = () => {

    const navigate = (to: string)  => {
        view.value = to;
    }

    onMounted(() => {
        browser.runtime.onMessage.addListener(async (message) => {
            if (message.type === 'VIEW_ADD_SIGNATURE') {
                navigate('add')
            }
        })
    })

    return {
        view,
        navigate,
    }
}
