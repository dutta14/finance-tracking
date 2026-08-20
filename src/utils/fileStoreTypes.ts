/**
 * FileStore — the storage abstraction the whole app writes through.
 *
 * Two implementations exist:
 *  - `FileSystemFileStore` (src/utils/fileStore.ts) — backed by the File
 *    System Access API, writing real files into a user-chosen folder.
 *  - `MemoryFileStore` (src/utils/memoryFileStore.ts) — backed by a Map,
 *    used by tests and by demo mode.
 *
 * All paths are POSIX-style, relative to the store root, e.g.
 * `accounts.json`, `balances/2024.csv`, `taxes/2023/files/w2.pdf`.
 */
export interface FileStore {
  init(handle: FileSystemDirectoryHandle): Promise<void>
  readJSON<T>(path: string, fallback: T): Promise<T>
  writeJSON(path: string, data: unknown): Promise<void>
  readCSV(path: string): Promise<string[][]>
  writeCSV(path: string, rows: string[][]): Promise<void>
  readBinary(path: string): Promise<ArrayBuffer | null>
  writeBinary(path: string, data: ArrayBuffer): Promise<void>
  exists(path: string): Promise<boolean>
  listFiles(dir: string): Promise<string[]>
  delete(path: string): Promise<void>
  getHandle(): FileSystemDirectoryHandle | null
  subscribe(path: string, cb: () => void): () => void
}
