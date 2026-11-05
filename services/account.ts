import {StorageService} from "@/services/storage";
import {instance} from "@/utils/axios";
import {sendMessage} from "@/messaging";
import {BackendError} from "@/utils/backend";

export type User = {
    avatar: string,
    name: string,
    created_at: string,
    id: number,
    email: string,
    is_on_grace_period: boolean,
    is_on_trial: boolean,
    has_vault: boolean,
    is_subscribed: boolean,
    subscription_ends_at: string,
    subscription_renews_at: string
}

export class AccountService {

    private events = new EventTarget();

    private storage: StorageService;

    constructor(storage: StorageService) {
        this.storage = storage;

        this.installInterceptors();
    }

    installInterceptors() {
        instance.interceptors.request.use(async (config) => {
            const token = await this.token();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });
    }

    onLogout(handler: () => void) {
        this.events.addEventListener("logout", handler);
    }

    onLogin(handler: () => void) {
        this.events.addEventListener("login", handler);
    }

    baseUrl() {
        return import.meta.env.WXT_BACKEND;
    }

    async fetch() {
        await this.requireToken();

        const {data: {data}} = await instance.get<{ data: User }>('/api/v1/auth/user')

        await this.storage.write('user', data)

        return this.#broadcastStatus()
    }

    // for refreshes nobody waits on: if the backend fails, the cached user is kept
    async refresh() {
        try {
            await this.fetch()
        } catch (e) {
            if (!(e instanceof BackendError)) {
                throw e
            }
        }
    }

    async auth(google_token: string) {

        try {
            const {data: payload} = await instance.post<{
                user: User,
                token: string
            }>('/api/v1/auth/google', {google_token})

            await this.storage.write('token', payload.token)
            await this.storage.write('user', payload.user)

            this.#broadcastStatus()

            this.events.dispatchEvent(new Event("login"));

            return {
                user: payload.user,
                error: null,
            }
        } catch (e) {
            return {
                user: null,
                error: e instanceof Error ? e.message : 'Unexpected error'
            }
        }




    }

    async checkout(type: 'month' | 'year') {
        await this.requireToken();

        const {data} = await instance.post<{ checkout_url: string }>('/api/v1/subscription/checkout', {
            type,
        })

        return data;
    }

    async portal() {
        await this.requireToken();

        const {data} = await instance.post<{ portal_url: string }>('/api/v1/subscription/portal')

        return data;
    }

    async cfdi() {
        await this.requireToken();

        const {data} = await instance.post<{ cfdi_url: string }>('/api/v1/subscription/cfdi')

        return data;
    }

    async clear() {
        try {
            if (await this.token()) {
                await instance.post('/api/v1/auth/logout')
            }
        } finally {
            // signs out of this browser even when the session could not be revoked in the backend
            await this.storage.clear('token')
            await this.storage.clear('user')
            this.events.dispatchEvent(new Event("logout"));
            await this.#broadcastStatus()
        }
    }

    async requireToken(): Promise<string> {
        const token = await this.token();

        if (!token) {
            throw new BackendError('unauthorized', {message: 'Inicia sesión para continuar.'})
        }

        return token
    }

    token() {
        return this.storage.read<string>('token') ?? null
    }

    user() {
        return this.storage.read<User>('user')
    }

    async #broadcastStatus() {
        const user = await this.user();

        sendMessage('ACCOUNT_STATUS_UPDATE', user)

        return user
    }
}
