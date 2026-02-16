// import database

import {StorageService} from "@/services/storage";
import {DatabaseService} from "@/services/database";
import {SignatureService} from "@/services/signatures";
import {readBase64AsBytes, readBytesAsBase64} from "@/utils/files";

export default defineBackground(() => {

    const storageService = new StorageService();
    const databaseService = new DatabaseService(storageService);
    const signatureService = new SignatureService(databaseService);

    let openTabs = new Set();

    console.log('Hello background!', {id: browser.runtime.id});

    browser.sidePanel.setOptions({
        path: `app.html`,
    })

    browser.sidePanel
        .setPanelBehavior({openPanelOnActionClick: true})
        .catch((error) => console.error(error))

    const getVaultStatus = async () => ({
        isInitialized: await databaseService.isInitialized(),
        isUnlocked: databaseService.isUnlocked(),
    })

    const getVaultList = async () => ({
        signatures: await signatureService.getSignaturesMeta()
    })

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'VAULT_LIST') {
            (async () => {
                sendResponse(await getVaultList())
            })();
        }

        if (message.type === 'AUTOCOMPLETE_REQUEST') {
            (async () => {
                const id = message.payload.id;
                const tabId = message.payload.tabId;
                const submit = message.payload.submit;

                console.log({payload: message.payload})

                const signature = await signatureService.getSignature(id);

                if (!signature) {
                    sendResponse({
                        error: 'Signature not found'
                    });
                    return;
                }

                if (!tabId) {
                    sendResponse({
                        error: 'Need a tab id to autocomplete'
                    });
                    return;
                }

                browser.tabs.sendMessage(tabId, {
                    type: 'AUTOCOMPLETE_ACTION',
                    payload: {
                        password: signature.password,
                        cer: readBytesAsBase64(signature.cer),
                        key: readBytesAsBase64(signature.key),
                        submit: submit
                    }
                })

                sendResponse({
                    ok: true
                });
            })();
        }

        if (message.type === 'VAULT_STATUS') {
            (async () => {
                sendResponse(await getVaultStatus())
            })();
        }

        if (message.type === 'VAULT_LOCK') {
            (async () => {
                databaseService.lock()
                sendResponse(await getVaultStatus())
                browser.runtime.sendMessage({
                    type: 'VAULT_STATUS_UPDATE',
                    payload: await getVaultStatus()
                })
            })();
        }

        if (message.type === 'VAULT_UNLOCK') {
            (async () => {
                const masterPassword = message.payload.masterPassword;
                try {
                    await databaseService.unlock(masterPassword)
                    sendResponse(await getVaultStatus())
                    browser.runtime.sendMessage({
                        type: 'VAULT_STATUS_UPDATE',
                        payload: await getVaultStatus()
                    })
                } catch (e) {
                    sendResponse({
                        ...(await getVaultStatus()),
                        error: e.message
                    })
                }
            })();
        }

        if (message.type === 'VAULT_INITIALIZE') {
            (async () => {
                const masterPassword = message.payload.masterPassword;
                await databaseService.initialize(masterPassword)
                const newStatus = await getVaultStatus();
                sendResponse(newStatus)
                browser.runtime.sendMessage({
                    type: 'VAULT_STATUS_UPDATE',
                    payload: newStatus
                })
            })();
        }

        if (message.type === 'VAULT_RESET') {
            (async () => {
                await databaseService.deleteDatabase()
                const newStatus = await getVaultStatus();
                sendResponse(newStatus)
                browser.runtime.sendMessage({
                    type: 'VAULT_STATUS_UPDATE',
                    payload: newStatus
                })
            })();
        }

        if (message.type === 'VAULT_ADD') {
            (async () => {
                const {
                    name,
                    cer,
                    key,
                    password
                } = message.payload;

                await signatureService.addSignature(
                    name,
                    readBase64AsBytes(cer),
                    readBase64AsBytes(key),
                    password
                )

                const newList = await getVaultList();

                sendResponse(newList)

                browser.runtime.sendMessage({
                    type: 'VAULT_LIST_UPDATE',
                    payload: newList
                })
            })();
        }

        if (message.type === 'TOGGLE_TAB') {
            (async () => {
                if (!sender.tab) {
                    return;
                }

                if (openTabs.has(sender.tab.id)) {
                    browser.sidePanel.close({
                        tabId: sender.tab.id,
                        windowId: sender.tab.windowId
                    })
                } else {
                    browser.sidePanel.setOptions({
                        tabId: sender.tab.id,
                        path: `app.html`,
                        enabled: true
                    })

                    await browser.sidePanel.open({
                        tabId: sender.tab.id,
                        windowId: sender.tab.windowId
                    })
                }
            })();
        }

        if (message.type === 'OPEN_TAB') {
            (async () => {
                if (!sender.tab) {
                    return;
                }

                browser.sidePanel.setOptions({
                    tabId: sender.tab.id,
                    path: `app.html`,
                    enabled: true
                })

                await browser.sidePanel.open({
                    tabId: sender.tab.id,
                    windowId: sender.tab.windowId
                })
            })();
        }

        if (message.type === 'CLOSE_TAB') {
            (async () => {
                if (!sender.tab) {
                    return;
                }
                browser.sidePanel.close({
                    tabId: sender.tab.id,
                    windowId: sender.tab.windowId
                })
            })();
        }

        return true;
    });

    browser.sidePanel.onOpened.addListener((info) => {
        openTabs.add(info.tabId)
    })

    browser.sidePanel.onClosed.addListener((info) => {
        openTabs.delete(info.tabId)
    })
});
