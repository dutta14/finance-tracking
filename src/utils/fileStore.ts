import type { FileStore } from './fileStoreTypes'
import { parseCSV, serializeCSV } from './csvUtils'

const CHANNEL_NAME = 'filestore-sync'
const WRITE_DEBOUNCE_MS = 300

type Payload = { kind: 'text'; value: string } | { kind: 'binary'; value: ArrayBuffer }

interface PendingWrite {
  timer: ReturnType<typeof setTimeout>
  payload: Payload
  waiters: { resolve: () => void; reject: (reason: unknown) => void }[]
}

const isNotFound = (error: unknown): boolean =>
  error instanceof DOMException ? error.name === 'NotFoundError' : (error as { name?: string })?.name === 'NotFoundError'

const splitPath = (path: string): { dirs: string[]; name: string } => {
  const segments = path.split('/').filter(Boolean)
  const name = segments.pop() ?? ''
  return { dirs: segments, name }
}

async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks?.request) return fn()
  return locks.request(name, fn) as Promise<T>
}

/**
 * FileStore backed by the File System Access API.
 *
 * Reads are cached in memory; writes are debounced per path (300ms), guarded
 * by a `navigator.locks` lock so concurrent tabs never interleave, and
 * announced on a BroadcastChannel so other tabs drop their stale cache.
 */
export class FileSystemFileStore implements FileStore {
  private root: FileSystemDirectoryHandle | null = null
  private cache = new Map<string, unknown>()
  private pending = new Map<string, PendingWrite>()
  private subscribers = new Map<string, Set<() => void>>()
  private channel: BroadcastChannel | null = null

  async init(handle: FileSystemDirectoryHandle): Promise<void> {
    this.root = handle
    this.cache.clear()
    this.setupChannel()
  }

  getHandle(): FileSystemDirectoryHandle | null {
    return this.root
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
    if (this.cache.has(path)) return this.cache.get(path) as T
    const text = await this.readText(path)
    if (text === null) return fallback
    try {
      const parsed = JSON.parse(text) as T
      this.cache.set(path, parsed)
      return parsed
    } catch {
      return fallback
    }
  }

  async writeJSON(path: string, data: unknown): Promise<void> {
    const serialized = JSON.stringify(data, null, 2)
    if (serialized === undefined) {
      console.error(`FileStore.writeJSON: value for "${path}" is not serializable`)
      return
    }
    this.cache.set(path, data)
    return this.queueWrite(path, { kind: 'text', value: serialized })
  }

  async readCSV(path: string): Promise<string[][]> {
    const cached = this.cache.get(path)
    if (Array.isArray(cached)) return cached as string[][]
    const text = await this.readText(path)
    if (text === null) return []
    const rows = parseCSV(text)
    this.cache.set(path, rows)
    return rows
  }

  async writeCSV(path: string, rows: string[][]): Promise<void> {
    this.cache.set(path, rows)
    return this.queueWrite(path, { kind: 'text', value: serializeCSV(rows) })
  }

  async readBinary(path: string): Promise<ArrayBuffer | null> {
    const cached = this.cache.get(path)
    if (cached instanceof ArrayBuffer) return cached
    const file = await this.readFile(path)
    if (file === null) return null
    const buffer = await file.arrayBuffer()
    this.cache.set(path, buffer)
    return buffer
  }

