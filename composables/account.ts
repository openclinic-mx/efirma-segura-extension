import {useSignatures} from "@/composables/signatures";

export const useAccount = () => {

    const user = ref(null)

    const isLoggedIn = ref(false)

    const isSubscribed = ref(false)

    const {signatures} = useSignatures()

    const limitReached = computed(() => {

        if (isSubscribed.value) {
            return true;
        }

        return signatures.value.length >= 3
    })

    return {
        user,
        isLoggedIn,
        isSubscribed,
        limitReached: limitReached,
    }
}
