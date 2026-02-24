import {storage} from '#imports';

export class StorageService {
    write(key: string, value: any) {
        return storage.setItem(`local:${key}`, value);
    }

    read<T>(key: string) {
        return storage.getItem<T>(`local:${key}`);
    }

    clear(key: string) {
        return storage.removeItem(`local:${key}`)
    }
}
