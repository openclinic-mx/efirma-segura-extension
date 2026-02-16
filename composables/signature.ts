import {computed, Ref, ref, watch} from "vue";
import {Certificate, PrivateKey} from "@nodecfdi/credentials/browser";
import {isFuture} from "date-fns";
import {readFileAsBinaryString} from "../utils/files";

export const useSignature = (
    cer: Ref<File | null>,
    key: Ref<File | null>,
    password: Ref<string>,
) => {
    const readKey = ref<string | null>(null);

    const parsedCertificate = ref<Certificate | null>(null);
    const parsedKey = ref<PrivateKey | null>(null);

    const isValid = computed(() => {
        if (!parsedCertificate.value) {
            return null;
        }

        return isFuture(parsedCertificate.value.validTo());
    });

    const isSignature = computed(() => {
        if (!parsedCertificate.value) {
            return null;
        }

        // @ts-ignore
        return parsedCertificate.value.satType.isFiel()
    });

    const isCorrectPassword = computed(() => {
        if (!password.value || !key.value) {
            return null;
        }

        return parsedKey.value !== null
    });

    const isCorrectPair = computed(() => {
        if (!parsedKey.value || !parsedCertificate.value) {
            return null;
        }

        // @ts-ignore
        return parsedKey.value.belongsTo(parsedCertificate.value);
    })

    watch(cer, async (value) => {
        if (!value) {
            parsedCertificate.value = null;
            return;
        }

        const file = await readFileAsBinaryString(value);

        try {
            parsedCertificate.value = new Certificate(file);
        } catch (e) {
            return null;
        }
    });

    watch(key, async (value) => {
        if (!value) {
            readKey.value = null;
            return;
        }

        readKey.value = await readFileAsBinaryString(value);
    })

    watch([password, readKey], async ([passwordValue, readKeyValue]) => {
        if (!passwordValue || !readKeyValue) {
            parsedKey.value = null;
            return;
        }

        try {
            parsedKey.value = new PrivateKey(readKeyValue, passwordValue);
        } catch (e) {
            parsedKey.value = null;
        }
    })

    return {
        cer,
        key,
        password,
        isValid,
        isCorrectPassword,
        isCorrectPair,
        isSignature,
        parsedCertificate,
        parsedKey,
    }
}
