import {defineExtensionMessaging} from '@webext-core/messaging';
import {SignatureMeta} from "@/services/signature";
import {User} from "@/services/account";

export type VaultStatus = {
    isInitialized: boolean,
    isUnlocked: boolean
};

export type SyncStatus = {
    isEnabled: boolean | null,
    lastSyncAt: string | null,
    hash: string | null,
}

export type TimerStatus = {
    lockStart: number | null,
    lockDuration: number,
}

export type SignatureForm = {
    name: string,
    cer: string,
    key: string,
    password: string
}

export type VaultList = {
    error: null,
    signatures: SignatureMeta[]
} | {
    error: string,
    signatures: never[]
}

interface VaultProtocolMap {
    VAULT_LIST(): VaultList;

    VAULT_STATUS(): VaultStatus;

    VAULT_LOCK(): VaultStatus;

    VAULT_UNLOCK(masterPassword: string): VaultStatus | { error: string };

    VAULT_INITIALIZE(masterPassword: string): VaultStatus;

    VAULT_EXPORT(): {
        base64: string | null
    };

    VAULT_IMPORT(base64: string): VaultStatus | { error: string };

    VAULT_RESET(): VaultStatus;

    VAULT_REMOVE(id: string): {
        id: string,
    } | {
        id: null,
        error: string
    };

    VAULT_ADD(signature: SignatureForm): {
        id: string,
        error: null
    } | {
        id: null,
        error: string
    }

    VAULT_ADD_MANY(signatures: SignatureForm[]): {
        ids: string[],
        error: null
    } | {
        ids: null,
        error: string
    }

    VAULT_LIST_UPDATE(payload: VaultList): void

    VAULT_STATUS_UPDATE(payload: VaultStatus): void
}

interface TimerProtocolMap {
    TIMER_STATUS(): TimerStatus;

    TIMER_CLEAR(status: TimerStatus): void;

    TIMER_START(status: TimerStatus): void;
}

interface TabProtocolMap {
    TOGGLE_TAB(): void;

    OPEN_TAB(): void,

    CLOSE_TAB(): void,
}

interface AccountProtocolMap {
    ACCOUNT_STATUS(): User | null;

    ACCOUNT_STATUS_UPDATE(status: User | null): void;

    ACCOUNT_AUTH(google_token: string): {
        user: null,
        error: string,
    } | {
        user: User,
        error: null,
    }

    ACCOUNT_CHECKOUT(type: 'year' | 'month'): {
        checkout_url: string,
    } | undefined

    ACCOUNT_PORTAL(): {
        portal_url: string,
    } | undefined

    ACCOUNT_CFDI(): {
        cfdi_url: string
    } | undefined

    ACCOUNT_LOGOUT(): User | null
}

interface SyncProtocolMap {
    SYNC_STATUS(): SyncStatus;

    SYNC_STATUS_UPDATE(status: SyncStatus): void;

    SYNC_DESTROY(): string | null;

    SYNC_STOP(): SyncStatus;

    SYNC_UP(): SyncStatus | {
        error: string
    };

    SYNC_REMOTE_HASH(): string | null;

    SYNC_DOWN(): SyncStatus | {
        error: string
    };
}

interface AutocompleteProtocolMap {
    AUTOCOMPLETE_REQUEST(request: {
        id: string
        tabId: number,
        submit: boolean,
    }): { error: string | null }

    AUTOCOMPLETE_ACTION(action: {
        taxId: string,
        password: string,
        cer: string,
        key: string,
        submit: boolean,
    }): {
        error: string | null
    }
}

interface IntroductionProtocolMap {
    VIEW_ADD_SIGNATURE(): void
}

export const {
    sendMessage,
    onMessage
} = defineExtensionMessaging<VaultProtocolMap & TimerProtocolMap & TabProtocolMap & AccountProtocolMap & SyncProtocolMap & AutocompleteProtocolMap & IntroductionProtocolMap>();

