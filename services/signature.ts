import {DatabaseService} from "./database";
import {KdbxEntry, ProtectedValue} from 'kdbxweb';
import {Certificate, PrivateKey} from "@nodecfdi/credentials/browser";
import {bytesToBinaryString} from "@/utils/files";

export type SignatureMeta = {
    id: string

    title: string

    rfc: string
    serialNumber: string
    legalName: string
    expiredAt: Date
    issuedAt: Date

    createdAt: Date
    lastUsedAt: Date | null

    usageCount: number
}

export type Signature = {
    password: string
    cer: Uint8Array
    key: Uint8Array
} & SignatureMeta;


export class SignatureService {

    private database: DatabaseService

    constructor(database: DatabaseService) {
        this.database = database;
    }

    async getSignaturesMeta(): Promise<SignatureMeta[]> {
        const entries = await this.database.getEntries()
        return entries.map(entryToSignatureMeta)
    }

    async getSignature(uuid: string): Promise<Signature | null> {
        const entry = await this.database.getEntry(uuid)
        if (!entry) {
            return null;
        }

        return entryToSignature(entry);
    }

    addSignature(title: string, cer: Uint8Array<ArrayBuffer>, key: Uint8Array<ArrayBuffer>, password: string) {

        const certificate = new Certificate(bytesToBinaryString(cer));

        const privateKey = new PrivateKey(bytesToBinaryString(key), password);

        if (!privateKey.belongsTo(certificate)) {
            throw new Error('Private key does not belongs to certificate');
        }

        return this.database.addEntry(
            signatureToEntryInstruction(
                title,
                cer.buffer,
                key.buffer,
                password
            )
        )
    }

    removeSignature(uuid: string) {
        return this.database.removeEntry(uuid);
    }
}

const SignatureEntryFields = {
    title: 'Title',
    rfc: 'Rfc',
    legalName: 'LegalName',
    binarySignatureCer: 'signature.cer',
    binarySignatureKey: 'signature.key',
    signaturePassword: 'SignaturePassword',
} as const;

function signatureToEntryInstruction(title: string, cer: ArrayBuffer, key: ArrayBuffer, password: string): (entry: KdbxEntry) => Promise<KdbxEntry> {

    return async (cleanEntry) => {
        cleanEntry.fields.set(SignatureEntryFields.title, title);

        cleanEntry.fields.set(SignatureEntryFields.signaturePassword, ProtectedValue.fromString(password));
        cleanEntry.binaries.set(SignatureEntryFields.binarySignatureCer, ProtectedValue.fromBinary(cer))
        cleanEntry.binaries.set(SignatureEntryFields.binarySignatureKey, ProtectedValue.fromBinary(key))

        return cleanEntry;
    }
}

function entryToSignatureMeta(entry: KdbxEntry): SignatureMeta {
    const cerBinary = entry.binaries.get(SignatureEntryFields.binarySignatureCer)

    if (!(cerBinary instanceof ProtectedValue)) {
        throw new Error(`Unexpected unprotected value: ${SignatureEntryFields.binarySignatureCer}`)
    }

    const certificate = new Certificate(String.fromCharCode(...cerBinary.getBinary()))

    return {
        id: entry.uuid.toString(),
        title: entry.fields.get('Title')?.toString() ?? '-',
        serialNumber: certificate.serialNumber().decimal(),
        rfc: certificate.rfc(),
        legalName: certificate.legalName(),
        expiredAt: certificate.validTo(),
        issuedAt: certificate.validFrom(),
        createdAt: entry.times.creationTime ?? new Date(),
        lastUsedAt: entry.times.lastAccessTime ?? null,
        usageCount: entry.times.usageCount ?? 0,
    }
}

function entryToSignature(entry: KdbxEntry): Signature {
    const passwordField = entry.fields.get(SignatureEntryFields.signaturePassword);
    const cerBinary = entry.binaries.get(SignatureEntryFields.binarySignatureCer);
    const keyBinary = entry.binaries.get(SignatureEntryFields.binarySignatureKey);

    if (!(passwordField instanceof ProtectedValue)) {
        throw new Error(`Unexpected unprotected value: ${SignatureEntryFields.signaturePassword}`)
    }

    if (!(cerBinary instanceof ProtectedValue)) {
        throw new Error(`Unexpected unprotected value: ${SignatureEntryFields.binarySignatureCer}`)
    }

    if (!(keyBinary instanceof ProtectedValue)) {
        throw new Error(`Unexpected unprotected value: ${SignatureEntryFields.binarySignatureKey}`)
    }

    return {
        password: passwordField.getText(),
        cer: cerBinary.getBinary(),
        key: keyBinary.getBinary(),
        ...entryToSignatureMeta(entry)
    }
}
