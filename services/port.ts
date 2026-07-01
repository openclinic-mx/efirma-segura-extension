export class PortService {
    constructor() {
        browser.runtime.onConnect.addListener((port) => {
            if (port.name === 'heartbeat') {
                return true;
            }
        });
    }
}
