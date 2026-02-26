import {Consts, Credentials, Kdbx, KdbxEntry, ProtectedValue} from 'kdbxweb';
import {StorageService} from "./storage";
import {readBase64AsBytes, readBufferAsBase64} from "@/utils/files";

export class DatabaseService {

    readonly storageKey: string = "kdbxDatabase";

    private storage: StorageService;

    private credentials: Credentials | null = null;

    private events = new EventTarget();

    constructor(storage: StorageService) {
        this.storage = storage;
    }

    onSave(handler: () => void) {
        this.events.addEventListener("save", handler);
    }

    onClear(handler: () => void) {
        this.events.addEventListener("clear", handler);
    }

    async isInitialized(): Promise<boolean> {
        return !!(await this.storage.read(this.storageKey));
    }

    isUnlocked(): boolean {
        return this.credentials !== null;
    }

    private getDb(): Promise<Kdbx> {
        if (!this.credentials) {
            throw new Error("Credentials not found: Ensure database is open before interacting with it");
        }
        return this.open(this.credentials);
    }

    async initialize(masterPassword: string) {
        const credentials = new Credentials(ProtectedValue.fromString(masterPassword));
        const db = Kdbx.create(credentials, 'e.firma Segura');
        db.setVersion(4);
        db.setKdf(Consts.KdfId.Aes);
        await this.save(db);
        this.credentials = credentials;
    }

    public async import(base64: string) {
        return this.storage.write(this.storageKey, base64);
    }

    public async export() {
        return this.storage.read<string>(this.storageKey);
    }

    private async save(db: Kdbx) {
        const buffer = await db.save();
        this.events.dispatchEvent(new Event("save"));
        return this.import(readBufferAsBase64(buffer));
    }

    private async open(credentials: Credentials) {
        const base64 = await this.export()

        if (!base64) {
            throw new Error("Database not found: Ensure database is initialized");
        }

        const bytes = readBase64AsBytes(base64);

        return await Kdbx.load(bytes.buffer, credentials);
    }

    async unlock(masterPassword: string) {
        const credentials = new Credentials(
            ProtectedValue.fromString(masterPassword)
        )

        await this.open(credentials)

        this.credentials = credentials
    }

    lock() {
        this.credentials = null;
    }

    async getEntries(): Promise<KdbxEntry[]> {
        const db = await this.getDb();

        const group = db.getDefaultGroup();

        return group.entries;
    }

    async getEntry(uuid: string): Promise<KdbxEntry | null> {
        const db = await this.getDb();

        const group = db.getDefaultGroup();

        const entry = group.entries.find((entry) => entry.uuid.toString() === uuid) ?? null

        if (entry) {
            entry.times.update();
            entry.times.usageCount = (entry.times.usageCount ?? 0) + 1;
            await this.save(db);
        }

        return entry;
    }

    async addEntry(withData: (entry: KdbxEntry) => Promise<KdbxEntry>): Promise<string> {
        const db = await this.getDb();

        const group = db.getDefaultGroup();

        const entry = db.createEntry(group);

        await withData(entry)

        await this.save(db);

        return entry.uuid.toString();
    }

    async removeEntry(uuid: string) {
        const db = await this.getDb();

        const group = db.getDefaultGroup();

        const entry = group.entries
            .find((entry) => entry.uuid.toString() === uuid) ?? null

        if (!entry) {
            return false;
        }

        db.remove(entry);

        await this.save(db);

        return true;
    }


    async updatePassword(newPassword: string) {
        const db = await this.getDb();
        await db.credentials.setPassword(ProtectedValue.fromString(newPassword));
        await this.save(db);
        this.credentials = new Credentials(
            ProtectedValue.fromString(newPassword)
        )
    }

    deleteDatabase() {
        this.events.dispatchEvent(new Event("clear"));
        return this.silentlyDeleteDatabase();
    }

    silentlyDeleteDatabase() {
        return this.storage.clear(this.storageKey);
    }
}
