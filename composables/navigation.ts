import {browser} from "wxt/browser";
import {sendMessage} from "@/messaging";

export const useNavigation = () => {

    const prepareLoaded = (tabId: number, status = "complete") => {
        return new Promise((resolve, reject) => {
            browser.tabs.onUpdated.addListener(
                function listener(updatedTabId, changeInfo, updatedTab) {
                    console.log({status, tabId})
                    if (updatedTabId !== tabId) {
                        return;
                    }

                    if (changeInfo.status !== status) {
                        return;
                    }

                    browser.tabs.onUpdated.removeListener(listener);

                    resolve(updatedTab);
                }
            );
        });
    }

    const navigate = async (url: string) => {
        const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
        });

        if (!tab?.id) {
            throw new Error('No active tab found')
        }

        const tabId = tab.id;

        const loaded = prepareLoaded(tabId!)

        await browser.tabs.update(tabId, {url});

        await loaded;

        return tabId!;
    }

    const signatureAction = (tabId: number) => {
        return sendMessage('SIGNATURE_ACTION',undefined, {
            tabId
        })
    }

    return {
        navigate,
        prepareLoaded,
        signatureAction
    }
}