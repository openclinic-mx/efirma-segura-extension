import {Consts, Credentials, CryptoEngine, Kdbx, KdbxEntry, ProtectedValue} from 'kdbxweb';
import argon2 from 'argon2-browser/dist/argon2-bundled.min';
import {StorageService} from "./storage";
import {readBufferAsBase64} from "@/utils/files";

CryptoEngine.setArgon2Impl(
    (password, salt, memory, iterations, length, parallelism, type, version) => {
        console.log('Using argon2 implementation', version);
        return argon2
            .hash({
                pass: new Uint8Array(password),
                salt: new Uint8Array(salt),
                time: iterations,
                mem: memory,
                hashLen: length,
                parallelism,
                type,
                version,
            })
            .then((v) => v.hash);
    }
);

export class DatabaseService {

    readonly storageKey: string = "kdbxDatabase";

    private storage: StorageService;

    private masterPassword: string = "";

    constructor(storage: StorageService) {
        this.storage = storage;
    }

    isInitialized(): boolean {
        return !!this.storage.read(this.storageKey);
    }

    isUnlocked(): boolean {
        return !!this.masterPassword;
    }

    assertUnlocked(): void {
        if (!this.isUnlocked()) {
            throw new Error("Credentials not found: Ensure database is open before interacting with it");
        }
    }

    async initialize(masterPassword: string) {
        const credentials = new Credentials(ProtectedValue.fromString(masterPassword));
        const db = Kdbx.create(credentials, 'e.firma Segura');
        db.setVersion(4);
        db.setKdf(Consts.KdfId.Aes);
        await this.save(db);
        this.masterPassword = masterPassword;
    }

    private async save(db: Kdbx) {
        const buffer = await db.save();
        await this.storage.write(this.storageKey, readBufferAsBase64(buffer));
    }

    private async open(masterPassword: string) {
        const base64 = await this.storage.read(this.storageKey);

        if (!base64) {
            throw new Error("Database not found: Ensure database is initialized");
        }

        const buffer = readBase64AsBuffer(base64 as string);

        const credentials = new Credentials(ProtectedValue.fromString(masterPassword));

        return await Kdbx.load(buffer, credentials);
    }

    async unlock(masterPassword: string) {
        await this.open(masterPassword);
        this.masterPassword = masterPassword;
    }

    lock() {
        this.masterPassword = "";
    }

    async getEntries(): Promise<KdbxEntry[]> {
        this.assertUnlocked();

        // every time we call this open should not include a master password but credentials,
        // and we should have a way to use reuse a db
        const db = await this.open(this.masterPassword);

        const group = db.getDefaultGroup();

        return group.entries;
    }

    async getEntry(uuid: string): Promise<KdbxEntry | null> {
        this.assertUnlocked();

        const db = await this.open(this.masterPassword);

        const group = db.getDefaultGroup();

        const entry = group.entries.find((entry) => entry.uuid.toString() === uuid) ?? null

        if (entry) {
            entry.pushHistory();
            entry.times.update();
            entry.times.usageCount = entry.times.usageCount ?? 0;
            entry.times.usageCount += 1;
            await this.save(db);
        }

        return entry;
    }

    async addEntry(withData: (entry: KdbxEntry) => Promise<KdbxEntry>): Promise<string> {
        this.assertUnlocked();

        const db = await this.open(this.masterPassword);

        const group = db.getDefaultGroup();

        const entry = db.createEntry(group);

        await withData(entry)

        await this.save(db);

        return entry.uuid.toString();
    }

    async removeEntry(uuid: string) {
        this.assertUnlocked();

        const db = await this.open(this.masterPassword);

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
        const db = await this.open(this.masterPassword);
        await db.credentials.setPassword(ProtectedValue.fromString(newPassword));
        await this.save(db);
    }

    deleteDatabase() {
        return this.storage.clear(this.storageKey);
    }
}
