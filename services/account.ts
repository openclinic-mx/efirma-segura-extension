import {StorageService} from "@/services/storage";
import {instance} from "@/utils/axios";

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
        const token = await this.token();

        if (!token) {
            return;
        }

        const { data: { data } } = await instance.get<{ data: User }>('/api/v1/auth/user')

        await this.storage.write('user', data)

        return this.#broadcastStatus()
    }

    async auth(message: any) {

        const google_token = message.payload.google_token;

        if (!google_token) {
            return {
                user: null,
                error: 'Missing google token',
            }
        }


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
    }

    async checkout() {
        const token = await this.token();

        if (!token) {
            return;
        }

        const {data} = await instance.post<{ checkout_url: string }>('/api/v1/subscription/checkout')

        return data;
    }

    async portal() {
        const token = await this.token();

        if (!token) {
            return;
        }

        const {data} = await instance.post<{ portal_url: string }>('/api/v1/subscription/portal')

        return data;
    }

    async #logout() {
        const token = await this.token();

        if (!token) {
            return {
                error: 'Not logged in',
            };
        }

        const response = await fetch(this.baseUrl() + '/api/v1/auth/logout', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (!response.ok) {
            return {
                error: 'Backend error',
            }
        }

        const payload: { message: string } = await response.json()

        return payload
    }

    async clear() {
        await this.#logout()
        await this.storage.clear('token')
        await this.storage.clear('user')
        this.events.dispatchEvent(new Event("logout"));
        return this.#broadcastStatus()
    }

    token() {
        return this.storage.read<string>('token') ?? null
    }

    user() {
        return this.storage.read<User>('user')
    }

    async #broadcastStatus() {
        const user = await this.user();

        browser.runtime.sendMessage({
            type: 'ACCOUNT_STATUS_UPDATE',
            payload: user
        })

        return user
    }
}
