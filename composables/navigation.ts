const view = ref('home')

export const useNavigation = () => {
    return {
        view,
        navigate(to: string) {
            view.value = to;
        }
    }
}
