// type-only: the side panel imports this module for extractionLifetimeMinutes, and must not load background services
import type {SignatureService} from "@/services/signature";
import type {StorageService} from "@/services/storage";
import {readBytesAsBase64} from "@/utils/files";

// How long extracted files stay on disk. Shown to the user, so keep it in whole minutes.
export const extractionLifetimeMinutes = 5

export type DownloadsApi = Pick<typeof browser.downloads, 'download' | 'search' | 'removeFile' | 'erase' | 'cancel'>

type PendingExtraction = {
    downloadId: number,
    expiresAt: number,
    signatureId: string,
}

// Inside the Downloads folder. Downloads can't delete folders, so it stays behind (empty) after cleanup:
// it's named after the extension, not the RFC, so it doesn't reveal whose files were extracted.
const folder = 'e.firma Segura'

/**
 * Extracts the .cer and .key of a signature to a folder in Downloads for a short time, then deletes them.
 *
 * Deletion goes through the downloads API, so it runs from the background (alarms, vault lock,
 * background start) even when the side panel is closed. Pending downloads are kept in storage
 * because the service worker can be killed before they expire.
 *
 * The password is never written to disk: the .key is already encrypted with it.
 */
export class ExtractionService {

    static readonly lifetime = extractionLifetimeMinutes * 60 * 1000

    // Files that could not be deleted (e.g. opened by another program on Windows) are retried.
    static readonly retryDelay = 60 * 1000

    readonly storageKey = 'pendingExtractions'

    readonly alarmName = 'extraction-cleanup'

    private events = new EventTarget();

    private signatureService: SignatureService

    private storage: StorageService

    // `downloads` is an optional permission: the API only exists once the user grants it.
    private downloads: () => DownloadsApi | undefined

    // Serializes reads and writes of the pending list (extraction and cleanup can overlap).
    private queue: Promise<unknown> = Promise.resolve()

    private objectUrls = new Map<number, string>()

    constructor(
        signatureService: SignatureService,
        storage: StorageService,
        downloads: () => DownloadsApi | undefined = () => browser.downloads,
    ) {
        this.signatureService = signatureService
        this.storage = storage
        this.downloads = downloads
    }

    onExtract(handler: () => void) {
        this.events.addEventListener("extract", handler);
    }

    registerListeners() {
        browser.alarms.onAlarm.addListener(async (alarm) => {
            if (alarm.name === this.alarmName) {
                await this.cleanup()
            }
        })
    }

    async extract(signatureId: string): Promise<{
        error: null,
        expiresAt: number,
        downloadIds: number[],
    } | {
        error: string
    }> {
        const downloads = this.downloads()

        if (!downloads) {
            return {error: 'Necesitamos permiso para descargar archivos.'}
        }

        try {
            const signature = await this.signatureService.getSignature(signatureId)

            if (!signature) {
                return {error: 'No encontramos esta e.firma.'}
            }

            // Extracting again replaces the previous copies, so the user gets fresh files with the same
            // names and a new timer. They are replaced rather than kept because the browser can't reliably
            // tell if they still exist: the user may have deleted them.
            await this.mutate(async pending => {
                const remaining: PendingExtraction[] = []

                for (const extraction of pending) {
                    // a copy that can't be deleted (e.g. open in another program) keeps its own timer
                    if (extraction.signatureId !== signatureId || !await this.remove(downloads, extraction.downloadId)) {
                        remaining.push(extraction)
                    }
                }

                return remaining
            })

            const expiresAt = Date.now() + ExtractionService.lifetime

            const downloadIds: number[] = []

            for (const file of ['cer', 'key'] as const) {
                const url = toDownloadUrl(signature[file])

                const downloadId = await downloads.download({
                    url,
                    filename: `${folder}/${signature.rfc}.${file}`,
                    conflictAction: 'uniquify',
                    // Always the default Downloads folder: predictable for the user, and usually
                    // outside folders synced to the cloud (OneDrive / iCloud Desktop & Documents).
                    saveAs: false,
                })

                if (url.startsWith('blob:')) {
                    this.objectUrls.set(downloadId, url)
                }

                downloadIds.push(downloadId)

                // Track each file as soon as it exists, so a later failure doesn't leave it behind.
                await this.mutate(pending => [...pending, {downloadId, expiresAt, signatureId}])
            }

            await this.schedule()

            this.events.dispatchEvent(new Event("extract"));

            return {error: null, expiresAt, downloadIds}
        } catch (e) {
            await this.schedule()

            return {error: e instanceof Error ? e.message : 'Unexpected error'}
        }
    }

    /**
     * Deletes the extracted files that already expired, or all of them with `all`.
     */
    async cleanup({all = false}: { all?: boolean } = {}) {
        const downloads = this.downloads()

        if (!downloads) {
            // Permission was revoked: keep them pending and try again next time.
            return
        }

        await this.mutate(async pending => {
            const now = Date.now()
            const remaining: PendingExtraction[] = []

            for (const extraction of pending) {
                if (!all && extraction.expiresAt > now) {
                    remaining.push(extraction)
                    continue
                }

                if (!await this.remove(downloads, extraction.downloadId)) {
                    // It is due now (even if the vault lock forced it early): retry soon.
                    remaining.push({...extraction, expiresAt: Math.min(extraction.expiresAt, now)})
                }
            }

            return remaining
        })

        await this.schedule()
    }

    async pending(): Promise<PendingExtraction[]> {
        return (await this.storage.read<PendingExtraction[]>(this.storageKey)) ?? []
    }

    private async remove(downloads: DownloadsApi, downloadId: number): Promise<boolean> {
        try {
            const [item] = await downloads.search({id: downloadId})

            if (item?.state === 'in_progress') {
                await downloads.cancel(downloadId)
            } else if (item?.exists) {
                await downloads.removeFile(downloadId)
            }

            if (item) {
                // Also drop it from the download history.
                await downloads.erase({id: downloadId})
            }

            this.revokeObjectUrl(downloadId)

            return true
        } catch (e) {
            return false
        }
    }

    private async schedule() {
        const pending = await this.pending()

        if (pending.length === 0) {
            await browser.alarms.clear(this.alarmName)
            return
        }

        const next = Math.min(...pending.map(extraction => extraction.expiresAt))

        await browser.alarms.create(this.alarmName, {
            when: Math.max(next, Date.now() + ExtractionService.retryDelay),
        })
    }

    private mutate(update: (pending: PendingExtraction[]) => PendingExtraction[] | Promise<PendingExtraction[]>) {
        const run = this.queue.then(async () => {
            await this.storage.write(this.storageKey, await update(await this.pending()))
        })

        this.queue = run.catch(() => {})

        return run
    }

    private revokeObjectUrl(downloadId: number) {
        const url = this.objectUrls.get(downloadId)

        if (url) {
            URL.revokeObjectURL(url)
            this.objectUrls.delete(downloadId)
        }
    }
}

// Chrome's service worker has no URL.createObjectURL, and Firefox refuses data: URLs in downloads.
const toDownloadUrl = (bytes: Uint8Array): string => {
    if (typeof URL.createObjectURL === 'function') {
        return URL.createObjectURL(new Blob([new Uint8Array(bytes)], {type: 'application/octet-stream'}))
    }

    return `data:application/octet-stream;base64,${readBytesAsBase64(bytes)}`
}
