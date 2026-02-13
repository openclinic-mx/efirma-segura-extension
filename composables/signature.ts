import {computed, ref, watch} from "vue";
import {Certificate, PrivateKey} from "@nodecfdi/credentials/browser";
import {isFuture} from "date-fns";

const fileToString = (file: File) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(reader.result as string);
        reader.readAsBinaryString(file);
    });
};

export const useSignature = () => {
    const cer = ref<File | null>(null);

    const key = ref<File | null>(null);

    const password = ref('');

    const readKey = ref<string | null>(null);

    const parsedCertificate = ref<Certificate | null>(null);
    const parsedKey = ref<PrivateKey | null>(null);

    const isValid = computed(() => {
        if (!parsedCertificate.value) {
            return null;
        }

        return isFuture(parsedCertificate.value.validTo());
    });

    const isCorrectPassword = computed(() => {
        if (!password.value) {
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

        const file = await fileToString(value);

        parsedCertificate.value = new Certificate(file);
    });

    watch(key, async (value) => {
        if (!value) {
            readKey.value = null;
            return;
        }

        readKey.value = await fileToString(value);
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
        parsedCertificate,
        parsedKey,
    }
}
