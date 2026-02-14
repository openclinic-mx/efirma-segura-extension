// import database

export default defineBackground(() => {

    let openTabs = new Set();

    console.log('Hello background!', {id: browser.runtime.id});

    browser.sidePanel
        .setPanelBehavior({openPanelOnActionClick: true})
        .catch((error) => console.error(error))

    async function handleMessages(message, sender, sendResponse) {
        if (message.type === 'autocomplete') {
            if (openTabs.has(sender.tab.id)) {
                await browser.sidePanel.close({
                    tabId: sender.tab.id,
                })
            } else {
                browser.sidePanel.setOptions({
                    tabId: sender.tab.id,
                    path: 'app.html',
                    enabled: true
                })

                await browser.sidePanel.open({
                    tabId: sender.tab.id,
                })
            }
        }

        return true;
    }


    browser.sidePanel.onOpened.addListener((info) => {
        openTabs.add(info.tabId)
    })

    browser.sidePanel.onClosed.addListener((info) => {
        openTabs.delete(info.tabId)
    })


    browser.runtime.onMessage.addListener(handleMessages);

});
