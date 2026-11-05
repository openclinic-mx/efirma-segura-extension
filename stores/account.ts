import {defineStore} from "pinia"
import {computed, onMounted, ref} from "vue"
import {onMessage, sendMessage} from "@/messaging"
import {User} from "@/services/account";
import {useSignaturesStore} from "@/stores/signatures";
import {browser} from "wxt/browser";

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

            const isEdge = navigator.userAgent.includes('Edg');

            if (isEdge) {
                const params = new URLSearchParams();
                params.append('client_id', import.meta.env.WXT_OAUTH2_ALT_CLIENT_ID);
                params.append('redirect_uri', browser.identity.getRedirectURL());
                params.append('response_type', 'token');
                params.append('scope', 'openid email profile');

                browser.identity.launchWebAuthFlow({
                    url: `https://accounts.google.com/o/oauth2/auth?${params.toString()}`,
                    ...options,
                }, (responseUrl) => {
                    if (!responseUrl) {
                        resolve(null)
                        return;
                    }
                    const hashInUrl = new URL(responseUrl)
                    const fragment = hashInUrl.hash.slice(1)
                    const params = new URLSearchParams(fragment)
                    resolve(params.get('access_token'))
                })
            } else {
                browser.identity.getAuthToken(options, (accessToken) => {
                    resolve(accessToken as string)
                });
            }
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
            return null;
        }

        toast.add({
            title: `Bienvenid@ de vuelta`,
            description: `${response.user?.name}`,
            color: 'success'
        })

        return response.user
    }

    const checkout = async (type: 'year' | 'month') => {
        try {
            const {checkout_url} = await sendMessage('ACCOUNT_CHECKOUT', type)

            window.open(checkout_url, '_blank')
        } catch (e) {
            toast.add({
                title: 'No se pudo cargar el enlace de pago.',
                description: e instanceof Error ? e.message : undefined,
                color: 'error'
            })
        }
    }

    const portal = async () => {
        try {
            const {portal_url} = await sendMessage('ACCOUNT_PORTAL')

            window.open(portal_url, '_blank')
        } catch (e) {
            toast.add({
                title: 'No se pudo cargar el enlace de pago.',
                description: e instanceof Error ? e.message : undefined,
                color: 'error'
            })
        }
    }

    const cfdi = async () => {
        try {
            const {cfdi_url} = await sendMessage('ACCOUNT_CFDI')

            window.open(cfdi_url, '_blank')
        } catch (e) {
            toast.add({
                title: 'No se pudo cargar el enlace de facturación.',
                description: e instanceof Error ? e.message : undefined,
                color: 'error'
            })
        }
    }

    const logout = async () => {
        try {
            await sendMessage('ACCOUNT_LOGOUT')
        } catch (e) {
            // the background signs out of this browser anyway
            toast.add({
                title: 'Cerraste sesión en este navegador.',
                description: `No pudimos cerrar la sesión en el servidor. ${e instanceof Error ? e.message : ''}`,
                color: 'warning'
            })
        }
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