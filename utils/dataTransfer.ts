export type TreeLeave = File | TreeLeave[] | null

export interface SignatureFolder {
    keys: File[],
    cers: File[],
    txts: File[],
}

const isDirectory = (entry: FileSystemEntry): entry is FileSystemDirectoryEntry => {
    return entry.isDirectory
}

const isFile = (entry: FileSystemEntry): entry is FileSystemFileEntry => {
    return entry.isFile
}

async function* readChildren(entry: FileSystemDirectoryEntry): AsyncGenerator<FileSystemEntry> {
    const reader = entry.createReader()
    const readBatch = () => new Promise<FileSystemEntry[]>(reader.readEntries.bind(reader));

    let batch: FileSystemEntry[];

    do {
        batch = await readBatch();
        yield* batch;
    } while (batch.length > 0);
}

const isWhitelisted = (name: string, allowedExtensions: string[] = ['.cer', '.txt', '.key']) => {
    return allowedExtensions.some(extension => name.endsWith(extension))
}

const entryToTree = async (fileSystemEntry: FileSystemEntry): Promise<TreeLeave> => {
    if (isDirectory(fileSystemEntry)) {
        const entries: FileSystemEntry[] = [];
        for await (const entry of readChildren(fileSystemEntry)) {
            entries.push(entry);
        }

        const items = await Promise.all(entries.map(entryToTree));

        return items.filter(item => item !== null)
    }

    if (isFile(fileSystemEntry)) {

        if (isWhitelisted(fileSystemEntry.name)) {
            return await new Promise<File>(fileSystemEntry.file.bind(fileSystemEntry))
        }

        return null
    }

    return null
}


const isSignatureFolder = (leave: TreeLeave): leave is TreeLeave[] => {
    if (!Array.isArray(leave)) {
        return false;
    }

    const files = leave.filter((leave): leave is File => {
        return !Array.isArray(leave) && leave !== null
    })

    return files.some(file => file.name.endsWith('.txt'))
        && files.some(file => file.name.endsWith('.cer'))
        && files.some(file => file.name.endsWith('.key'));
}

const asSignatureFolder = (t: TreeLeave[]): SignatureFolder => {
    const files = t.filter((leave): leave is File => {
        return !Array.isArray(leave) && leave !== null
    })

    return {
        keys: files.filter(file => file.name.endsWith('.key')),
        cers: files.filter(file => file.name.endsWith('.cer')),
        txts: files.filter(file => file.name.endsWith('.txt')),
    }
}

export const getSignatureFolders = async (e: DragEvent) => {
    if (!e.dataTransfer) return [];

    const entries = [...e.dataTransfer.items]
        .map(item => item.webkitGetAsEntry())

    const tree = await Promise.all(
        entries.map(async entry => {
            if (!entry) {
                return null
            }

            return entryToTree(entry)
        })
    )

    const findSignatureFolders = (t: TreeLeave): SignatureFolder[] => {
        if (isSignatureFolder(t)) {
            return [
                asSignatureFolder(t),
                ...(t.flatMap(findSignatureFolders))
            ];
        }

        if (Array.isArray(t)) {
            return t.flatMap(findSignatureFolders)
        }

        return []
    }

    return findSignatureFolders(tree)
}
