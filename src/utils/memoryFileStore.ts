import type { FileStore } from './fileStoreTypes'
import { parseCSV, serializeCSV } from './csvUtils'

type Entry = string | ArrayBuffer

/**
 * In-memory FileStore. Writes land in a Map synchronously, so tests and demo
 * mode never touch disk. Subscribers fire on every write/delete for the path.
 */
export class MemoryFileStore implements FileStore {
  private files = new Map<string, Entry>()
  private subscribers = new Map<string, Set<() => void>>()

  async init(): Promise<void> {
    /* nothing to initialize */
  }

  getHandle(): FileSystemDirectoryHandle | null {
    return null
  }

  subscribe(path: string, cb: () => void): () => void {
    let set = this.subscribers.get(path)
    if (!set) {
      set = new Set()
      this.subscribers.set(path, set)
    }
    set.add(cb)
    return () => {
      this.subscribers.get(path)?.delete(cb)
    }
  }

  async readJSON<T>(path: string, fallback: T): Promise<T> {
    const raw = this.files.get(path)
    if (typeof raw !== 'string') return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  async writeJSON(path: string, data: unknown): Promise<void> {
    const serialized = JSON.stringify(data, null, 2)
    if (serialized === undefined) return
    this.files.set(path, serialized)
    this.notify(path)
  }

  async readCSV(path: string): Promise<string[][]> {
    const raw = this.files.get(path)
    if (typeof raw !== 'string') return []
    return parseCSV(raw)
  }

  async writeCSV(path: string, rows: string[][]): Promise<void> {
    this.files.set(path, serializeCSV(rows))
    this.notify(path)
  }

  async readBinary(path: string): Promise<ArrayBuffer | null> {
    const raw = this.files.get(path)
    return raw instanceof ArrayBuffer ? raw : null
  }

  async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
    this.files.set(path, data)
    this.notify(path)
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }

  async listFiles(dir: string): Promise<string[]> {
    const prefix = dir === '' || dir === '.' ? '' : dir.replace(/\/+$/, '') + '/'
    const names: string[] = []
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue
      const rest = key.slice(prefix.length)
      if (rest === '' || rest.includes('/')) continue
      names.push(rest)
    }
    return names.sort()
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path)
    this.notify(path)
  }

  private notify(path: string): void {
    const subs = this.subscribers.get(path)
    if (!subs) return
    for (const cb of [...subs]) {
      try {
        cb()
      } catch (error) {
        console.error('MemoryFileStore subscriber error:', error)
      }
    }
  }
}

export default MemoryFileStore
