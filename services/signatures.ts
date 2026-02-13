import {DatabaseService} from "./database";


type SignatureMeta = {
    rfc: string
    legalName: string
    expiresAt: Date
    createdAt: Date
    lastUsedAt: Date | null
    uses: null
}

type Signature = {
    password: string
    cer: string
    key: string
}

export class SignatureService {

    constructor(database: DatabaseService) {

    }

    getSignaturesMeta(): SignatureMeta[] {

    }

    getSignature(): Signature {

    }
}
