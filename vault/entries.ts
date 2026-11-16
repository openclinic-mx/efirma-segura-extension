import {Kdbx, KdbxEntry} from 'kdbxweb';
import {Vault} from "./vault";

/** The e.firmas stored in the KDBX. Locking, unlocking and storage belong to Vault: each change is one
 * load -> change -> save, so nothing (a sync import, a passkey change) can land in between. */
export class Entries {

    private vault: Vault;

    constructor(vault: Vault) {
        this.vault = vault;
    }

    list(): Promise<KdbxEntry[]> {
        return this.vault.read((db) => db.getDefaultGroup().entries);
    }

    /** The entry, marked as used. */
    get(uuid: string): Promise<KdbxEntry | null> {
        return this.vault.update(async (db) => {
            const entry = db.getDefaultGroup().entries.find((entry) => entry.uuid.toString() === uuid) ?? null;

            if (entry) {
                entry.times.update();
                entry.times.usageCount = (entry.times.usageCount ?? 0) + 1;
            }

            return entry;
        });
    }

    addAll(withData: ((entry: KdbxEntry) => Promise<KdbxEntry>)[]): Promise<string[]> {
        return this.vault.update(async (db) => {
            const group = db.getDefaultGroup();

            const entries: KdbxEntry[] = [];

            for (const updateEntry of withData) {
                const entry = db.createEntry(group);
                await updateEntry(entry)
                entries.push(entry)
            }

            return entries.map(entry => entry.uuid.toString());
        });
    }

    add(withData: (entry: KdbxEntry) => Promise<KdbxEntry>): Promise<string> {
        return this.vault.update(async (db) => {
            const entry = db.createEntry(db.getDefaultGroup());

            await withData(entry)

            return entry.uuid.toString();
        });
    }

    remove(uuid: string): Promise<boolean> {
        return this.vault.update(async (db) => {
            const entry = db.getDefaultGroup().entries.find((entry) => entry.uuid.toString() === uuid) ?? null;

            if (!entry) {
                return false;
            }

            db.remove(entry);

            return true;
        });
    }
}
