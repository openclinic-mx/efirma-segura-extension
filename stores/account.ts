import {defineStore} from "pinia"
import {computed, onMounted, ref} from "vue"
import {onMessage, sendMessage} from "@/messaging"
import {User} from "@/services/account";
import {useSignaturesStore} from "@/stores/signatures";

export const useAccountStore = defineStore("account", () => {
    const toast = useToast()

    const user = ref<null | User>(null)

    onMounted(async () => {
        user.value = await sendMessage('ACCOUNT_STATUS')
        onMessage('ACCOUNT_STATUS_UPDATE', message => {
            user.value = message.data;
        })
    })

    const isLoggedIn = computed(() => {
        return user.value !== null
    })

    const isSubscribed = computed(() => {
        return user.value?.is_subscribed ?? false
    })

    const signaturesStore = useSignaturesStore()

    const limitReached = computed(() => {
        if (isSubscribed.value) {
            return false;
        }

        return signaturesStore.signatures.length >= 3
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

        return new Promise<string | null>((resolve, reject) => {

            if (!browser.identity) {
                resolve(null)
                return;
            }

            browser.identity.getAuthToken(options, (accessToken) => {
                resolve(accessToken as string)
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

        const response = await sendMessage('ACCOUNT_AUTH', result)

        if (response.error) {
            toast.add({
                title: 'No hemos podido autenticarte.',
                description: `Favor de intentar de nuevo. (${response.error})`,
                color: 'error'
            })
        }

        toast.add({
            title: `Bienvenid@ de vuelta`,
            description: `${response.user?.name}`,
            color: 'success'
        })

        return response.user
    }

    const checkout = async () => {
        const response = await sendMessage('ACCOUNT_CHECKOUT')

        if (!response) {
            toast.add({
                title: 'No se pudo cargar el enlace de pago.',
                description: 'Favor de intentar de nuevo.',
                color: 'error'
            })
            return;
        }

        window.open(response.checkout_url, '_blank')
    }

    const portal = async () => {
        const response = await sendMessage('ACCOUNT_PORTAL')

        if (!response) {
            toast.add({
                title: 'No se pudo cargar el enlace de pago.',
                description: 'Favor de intentar de nuevo.',
                color: 'error'
            })
            return;
        }

        window.open(response.portal_url, '_blank')
    }

    const cfdi = async () => {
        const response = await sendMessage('ACCOUNT_CFDI')

        if (!response) {
            toast.add({
                title: 'No se pudo cargar el enlace de facturación.',
                description: 'Favor de intentar de nuevo.',
                color: 'error'
            })
            return;
        }

        window.open(response.cfdi_url, '_blank')
    }

    const logout = () => {
        return sendMessage('ACCOUNT_LOGOUT')
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
})