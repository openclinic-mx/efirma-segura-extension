export const readBufferAsBinaryString = (buffer: ArrayBuffer): string => {
    return bytesToBinaryString(new Uint8Array(buffer));
};

export const readFileAsBinaryString = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    return bytesToBinaryString(new Uint8Array(buffer));
};

export const readFileAsBase64 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    return readBufferAsBase64(buffer);
};

export const readBufferAsBase64 = (buffer: ArrayBuffer) => {
    const binary = bytesToBinaryString(new Uint8Array(buffer))
    return btoa(binary);
}

export const readBase64AsBytes = (base64: string): Uint8Array => {
    const binary = atob(base64);
    return binaryStringToBytes(binary)
}

export const bytesToBinaryString = (bytes: Uint8Array, chunk = 0x8000): string => {
    let binary = "";

    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }

    return binary;
}

export const binaryStringToBytes = (binary: string, chunk = 0x8000): Uint8Array => {
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}
