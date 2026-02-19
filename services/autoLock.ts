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
}
