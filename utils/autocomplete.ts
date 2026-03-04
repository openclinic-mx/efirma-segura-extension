export const setFileInput = (input: HTMLInputElement, file: File) => {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files
    input.dispatchEvent(new Event("input", {bubbles: true}));
    input.dispatchEvent(new Event("change", {bubbles: true}));
}

export const setTextInput = (input: HTMLInputElement, value: string) => {
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    const setter = desc?.set;

    if (!setter) throw new Error('No native input value setter found');

    setter.call(input, value);

    input.dispatchEvent(new InputEvent("input", {bubbles: true, composed: true}));
    input.dispatchEvent(new Event("change", {bubbles: true}));
}

export const findCandidate = <T extends Element>(selectors: string[]) => {
    for (const selector of selectors) {
        const input = document.querySelector<T>(selector)
        if (input) {
            return input;
        }
    }
    return null;
}

export const TRIGGER_ID = 'efirmaAutocomplete'

export const TRIGGER_SELECTOR = `#${TRIGGER_ID}`

export const makeTrigger = (classList: string[] = ['btn', 'btn-success', 'boton']) => {
    const trigger = document.createElement("button");
    trigger.type = 'button';
    trigger.classList.add(...classList)
    trigger.id = TRIGGER_ID
    trigger.style.marginRight = '1rem'
    trigger.textContent = "Autocompletar";
    trigger.addEventListener('click', () => {
        browser.runtime.sendMessage({type: 'TOGGLE_TAB'})
    })
    return trigger;
}

export const tryRenderTrigger = (anchors: string[]) => {
    const hasTrigger = findCandidate([TRIGGER_SELECTOR]);

    if (hasTrigger) {
        return hasTrigger;
    }

    const anchor = findCandidate(anchors)

    if (!anchor) {
        return null;
    }

    if (!anchor.parentNode) {
        return null;
    }

    const trigger = makeTrigger()

    anchor.parentNode.prepend(trigger);

    return trigger;
}

export const trySubmitForm = async (candidates: string[]) => {
    await new Promise((resolve) => setTimeout(resolve, 275))

    const submitButton = findCandidate(candidates)

    if (!(submitButton instanceof HTMLButtonElement)) {
        return
    }

    window.addEventListener("pagehide", (e) => {
        browser.runtime.sendMessage({type: 'CLOSE_TAB'})
    }, {
        once: true
    });

    submitButton.click()
}