  async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
    this.cache.set(path, data)
    return this.queueWrite(path, { kind: 'binary', value: data })
  }

  async exists(path: string): Promise<boolean> {
    if (this.cache.has(path)) return true
    if (!this.root) return false
    const { dirs, name } = splitPath(path)
    const dir = await this.resolveDir(dirs, false)
    if (!dir) return false
    try {
      await dir.getFileHandle(name)
      return true
    } catch (error) {
      if (isNotFound(error)) return false
      throw error
    }
  }

  async listFiles(dir: string): Promise<string[]> {
    if (!this.root) return []
    const segments = dir.split('/').filter(Boolean)
    const handle = await this.resolveDir(segments, false)
    if (!handle) return []
    const names: string[] = []
    try {
      for await (const entry of handle.values()) {
        names.push(entry.name)
      }
    } catch (error) {
      if (!isNotFound(error)) throw error
    }
    return names.sort()
  }

  async delete(path: string): Promise<void> {
    this.cache.delete(path)
    const queued = this.pending.get(path)
    if (queued) {
      clearTimeout(queued.timer)
      this.pending.delete(path)
      queued.waiters.forEach(w => w.resolve())
    }
    if (!this.root) return
    const { dirs, name } = splitPath(path)
    const dir = await this.resolveDir(dirs, false)
    if (!dir) return
    try {
      await withLock(`filestore:${path}`, () => dir.removeEntry(name))
    } catch (error) {
      if (!isNotFound(error)) throw error
    }
    this.announce(path)
  }

  /** Flushes any debounced writes immediately. */
  async flush(): Promise<void> {
    const paths = [...this.pending.keys()]
    await Promise.all(
      paths.map(path => {
        const entry = this.pending.get(path)
        if (!entry) return Promise.resolve()
        clearTimeout(entry.timer)
        return this.flushPath(path)
      }),
    )
  }

  /* ── Internals ─────────────────────────────────────────────── */

  private setupChannel(): void {
    if (this.channel || typeof BroadcastChannel === 'undefined') return
    this.channel = new BroadcastChannel(CHANNEL_NAME)
    this.channel.onmessage = (event: MessageEvent<{ path?: string }>) => {
      const path = event.data?.path
      if (!path) return
      this.cache.delete(path)
      this.notify(path)
    }
  }

  private notify(path: string): void {
    const subs = this.subscribers.get(path)
    if (!subs) return
    for (const cb of subs) {
      try {
        cb()
      } catch (error) {
        console.error('FileStore subscriber error:', error)
      }
    }
  }

  private announce(path: string): void {
    this.notify(path)
    try {
      this.channel?.postMessage({ path })
    } catch (error) {
      console.error('FileStore broadcast error:', error)
    }
  }

  private async resolveDir(segments: string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
    if (!this.root) return null
    let current = this.root
    for (const segment of segments) {
      try {
        current = await current.getDirectoryHandle(segment, { create })
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    }
    return current
  }

  private async readFile(path: string): Promise<File | null> {
    if (!this.root) return null
    const { dirs, name } = splitPath(path)
    const dir = await this.resolveDir(dirs, false)
    if (!dir) return null
    try {
      const handle = await dir.getFileHandle(name)
      return await handle.getFile()
    } catch (error) {
      if (isNotFound(error)) return null
      throw error
    }
  }

  private async readText(path: string): Promise<string | null> {
    const file = await this.readFile(path)
    return file === null ? null : file.text()
  }

  private queueWrite(path: string, payload: Payload): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const existing = this.pending.get(path)
      if (existing) {
        clearTimeout(existing.timer)
        existing.payload = payload
        existing.waiters.push({ resolve, reject })
        existing.timer = setTimeout(() => void this.flushPath(path), WRITE_DEBOUNCE_MS)
        return
      }
      this.pending.set(path, {
        payload,
        waiters: [{ resolve, reject }],
        timer: setTimeout(() => void this.flushPath(path), WRITE_DEBOUNCE_MS),
      })
    })
  }

  private async flushPath(path: string): Promise<void> {
    const entry = this.pending.get(path)
    if (!entry) return
    this.pending.delete(path)
    try {
      await this.persist(path, entry.payload)
      this.announce(path)
      entry.waiters.forEach(w => w.resolve())
    } catch (error) {
      entry.waiters.forEach(w => w.reject(error))
    }
  }

  private async persist(path: string, payload: Payload): Promise<void> {
    if (!this.root) return
    const { dirs, name } = splitPath(path)
    await withLock(`filestore:${path}`, async () => {
      const dir = await this.resolveDir(dirs, true)
      if (!dir) return
      const handle = await dir.getFileHandle(name, { create: true })
      const writable = await handle.createWritable()
      await writable.write(payload.kind === 'text' ? payload.value : new Blob([payload.value]))
      await writable.close()
    })
  }
}

/** Shared app-wide instance. Uninitialized until a folder is picked. */
export const createFileStore = (): FileStore => new FileSystemFileStore()

export default FileSystemFileStore
