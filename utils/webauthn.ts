// WebAuthn calls for passkey unlock. Runs in extension pages only (navigator.credentials does not
// exist in the background service worker); the background never sees anything but the PRF output.

import {base64ToBytes, base64UrlToBytes, bytesToBase64, bytesToBase64Url, randomBytes} from "@/utils/encoding";
import {PASSKEY_ORIGINS, PASSKEY_RP_NAME} from "@/utils/passkeys";

// exists: the chosen password manager already holds a passkey for this vault (excludeCredentials)
export type PasskeyErrorKind = 'cancelled' | 'exists' | 'permission' | 'no-prf' | 'unknown';

export class PasskeyError extends Error {
    readonly kind: PasskeyErrorKind;

    constructor(kind: PasskeyErrorKind, message?: string) {
        super(message ?? kind);
        this.name = 'PasskeyError';
        this.kind = kind;
    }
}

export type CreatedPasskey = {
    credentialId: string,
    // false: the authenticator cannot do PRF (e.g. Chrome's local profile); null: not reported
    prfEnabled: boolean | null,
    aaguid: string | null,
    backupEligible: boolean,
    transports: string[],
    authenticatorAttachment: string | null,
}

type PrfClientOutputs = {
    prf?: {
        enabled?: boolean,
        results?: { first?: ArrayBuffer },
    },
}

const TIMEOUT = 120_000;

export const hasPasskeyPermission = async (): Promise<boolean> => {
    try {
        return await browser.permissions.contains({origins: PASSKEY_ORIGINS});
    } catch {
        return false;
    }
}

/** Must be the first await of a click handler: Chrome requires a user gesture. */
export const requestPasskeyPermission = (): Promise<boolean> => {
    return browser.permissions.request({origins: PASSKEY_ORIGINS});
}

const classify = async (e: unknown): Promise<PasskeyError> => {
    if (e instanceof PasskeyError) {
        return e;
    }

    if (e instanceof DOMException) {
        // NotAllowedError: dismissed, timed out or the page lost focus. AbortError: we aborted it.
        if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
            return new PasskeyError('cancelled', e.message);
        }

        // only create() throws it: a credential in excludeCredentials lives in the chosen provider
        if (e.name === 'InvalidStateError') {
            return new PasskeyError('exists', e.message);
        }

        // Chrome answers a missing host permission with a generic origin error
        if (e.name === 'SecurityError' && !(await hasPasskeyPermission())) {
            return new PasskeyError('permission', e.message);
        }
    }

    return new PasskeyError('unknown', e instanceof Error ? e.message : String(e));
}

/** Authenticator data: rpIdHash (32) | flags (1) | signCount (4) | [AAGUID (16) when AT is set] */
export const parseAuthenticatorData = (data: ArrayBuffer) => {
    const bytes = new Uint8Array(data);
    const flags = bytes[32] ?? 0;

    let aaguid: string | null = null;

    if (flags & 0x40 && bytes.length >= 53) {
        const hex = Array.from(bytes.slice(37, 53), (byte) => byte.toString(16).padStart(2, '0')).join('');

        if (!/^0+$/.test(hex)) {
            aaguid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        }
    }

    return {
        userVerified: !!(flags & 0x04),
        backupEligible: !!(flags & 0x08),
        aaguid,
    };
}

export const createPasskey = async (options: {
    rpId: string,
    userHandle: string,
    userName: string,
    excludeCredentialIds: string[],
    prfSalt: string,
    signal?: AbortSignal,
}): Promise<CreatedPasskey> => {
    try {
        const credential = await navigator.credentials.create({
            signal: options.signal,
            publicKey: {
                rp: {id: options.rpId, name: PASSKEY_RP_NAME},
                user: {
                    id: base64UrlToBytes(options.userHandle),
                    name: options.userName,
                    displayName: PASSKEY_RP_NAME,
                },
                challenge: randomBytes(32),
                pubKeyCredParams: [
                    {type: 'public-key', alg: -7},
                    {type: 'public-key', alg: -257},
                ],
                authenticatorSelection: {
                    residentKey: 'required',
                    requireResidentKey: true,
                    userVerification: 'required',
                },
                excludeCredentials: options.excludeCredentialIds.map((id) => ({
                    type: 'public-key' as const,
                    id: base64UrlToBytes(id),
                })),
                timeout: TIMEOUT,
                extensions: {
                    prf: {eval: {first: base64ToBytes(options.prfSalt)}},
                } as AuthenticationExtensionsClientInputs,
            },
        }) as PublicKeyCredential | null;

        if (!credential) {
            throw new PasskeyError('cancelled');
        }

        const response = credential.response as AuthenticatorAttestationResponse;
        const authenticatorData = parseAuthenticatorData(response.getAuthenticatorData());
        const extensions = credential.getClientExtensionResults() as PrfClientOutputs;

        return {
            credentialId: bytesToBase64Url(new Uint8Array(credential.rawId)),
            prfEnabled: extensions.prf?.enabled ?? null,
            aaguid: authenticatorData.aaguid,
            backupEligible: authenticatorData.backupEligible,
            transports: response.getTransports?.() ?? [],
            authenticatorAttachment: credential.authenticatorAttachment,
        };
    } catch (e) {
        throw await classify(e);
    }
}

/** Asks for one of the given passkeys and returns its PRF output (base64) for that credential's salt. */
export const evaluatePasskey = async (options: {
    rpId: string,
    credentials: { id: string, transports: string[], prfSalt: string }[],
    signal?: AbortSignal,
}): Promise<{ credentialId: string, prfOutput: string }> => {
    try {
        const credential = await navigator.credentials.get({
            signal: options.signal,
            publicKey: {
                rpId: options.rpId,
                challenge: randomBytes(32),
                userVerification: 'required',
                allowCredentials: options.credentials.map((passkey) => ({
                    type: 'public-key' as const,
                    id: base64UrlToBytes(passkey.id),
                    transports: passkey.transports as AuthenticatorTransport[],
                })),
                timeout: TIMEOUT,
                extensions: {
                    prf: {
                        evalByCredential: Object.fromEntries(options.credentials.map((passkey) => [
                            passkey.id,
                            {first: base64ToBytes(passkey.prfSalt)},
                        ])),
                    },
                } as AuthenticationExtensionsClientInputs,
            },
        }) as PublicKeyCredential | null;

        if (!credential) {
            throw new PasskeyError('cancelled');
        }

        const first = (credential.getClientExtensionResults() as PrfClientOutputs).prf?.results?.first;

        if (!first) {
            throw new PasskeyError('no-prf');
        }

        return {
            credentialId: bytesToBase64Url(new Uint8Array(credential.rawId)),
            prfOutput: bytesToBase64(new Uint8Array(first)),
        };
    } catch (e) {
        throw await classify(e);
    }
}

/** Asks the passkey provider to forget a passkey the vault no longer accepts. Best effort. */
export const forgetPasskey = async (rpId: string, credentialId: string) => {
    const signal = (PublicKeyCredential as unknown as {
        signalUnknownCredential?: (options: { rpId: string, credentialId: string }) => Promise<void>
    }).signalUnknownCredential;

    try {
        await signal?.call(PublicKeyCredential, {rpId, credentialId});
    } catch {
        // not supported or rejected by the provider: nothing else to do
    }
}
