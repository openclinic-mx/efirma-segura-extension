// database -> credentials library
export const readBufferAsBinaryString = (buffer: ArrayBuffer): string => {
    return bytesToBinaryString(new Uint8Array(buffer));
};

// ui -> credentials library
export const readFileAsBinaryString = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    return bytesToBinaryString(new Uint8Array(buffer));
};

// ui -> background
export const readFileAsBase64 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    return readBufferAsBase64(buffer);
};

// database -> storage
export const readBufferAsBase64 = (buffer: ArrayBuffer) => {
    const binary = bytesToBinaryString(new Uint8Array(buffer))
    return btoa(binary);
}

// database -> ui
export const readBytesAsBase64 = (bytes: Uint8Array): string => {
    const binary = bytesToBinaryString(bytes)
    return btoa(binary);
}


// background -> database
export const readBase64AsBytes = (base64: string) => {
    const binary = atob(base64);
    return binaryStringToBytes(binary)
}

export const readBase64AsFile = (base64: string, fileName: string, mimeType: string): File => {
    return new File([readBase64AsBytes(base64)], fileName, {type: mimeType});
}

export const bytesToBinaryString = (bytes: Uint8Array, chunk = 0x8000): string => {
    let binary = "";

    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }

    return binary;
}

export const binaryStringToBytes = (binary: string): Uint8Array<ArrayBuffer> => {
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}
