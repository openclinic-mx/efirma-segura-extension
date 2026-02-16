export const useAutocomplete = () => {

    async function getActiveTabId() {
        const [tab] = await browser.tabs.query({active: true, currentWindow: true});
        return tab?.id;
    }

    const select = async (signatureId: string, autoSubmit: boolean) => {
        return await browser.runtime.sendMessage({
            type: 'AUTOCOMPLETE_REQUEST',
            payload: {
                id: signatureId,
                tabId: await getActiveTabId(),
                submit: autoSubmit
            }
        })
    }

    return {
        select,
    }
}
