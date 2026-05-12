import {sendMessage} from "@/messaging";

export const useAutocomplete = () => {

    async function getActiveTabId() {
        const [tab] = await browser.tabs.query({active: true, currentWindow: true});
        return tab?.id;
    }

    const select = async (signatureId: string, autoSubmit: boolean) => {
        const tabId = await getActiveTabId()

        if (!tabId) {
            return
        }

        return sendMessage('AUTOCOMPLETE_REQUEST', {
            id: signatureId,
            tabId,
            submit: autoSubmit
        })
    }

    return {
        select,
    }
}
