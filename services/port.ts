export class PortService {
    constructor() {
        browser.runtime.onConnect.addListener((port) => {
            if (port.name === 'heartbeat') {
                // The open port itself keeps the worker alive —
                // no need to send actual messages over it
            }
        });
    }
}
