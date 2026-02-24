import {useSignatures} from "@/composables/signatures";
import {computed, onMounted, ref} from "vue";
import {User} from "@/services/account";


export const useAccount = () => {
    const toast = useToast()

    const user = ref<null | User>(null)

    onMounted(async () => {
        user.value = await browser.runtime.sendMessage({type: 'ACCOUNT_STATUS'})

        browser.runtime.onMessage.addListener((message) => {
            if (message.type === 'ACCOUNT_STATUS_UPDATE') {
                user.value = message.payload;
            }
        })
    })

    const isLoggedIn = computed(() => {
        return user.value !== null
    })

    const isSubscribed = computed(() => {
        return user.value?.is_subscribed ?? false
    })

    const {signatures} = useSignatures()

    const limitReached = computed(() => {
        if (isSubscribed.value) {
            return false;
        }

        return signatures.value.length >= 3
    })

    const requestPermission = async () => {
        return new Promise((resolve) => {
            browser.permissions.request({
                permissions: ['identity'],
            }, (granted) => {
                resolve(granted)
            });
        })
    }

    const getGoogleToken = async () => {
        const options = {
            interactive: true,
        }

        return new Promise<Browser.identity.GetAuthTokenResult>((resolve, reject) => {
            browser.identity.getAuthToken(options, (accessToken) => {
                resolve(accessToken)
            });
        })
    }
    const signIn = async () => {

        const granted = requestPermission()

        if (!granted) {
            toast.add({
                title: 'No se obtuvo permiso para obtener tu identidad.',
                color: 'error'
            })
            return null;
        }

        const result = await getGoogleToken()

        if (!result) {
            toast.add({
                title: 'No se obtuvo tu identidad',
                color: 'error'
            })
            return null;
        }

        const response: { error: string | null, user: User | null } = await browser.runtime.sendMessage({
            type: 'ACCOUNT_AUTH',
            payload: {
                google_token: result
            }
        })

        if (response.error) {
            toast.add({
                title: 'No se pudo iniciar sesion',
                color: 'error'
            })
        }

        return response.user
    }

    const checkout = async () => {
        const response: { checkout_url: string } = await browser.runtime.sendMessage({
            type: 'ACCOUNT_CHECKOUT'
        })

        window.open(response.checkout_url, '_blank')
    }

    const logout = () => {
        browser.runtime.sendMessage({type: 'ACCOUNT_LOGOUT'})
    }

    return {
        user,
        isLoggedIn,
        isSubscribed,
        limitReached,
        signIn,
        logout,
        checkout
    }
}
