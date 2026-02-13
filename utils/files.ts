const arrayBufferToBinaryString = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    return String.fromCharCode(...bytes);
};

export const readFileAsBinaryString = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    return arrayBufferToBinaryString(buffer);
};


export const readBufferAsBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export const readBase64AsBuffer = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
