import {Certificate} from "@nodecfdi/credentials/browser";

export const validCerts = async (cers: File[]): Promise<{ parsed: Certificate, file: File }[]> => {
    const certs: { parsed: Certificate, file: File }[] = [];

    for (const cer of cers) {
        try {
            const file = await readFileAsBinaryString(cer);

            const certificate = new Certificate(file);

            if (!certificate.satType().isFiel()) {
                continue;
            }

            certs.push({parsed: certificate, file: cer})
        } catch (e) {
            //
        }
    }

    return certs;
}
