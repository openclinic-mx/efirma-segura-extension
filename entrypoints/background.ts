// import database

import {StorageService} from "@/services/storage";
import {Vault} from "@/vault/vault";
import {PasskeyLocks} from "@/vault/passkeyLocks";
import {Entries} from "@/vault/entries";
import {SignatureService} from "@/services/signature";
import {SidePanelService} from "@/services/sidePanel";
import {AutocompleteService} from "@/services/autocomplete";
import {AutoLockService} from "@/services/autoLock";
import {VaultService} from "@/services/vault";
import {PasskeyService} from "@/services/passkey";
import {AccountService} from "@/services/account";
import {SyncService} from "@/services/sync";
import {RealtimeService} from "@/services/realtime";
import {WelcomeService} from "@/services/welcome";
import {PortService} from "@/services/port";
import {ExtractionService} from "@/services/extraction";
import {onMessage} from "@/messaging";

// Passkey, export and extraction handlers only answer this extension's own pages, never content scripts.
const isExtensionPage = (sender: Browser.runtime.MessageSender) => {
    return sender.id === browser.runtime.id
        && !!sender.url?.startsWith(browser.runtime.getURL('/'));
}

const forbidden = {error: 'Forbidden'};


export default defineBackground(() => {

    const storageService = new StorageService();
    const vault = new Vault(storageService);
    const passkeyLocks = new PasskeyLocks(vault, storageService);
    const entries = new Entries(vault);
    const signatureService = new SignatureService(entries);
    const sidePanelService = new SidePanelService();
    const autoLockService = new AutoLockService(5);
    const autocompleteService = new AutocompleteService(signatureService);
    const vaultService = new VaultService(vault, signatureService, passkeyLocks);
    const passkeyService = new PasskeyService(vault, passkeyLocks, vaultService);
    const accountService = new AccountService(storageService);
    const syncService = new SyncService(accountService, storageService, vaultService);
    const realtimeService = new RealtimeService(accountService);
    const welcomeService = new WelcomeService();
    const portService = new PortService();
    const extractionService = new ExtractionService(signatureService, storageService);

    // we want to tell the autoLock service all the events that will start, stop or restart the clock.
    autoLockService.registerListeners(autocompleteService, vaultService, passkeyService, extractionService)
    autoLockService.onLock(() => vaultService.lock())

    // extracted files live for a few minutes, and never longer than the vault stays unlocked.
    // the vault is always locked when the background starts, so anything left behind goes too.
    extractionService.registerListeners()
    vaultService.onLock(() => extractionService.cleanup({all: true}))
    extractionService.cleanup({all: true})

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
        await accountService.refresh()
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

    vault.onSave(async () => {
        // when the database is saved and syncing is enabled,
        // we will upload the database to the server
        const status = await syncService.status()
        if (status.isEnabled) {
            await syncService.syncUp()
        }
    })

    vault.onClear(async () => {
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
        await accountService.refresh()
    })

    onMessage('AUTOCOMPLETE_REQUEST', message => autocompleteService.request(message.data))
    onMessage('VAULT_LIST', () => vaultService.list());
    onMessage('VAULT_STATUS', () => vaultService.status());
    onMessage('VAULT_LOCK', () => vaultService.lock());
    onMessage('VAULT_UNLOCK', message => vaultService.unlock(message.data));
    onMessage('VAULT_INITIALIZE', message => vaultService.initialize(message.data));
    onMessage('VAULT_RESET', () => vaultService.destroy());
    onMessage('VAULT_REMOVE', message => vaultService.removeSignature(message.data));
    onMessage('VAULT_PASSWORD', message => vaultService.password(message.data));
    onMessage('VAULT_ADD', message => vaultService.addSignature(message.data));
    onMessage('VAULT_ADD_MANY', message => vaultService.addSignatures(message.data));
    onMessage('VAULT_EXPORT_KEEPASS', message => isExtensionPage(message.sender)
        ? vaultService.exportKeePass(message.data)
        : forbidden);
    onMessage('VAULT_UNLOCK_PASSKEY', message => isExtensionPage(message.sender)
        ? vaultService.unlockWithPasskey(message.data.credentialId, message.data.prfOutput)
        : forbidden);
    onMessage('PASSKEY_LIST', () => passkeyService.list());
    onMessage('PASSKEY_UNLOCK_REQUEST', () => passkeyService.unlockRequest());
    onMessage('PASSKEY_ENROLL_BEGIN', message => isExtensionPage(message.sender)
        ? passkeyService.beginEnrollment(message.data)
        : forbidden);
    onMessage('PASSKEY_ENROLL_FINISH', message => isExtensionPage(message.sender)
        ? passkeyService.finishEnrollment(message.data)
        : forbidden);
    onMessage('PASSKEY_REMOVE', message => isExtensionPage(message.sender)
        ? passkeyService.remove(message.data)
        : forbidden);
    onMessage('PASSKEY_RENAME', message => isExtensionPage(message.sender)
        ? passkeyService.rename(message.data.id, message.data.name)
        : forbidden);
    onMessage('PASSKEY_AUTO_UNLOCK', () => passkeyService.autoUnlock());
    onMessage('PASSKEY_SET_AUTO_UNLOCK', message => isExtensionPage(message.sender)
        ? passkeyService.setAutoUnlock(message.data)
        : forbidden);
    onMessage('VAULT_IMPORT', message => vaultService.import(message.data));
    onMessage('VAULT_EXTRACT', message => isExtensionPage(message.sender)
        ? extractionService.extract(message.data)
        : forbidden);
    onMessage('TOGGLE_TAB', (message) => sidePanelService.toggle(message.sender))
    onMessage('OPEN_TAB', (message) => sidePanelService.open(message.sender))
    onMessage('CLOSE_TAB', (message) => sidePanelService.close(message.sender))
    onMessage('TIMER_STATUS', () => autoLockService.getStatus());
    onMessage('ACCOUNT_STATUS', () => accountService.user())
    onMessage('ACCOUNT_AUTH', message => accountService.auth(message.data))
    onMessage('ACCOUNT_CHECKOUT', message => accountService.checkout(message.data))
    onMessage('ACCOUNT_PORTAL', () => accountService.portal())
    onMessage('ACCOUNT_CFDI', () => accountService.cfdi())
    onMessage('ACCOUNT_LOGOUT', () => accountService.clear())
    onMessage('SYNC_STATUS', () => syncService.status())
    onMessage('SYNC_DESTROY', () => syncService.destroy())
    onMessage('SYNC_STOP', () => syncService.syncStop())
    onMessage('SYNC_UP', () => syncService.syncUp())
    onMessage('SYNC_REMOTE_HASH', () => syncService.remoteHash())
    onMessage('SYNC_DOWN', () => syncService.syncDown())
});
