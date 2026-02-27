import {useSignatures} from "@/composables/signatures";
import {SignatureFolder,} from "@/utils/dataTransfer";
import {validCerts} from "@/utils/signature";
import {Certificate, PrivateKey} from "@nodecfdi/credentials/browser";

type Combination = {
    cer: {
        parsed: Certificate,
        file: File
    },
    key: {
        parsed: string
        file: File
    },
    password: string
}

export const useBulk = () => {

    const {addSignatures} = useSignatures()

    const makeCombinations = async (folder: SignatureFolder) => {
        const certs = await validCerts(folder.cers)

        const combinations: Combination[] = []

        for (const cer of certs) {
            for (const key of folder.keys) {
                if (key.size === 0) continue;
                const readKey = await readFileAsBinaryString(key);
                for (const txt of folder.txts) {
                    if (txt.size === 0) continue;
                    const readPassword = await readFileAsBinaryString(txt);
                    combinations.push({
                        cer: cer,
                        key: {
                            parsed: readKey,
                            file: key,
                        },
                        password: readPassword
                    })
                }
            }
        }

        return combinations;
    }


    const parse = async (signatureFolders: SignatureFolder[]) => {
        const combinations = await Promise.all(signatureFolders.flatMap(makeCombinations));

        const correctCombinations = combinations.flat()
            .map((combination): Combination | null => {
                    const {cer, key, password} = combination;

                    const tries = [
                        password,
                        password.trim(),
                        password.trimEnd(),
                        password.trimStart(),
                    ]
                    for (const passwordOption of tries) {
                        try {
                            const privateKey = new PrivateKey(key.parsed, passwordOption)

                            if (privateKey.belongsTo(cer.parsed)) {
                                return {
                                    ...combination,
                                    password: passwordOption,
                                };
                            }
                        } catch (e) {
                            //
                        }
                    }
                    return null;
                }
            )
            .filter((combination): combination is Combination => combination !== null)

        const signatures = correctCombinations.map(({cer, key, password}) => {
            return {
                name: cer.parsed.legalName(),
                cer: cer.file,
                key: key.file,
                password
            }
        })

        addSignatures(signatures)
    }

    return {
        parse
    }

}
