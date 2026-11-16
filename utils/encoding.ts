import {binaryStringToBytes, bytesToBinaryString} from "@/utils/files";

export const bytesToBase64 = (bytes: Uint8Array): string => {
    return btoa(bytesToBinaryString(bytes));
}

export const base64ToBytes = (base64: string): Uint8Array<ArrayBuffer> => {
    return binaryStringToBytes(atob(base64));
}

// WebAuthn credential IDs and user handles travel as base64url
export const bytesToBase64Url = (bytes: Uint8Array): string => {
    return bytesToBase64(bytes)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export const base64UrlToBytes = (base64url: string): Uint8Array<ArrayBuffer> => {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    return base64ToBytes(base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '='));
}

export const randomBytes = (length: number): Uint8Array<ArrayBuffer> => {
    return crypto.getRandomValues(new Uint8Array(length));
}
