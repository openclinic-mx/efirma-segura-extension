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

    const requestPermission = () => {
        return new Promise<boolean>((resolve) => {
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

        return new Promise<Browser.identity.GetAuthTokenResult | null>((resolve, reject) => {

            if (!browser.identity) {
                resolve(null)
                return;
            }

            browser.identity.getAuthToken(options, (accessToken) => {
                resolve(accessToken)
            });
        })
    }
    const signIn = async () => {

        const granted = await requestPermission()

        if (!granted) {
            toast.add({
                title: 'No obtuvimos permisos para obtener tu identidad.',
                description: 'Favor de intentar de nuevo.',
                color: 'error'
            })
            return null;
        }

        const result = await getGoogleToken()

        if (!result) {
            toast.add({
                title: 'No se completo el proceso de autenticación.',
                description: 'Favor de intentar de nuevo.',
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
                title: 'No hemos podido autenticarte.',
                description: 'Favor de intentar de nuevo.',
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

    const portal = async () => {
        const response: { portal_url: string } = await browser.runtime.sendMessage({
            type: 'ACCOUNT_PORTAL'
        })

        window.open(response.portal_url, '_blank')
    }

    const cfdi = async () => {
        const response: { cfdi_url: string } = await browser.runtime.sendMessage({
            type: 'ACCOUNT_CFDI'
        })

        window.open(response.cfdi_url, '_blank')
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
        checkout,
        portal,
        cfdi,
    }
}
