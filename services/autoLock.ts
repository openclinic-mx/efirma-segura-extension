import {AutocompleteService} from "@/services/autocomplete";
import {VaultService} from "@/services/vault";
import {PasskeyService} from "@/services/passkey";
import {sendMessage} from "@/messaging";

export class AutoLockService {

    alarmName = 'lock'

    private events = new EventTarget();
    private minutes: number;
    private lockStart: number | null = null

    constructor(minutes = 5) {
        this.minutes = minutes;

        this.onStart(() => {
            this.lockStart = Date.now()
        })

        this.onClear(() => {
            this.lockStart = null
        })

        this.onStart(() => {
            sendMessage('TIMER_START', this.getStatus()).catch(() => {})
        })

        this.onClear(() => {
            sendMessage('TIMER_CLEAR', this.getStatus()).catch(() => {})
        })
    }

    getStatus() {
        return {
            lockStart: this.lockStart,
            lockDuration: (1000 * 60 * this.minutes)
        }
    }

    onLock(handler: () => void) {
        browser.alarms.onAlarm.addListener(async (alarm) => {
            if (alarm.name === this.alarmName) {
                handler();
            }
        });
    }

    onStart(handler: () => void) {
        this.events.addEventListener("start", handler);
    }

    onClear(handler: () => void) {
        this.events.addEventListener("clear", handler);
    }

    startTimer() {
        browser.alarms.create(this.alarmName, {
            delayInMinutes: this.minutes,
        });
        this.events.dispatchEvent(new Event("start"));

    }

    resetTimer() {
        this.clearTimer()
        this.startTimer()
    }

    clearTimer() {
        browser.alarms.clear(this.alarmName)
        this.events.dispatchEvent(new Event("clear"));
    }

    registerListeners(
        autocompleteService: AutocompleteService,
        vaultService: VaultService,
        passkeyService: PasskeyService,
    ) {
        autocompleteService.onRequest(() => {
            this.resetTimer()
        })

        vaultService.onUnlock(() => {
            this.startTimer()
        })

        vaultService.onLock(() => {
            this.clearTimer()
        })

        vaultService.onSignature(() => {
            this.resetTimer()
        })

        // exporting asks for the master password again
        vaultService.onActivity(() => {
            this.resetTimer()
        })

        // adding a passkey takes a password, a permission prompt and two biometric prompts
        passkeyService.onActivity(() => {
            this.resetTimer()
        })
    }
}
