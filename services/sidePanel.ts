export class SidePanelService {

    openTabs = new Set();

    private events = new EventTarget();

    constructor() {
        browser.sidePanel.onOpened.addListener((info) => {
            this.openTabs.add(info.tabId)

            if (this.openTabs.size > 0) {
                this.events.dispatchEvent(new Event("visible"));
            }
        })

        browser.sidePanel.onClosed.addListener((info) => {
            this.openTabs.delete(info.tabId)

            if (this.openTabs.size === 0) {
                this.events.dispatchEvent(new Event("hidden"));
            }
        })
    }

    onVisible(handler: () => void) {
        this.events.addEventListener("visible", handler);
    }

    onHidden(handler: () => void) {
        this.events.addEventListener("hidden", handler);
    }

    toggle(sender: Browser.runtime.MessageSender) {
        if (!sender.tab) {
            return;
        }

        return this.openTabs.has(sender.tab.id) ? this.close(sender) : this.open(sender);
    }

    open(sender: Browser.runtime.MessageSender) {
        if (!sender.tab) {
            return;
        }

        browser.sidePanel.setOptions({
            tabId: sender.tab.id,
            path: `app.html`,
            enabled: true
        })

        browser.sidePanel.open({
            tabId: sender.tab.id,
            windowId: sender.tab.windowId
        })
    }

    close(sender: Browser.runtime.MessageSender) {
        if (!sender.tab) {
            return;
        }

        browser.sidePanel.close({
            tabId: sender.tab.id,
            windowId: sender.tab.windowId
        })
    }
}
