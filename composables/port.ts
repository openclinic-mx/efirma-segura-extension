import { onScopeDispose, watch, type Ref } from 'vue';
import type {Browser} from "wxt/browser";

export const usePort = (isUnlocked: Ref) => {

    let port: Browser.runtime.Port | null = null;

    let heartbeatAbortController: AbortController | null = null;

    const abort = () => {
        heartbeatAbortController?.abort();
        heartbeatAbortController = null;
    };

    const startHeartbeat = (
        port: Browser.runtime.Port,
        signal: AbortSignal,
    ) => {
        const sendHeartbeat = () => {
            if (signal.aborted) return;

            port.postMessage({
                type: 'heartbeat',
            });
        };

        sendHeartbeat();

        const interval = setInterval(sendHeartbeat, 10_000);

        signal.addEventListener(
            'abort',
            () => {
                clearInterval(interval);
            },
            { once: true },
        );
    };

    const connect = () => {
        if (port) return;

        port = browser.runtime.connect({name: 'heartbeat'});
        heartbeatAbortController = new AbortController();

        port.onDisconnect.addListener(() => {
            abort();
            port = null;
            isUnlocked.value = false;
        });

        startHeartbeat(port, heartbeatAbortController.signal)
    }

    const disconnect = () => {
        abort();
        port?.disconnect();
        port = null;
    }

    watch(isUnlocked, (unlocked) => {
        if (unlocked) {
            connect();
        } else {
            disconnect();
        }
    }, { immediate: true })

    onScopeDispose(() => {
        disconnect();
    });
}
