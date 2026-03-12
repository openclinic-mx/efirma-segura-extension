// import database

import {StorageService} from "@/services/storage";
import {DatabaseService} from "@/services/database";
import {SignatureService} from "@/services/signature";
import {SidePanelService} from "@/services/sidePanel";
import {AutocompleteService} from "@/services/autocomplete";
import {AutoLockService} from "@/services/autoLock";
import {VaultService} from "@/services/vault";
import {AccountService} from "@/services/account";
import {SyncService} from "@/services/sync";
import {RealtimeService} from "@/services/realtime";
import {instance} from "@/utils/axios";

export default defineBackground(() => {

    const storageService = new StorageService();
    const databaseService = new DatabaseService(storageService);
    const signatureService = new SignatureService(databaseService);
    const sidePanelService = new SidePanelService();
    const autoLockService = new AutoLockService(5);
    const autocompleteService = new AutocompleteService(signatureService, autoLockService);
    const vaultService = new VaultService(databaseService, signatureService, autoLockService);
    const accountService = new AccountService(storageService);
    const syncService = new SyncService(accountService, storageService, vaultService);
    const realtimeService = new RealtimeService(accountService);

    sidePanelService.onVisible(async () => {
        const status = await syncService.status()
        if (status.isEnabled) {
            await syncService.syncDown()
            await vaultService.requestBroadcast()
        }

        const user = await accountService.user();

        if (user) {
            await realtimeService.startListening();
        }
    })

    sidePanelService.onHidden(async () => {
        await realtimeService.stopListening();
    })

    instance.interceptors.request.use(async (config) => {
        const token = await accountService.token();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    instance.interceptors.request.use(async (config) => {
        config.headers['X-Socket-ID'] = realtimeService.socketId();
        return config;
    });


    realtimeService.onVault(async () => {
        const status = await syncService.status()
        if (status.isEnabled) {
            await syncService.syncDown()
            await vaultService.requestBroadcast()
        }
    })

    realtimeService.onSubscription(() => {
        accountService.fetch()
    })

    accountService.onLogin(async () => {
        await realtimeService.startListening()
    })

    accountService.onLogout(async () => {
        await syncService.syncStop()
        realtimeService.stopListening()
    })


    autoLockService.onLock(() => vaultService.lock())

    databaseService.onSave(async () => {
        const status = await syncService.status()
        if (status.isEnabled) {
            await syncService.syncUp()
        }
    })

    databaseService.onClear(async () => {
        const status = await syncService.status()
        if (status.isEnabled) {
            await syncService.destroy()
        }
    })

    syncService.onSync(() => {
        // not sure why it was needed?
        accountService.fetch()
    })

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

    browser.runtime.onInstalled.addListener(async (details) => {
        if (details.reason !== "install") {
            return;
        }
        browser.tabs.create({ url: 'welcome.html' });
    })

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
            case 'VAULT_ADD_MANY':
                return vaultService.addSignatures(message)
            case 'TOGGLE_TAB':
                return sidePanelService.toggle(sender);
            case 'OPEN_TAB':
                return sidePanelService.open(sender);
            case 'CLOSE_TAB':
                return sidePanelService.close(sender);
            case 'TIMER_STATUS':
                return autoLockService.getStatus()
            case 'ACCOUNT_STATUS':
                return accountService.user()
            case 'ACCOUNT_AUTH':
                return accountService.auth(message)
            case 'ACCOUNT_CHECKOUT':
                return accountService.checkout()
            case 'ACCOUNT_PORTAL':
                return accountService.portal()
            case 'ACCOUNT_CFDI':
                return accountService.cfdi()
            case 'ACCOUNT_LOGOUT':
                return accountService.clear()
            case 'SYNC_STATUS':
                return syncService.status()
            case 'SYNC_DESTROY':
                return syncService.destroy()
            case 'SYNC_STOP':
                return syncService.syncStop()
            case 'SYNC_UP':
                return syncService.syncUp()
            case 'SYNC_REMOTE_HASH':
                return syncService.remoteHash()
            case 'SYNC_DOWN':
                return syncService.syncDown()
        }
    }

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        mapMessageToService(message, sender).then(sendResponse).catch(error => sendResponse({error: error}))
        return true;
    });
});
