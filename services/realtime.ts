import Echo from 'laravel-echo';
import Pusher from 'pusher-js/worker'
import {AccountService} from "@/services/account";
import {instance} from "@/utils/axios";

export class RealtimeService {
    private account: AccountService;

    private events = new EventTarget();

    #echo: Echo<'reverb'> | null = null;

    constructor(account: AccountService) {
        this.account = account;

        this.installInterceptors();
    }

    installInterceptors() {
        instance.interceptors.request.use(async (config) => {
            config.headers['X-Socket-ID'] = this.socketId();
            return config;
        });
    }

    socketId() {
        return this.#echo?.socketId() ?? null;
    }

    async startListening() {
        if (this.#echo) {
            return;
        }

        const user = await this.account.user()
        const token = await this.account.token()

        if (!user || !token) {
            return;
        }

        this.#echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.WXT_REVERB_APP_KEY,
            wsHost: import.meta.env.WXT_REVERB_HOST,
            wsPort: import.meta.env.WXT_REVERB_PORT ?? 80,
            wssPort: import.meta.env.WXT_REVERB_PORT ?? 443,
            forceTLS: (import.meta.env.WXT_REVERB_SCHEME ?? 'https') === 'https',
            enabledTransports: ['ws', 'wss'],

            authEndpoint: `${this.account.baseUrl()}/broadcasting/auth`,
            auth: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },

            Pusher,

            activityTimeout: 20000,
        });

        this.#echo
            .private(`App.Models.User.${user.id}`)
            .listen('User\\SubscriptionUpdated', (e: any) => {
                this.events.dispatchEvent(new Event("subscription"))
            })
            .listen('User\\VaultUpdated', (e: any) => {
                this.events.dispatchEvent(new Event("vault"))
            })
    }

    onVault(handler: () => void) {
        this.events.addEventListener("vault", handler);
    }

    onSubscription(handler: () => void) {
        this.events.addEventListener("subscription", handler)
    }

    stopListening() {
        if (this.#echo) {
            this.#echo.disconnect()
            this.#echo = null;
        }
    }
}
