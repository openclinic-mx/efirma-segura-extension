// Passkey unlock: shared constants between the background and the extension pages.

// Passkeys are bound to this RP ID. Nothing is served there: the extension claims it through
// an optional host permission, so it can never be used by a web page.
export const PASSKEY_RP_ID = 'unlock.efirmasegura.com';

export const PASSKEY_ORIGINS = [`https://${PASSKEY_RP_ID}/*`];

export const PASSKEY_RP_NAME = 'e.firma Segura';

// The vault has no slot for the passkey the user picked (removed on another device).
export const UNKNOWN_PASSKEY_ERROR = 'Error UnknownPasskey';

// The enrollment token from the password step is gone (expired, used, or the vault locked): ask for it again.
export const ENROLLMENT_EXPIRED_ERROR = 'Error EnrollmentExpired';

// The vault already has a slot for this credential.
export const PASSKEY_ALREADY_REGISTERED_ERROR = 'Error PasskeyAlreadyRegistered';

// Enrollment tokens live this long in the background; the UI sends the user back to the password step a bit earlier.
export const ENROLLMENT_TTL = 5 * 60 * 1000;

// AAGUID -> provider name, used only to suggest a default name the user can change. We don't request
// attestation, so the AAGUID is unverified and must never drive a security decision (that would need FIDO MDS).
// Source: https://github.com/passkeydeveloper/passkey-authenticator-aaguids
const providerNames: Record<string, string> = {
    'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Gestor de contraseñas de Google',
    'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'Contraseñas de Apple',
    'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'Contraseñas de Apple',
    'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome en Mac',
    '771b48fd-d3d4-4f74-9232-fc157ab0507a': 'Edge en Mac',
    'b5397666-4885-aa6b-cebf-e52262a439a2': 'Chromium',
    '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
    '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
    '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
    'd3452668-01fd-4c12-926c-83a4204853aa': 'Microsoft Password Manager',
    'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
    'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
    '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
    'b84e4048-15dc-4dd0-8640-f4f60813c8af': 'NordPass',
    '0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6': 'Keeper',
    'f3809540-7f14-49c1-a8b3-8f813b225541': 'Enpass',
    '50726f74-6f6e-5061-7373-50726f746f6e': 'Proton Pass',
    'b78a0a55-6ef8-d246-a042-ba0f6d55050c': 'LastPass',
    'fdb141b2-5d84-443e-8a35-4698c205a502': 'KeePassXC',
    'eaecdef2-1c31-5634-8639-f1cbd9c00a08': 'KeePassDX',
    '53414d53-554e-4700-0000-000000000000': 'Samsung Pass',
};

/** Default name for a new passkey; the user can rename it later. */
export const passkeyNameFor = (passkey: {
    aaguid: string | null,
    backupEligible: boolean,
    authenticatorAttachment: string | null,
}) => {
    const name = passkey.aaguid ? providerNames[passkey.aaguid] : undefined;

    if (name) {
        return name;
    }

    if (passkey.authenticatorAttachment === 'cross-platform' && !passkey.backupEligible) {
        return 'Llave de seguridad';
    }

    return 'Llave de acceso';
}
