import {storage} from '#imports';

export class StorageService {
    write(key: string, value: string) {
        return storage.setItem(`local:${key}`, value);
    }

    read(key: string) {
        return storage.getItem(`local:${key}`);
    }

    clear(key: string) {
        return storage.removeItem(`local:${key}`)
    }
}
