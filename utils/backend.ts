import axios from "axios";

export type BackendErrorKind = 'offline' | 'unauthorized' | 'server'

export type BackendFailure = {
    kind: BackendErrorKind,
    message: string,
}

const messages: Record<BackendErrorKind, string> = {
    offline: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
    unauthorized: 'Tu sesión expiró. Inicia sesión de nuevo.',
    server: 'El servidor no pudo completar la solicitud. Intenta de nuevo más tarde.',
}

export class BackendError extends Error {
    readonly kind: BackendErrorKind

    readonly status: number | null

    constructor(kind: BackendErrorKind, {status = null, message}: {
        status?: number | null,
        message?: string,
    } = {}) {
        super(message ?? messages[kind])
        this.name = 'BackendError'
        this.kind = kind
        this.status = status
    }

    static fromAxios(error: unknown): unknown {
        if (!axios.isAxiosError(error)) {
            return error
        }

        const status = error.response?.status ?? null

        if (status === null) {
            return new BackendError('offline')
        }

        if (status === 401) {
            return new BackendError('unauthorized', {status})
        }

        return new BackendError('server', {status})
    }
}
