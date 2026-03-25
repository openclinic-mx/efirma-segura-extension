import type {Browser} from "wxt/browser";

export const usePort = (isUnlocked: Ref) => {

    let port: Browser.runtime.Port | null = null;

    const connect = () => {
        port = browser.runtime.connect({name: 'heartbeat'});

        port.onDisconnect.addListener(() => {
            isUnlocked.value = false;
        });
    }

    const disconnect = () => {
        if (port) {
            port.disconnect();
            port = null;
        }
    }

    watch(isUnlocked, (unlocked) => {
        if (unlocked) {
            connect();
        } else {
            disconnect();
        }
    })
}
