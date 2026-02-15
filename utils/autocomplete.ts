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
