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
import {WelcomeService} from "@/services/welcome";
import {PortService} from "@/services/port";


export default defineBackground(() => {

    const storageService = new StorageService();
    const databaseService = new DatabaseService(storageService);
    const signatureService = new SignatureService(databaseService);
    const sidePanelService = new SidePanelService();
    const autoLockService = new AutoLockService(5);
    const autocompleteService = new AutocompleteService(signatureService);
    const vaultService = new VaultService(databaseService, signatureService);
    const accountService = new AccountService(storageService);
    const syncService = new SyncService(accountService, storageService, vaultService);
    const realtimeService = new RealtimeService(accountService);
    const welcomeService = new WelcomeService();
    const portService = new PortService();

    // we want to tell the autoLock service all the events that will start, stop or restart the clock.
    autoLockService.registerListeners(autocompleteService, vaultService,)
    autoLockService.onLock(() => vaultService.lock())

    // even though the side panels are opened, the background can be killed.
    // We will prevent it by listening for a connection from the side panel

    // additionally, if the side panel is closed (often automatically)
    // we need to keep the background running, we can do it by opening a realtime service

    sidePanelService.onVisible(async () => {
        // when the side panel is open, we will try to sync the vault and open a socket
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

    sidePanelService.onHidden(() => {
        // when all the side panels are closed, we will stop listening to the socket
        realtimeService.stopListening();
    })

    realtimeService.onVault(async () => {
        // when we receive a vault update, we will download the last update
        // and broadcast it to the side panels
        const status = await syncService.status()
        if (status.isEnabled) {
            await syncService.syncDown()
            await vaultService.requestBroadcast()
        }
    })

    realtimeService.onSubscription(async () => {
        // user subscription status has changed in the server
        await accountService.fetch()
    })

    accountService.onLogin(async () => {
        // we want to start listening when the user is logged-in
        // user only logs in via Google, and it happens once
        await realtimeService.startListening()
    })

    accountService.onLogout(async () => {
        // we want to stop listening and disable the sync
        // user logs out by clicking the buttons
        await syncService.syncStop()
        realtimeService.stopListening()
    })

    databaseService.onSave(async () => {
        // when the database is saved and syncing is enabled,
        // we will upload the database to the server
        const status = await syncService.status()
        if (status.isEnabled) {
            await syncService.syncUp()
        }
    })

    databaseService.onClear(async () => {
        // when the database is destroyed and syncing is enabled,
        // we will delete the database from the server
        const status = await syncService.status()
        if (status.isEnabled) {
            await syncService.destroy()
        }
    })

    syncService.onSync(async () => {
        // since we check for vault existence in the user,
        // we want to upload those values if we receive a remote sync
        await accountService.fetch()
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
