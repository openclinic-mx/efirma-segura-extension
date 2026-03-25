export class WelcomeService {
    constructor() {
        browser.runtime.onInstalled.addListener(async (details) => {
            if (details.reason !== "install") {
                return;
            }
            browser.tabs.create({url: 'welcome.html'});
        })
    }
}
