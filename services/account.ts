import {StorageService} from "@/services/storage";

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

    baseUrl() {
        return import.meta.env.WXT_BACKEND;
    }

    async fetch() {
        const token = await this.token();

        if (!token) {
            return;
        }

        const response = await fetch(this.baseUrl() + '/api/v1/auth/user', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (!response.ok) {
            if (response.status === 401) {
                return this.clear()
            } else {
                return;
            }
        }

        const payload: { data: User } = await response.json()

        await this.storage.write('user', payload.data
        )
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

        const response = await fetch(this.baseUrl() + '/api/v1/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({google_token})
        })

        if (!response.ok) {
            return {
                user: null,
                error: 'Backend error',
            }
        }

        const payload: { user: User, token: string } = await response.json()

        await this.storage.write('token', payload.token)
        await this.storage.write('user', payload.user)

        this.#broadcastStatus()

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

        const response = await fetch(this.baseUrl() + '/api/v1/subscription/checkout', {
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

        const payload: { checkout_url: string } = await response.json()

        return payload
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
