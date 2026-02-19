// import database

import {StorageService} from "@/services/storage";
import {DatabaseService} from "@/services/database";
import {SignatureService} from "@/services/signature";
import {SidePanelService} from "@/services/sidePanel";
import {AutocompleteService} from "@/services/autocomplete";
import {AutoLockService} from "@/services/autoLock";
import {VaultService} from "@/services/vault";

export default defineBackground(() => {

    const storageService = new StorageService();
    const databaseService = new DatabaseService(storageService);
    const signatureService = new SignatureService(databaseService);
    const sidePanelService = new SidePanelService();
    const autoLockService = new AutoLockService(2);
    const autocompleteService = new AutocompleteService(signatureService, autoLockService);
    const vaultService = new VaultService(databaseService, signatureService, autoLockService);

    autoLockService.onLock(() => vaultService.lock())
    autoLockService.onStart(() => {
        browser.runtime.sendMessage({
            type: 'TIMER_START',
            payload: autoLockService.getStatus()
        })
    })
    autoLockService.onClear(() => {
        browser.runtime.sendMessage({
            type: 'TIMER_CLEAR',
            payload: autoLockService.getStatus()
        })
    })

    browser.action.setPopup({popup: ""});

    browser.action.onClicked.addListener(async (tab) => {
        if (!tab?.id) return;

        browser.sidePanel.setOptions({
            tabId: tab.id,
            path: "app.html",
            enabled: true,
        });

        await browser.sidePanel.open({tabId: tab.id});
    });

    const mapMessageToService = async (message: any, sender: Browser.runtime.MessageSender) => {
        switch (message.type) {
            case 'AUTOCOMPLETE_REQUEST':
                return autocompleteService.request(message);
            case 'VAULT_LIST':
                return vaultService.list()
            case 'VAULT_STATUS':
                return vaultService.status()
            case 'VAULT_LOCK':
                return vaultService.lock()
            case 'VAULT_UNLOCK':
                return vaultService.unlock(message)
            case 'VAULT_INITIALIZE':
                return vaultService.initialize(message)
            case 'VAULT_RESET':
                return vaultService.destroy()
            case 'VAULT_REMOVE':
                return vaultService.removeSignature(message)
            case 'VAULT_ADD':
                return vaultService.addSignature(message)
            case 'TOGGLE_TAB':
                return sidePanelService.toggle(sender);
            case 'OPEN_TAB':
                return sidePanelService.open(sender);
            case 'CLOSE_TAB':
                return sidePanelService.close(sender);
            case 'TIMER_STATUS':
                return autoLockService.getStatus()
        }
    }

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        mapMessageToService(message, sender).then(sendResponse).catch(error => sendResponse({error: error}))
        return true;
    });
});
