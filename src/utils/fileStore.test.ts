import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryFileStore } from './memoryFileStore'
import { FileSystemFileStore } from './fileStore'

/* ── Fake File System Access API handles ─────────────────────── */

const notFound = () => new DOMException('not found', 'NotFoundError')

class FakeFileHandle {
  kind = 'file' as const
  constructor(
    public name: string,
    private dir: FakeDirectoryHandle,
  ) {}

  async getFile(): Promise<File> {
    const data = this.dir.contents.get(this.name)
    if (data === undefined) throw notFound()
    return new File([data], this.name)
  }

  async createWritable() {
    const dir = this.dir
    const name = this.name
    return {
      async write(data: string | Blob) {
        dir.contents.set(name, data)
      },
      async close() {},
    }
  }
}

class FakeDirectoryHandle {
  kind = 'dir' as const
  contents = new Map<string, string | Blob>()
  dirs = new Map<string, FakeDirectoryHandle>()
  constructor(public name = 'root') {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FakeDirectoryHandle> {
    let dir = this.dirs.get(name)
    if (!dir) {
      if (!options?.create) throw notFound()
      dir = new FakeDirectoryHandle(name)
      this.dirs.set(name, dir)
    }
    return dir
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFileHandle> {
    if (!this.contents.has(name)) {
      if (!options?.create) throw notFound()
      this.contents.set(name, '')
    }
    return new FakeFileHandle(name, this)
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.contents.delete(name) && !this.dirs.delete(name)) throw notFound()
  }

  async *values() {
    for (const name of this.contents.keys()) yield new FakeFileHandle(name, this)
    for (const dir of this.dirs.values()) yield dir
  }
}

const asHandle = (dir: FakeDirectoryHandle) => dir as unknown as FileSystemDirectoryHandle

/* ── MemoryFileStore ─────────────────────────────────────────── */

describe('MemoryFileStore', () => {
  it('returns the fallback when a path has never been written', async () => {
    const store = new MemoryFileStore()
    await expect(store.readJSON('missing.json', { a: 1 })).resolves.toEqual({ a: 1 })
  })

  it('round-trips JSON through writeJSON/readJSON', async () => {
    const store = new MemoryFileStore()
    await store.writeJSON('profile.json', { name: 'Alex', birthday: '1990-01' })
    await expect(store.readJSON('profile.json', {})).resolves.toEqual({ name: 'Alex', birthday: '1990-01' })
  })

  it('returns the fallback when stored JSON is corrupt', async () => {
    const store = new MemoryFileStore()
    await store.writeCSV('broken.json', [['not', 'json']])
    await expect(store.readJSON('broken.json', ['fallback'])).resolves.toEqual(['fallback'])
  })

  it('fires subscribers when writeJSON persists the path', async () => {
    const store = new MemoryFileStore()
    const cb = vi.fn()
    store.subscribe('accounts.json', cb)
    await store.writeJSON('accounts.json', [1, 2])
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('stops firing after unsubscribe', async () => {
    const store = new MemoryFileStore()
    const cb = vi.fn()
    const unsubscribe = store.subscribe('accounts.json', cb)
    unsubscribe()
    await store.writeJSON('accounts.json', [])
    expect(cb).not.toHaveBeenCalled()
  })

  it('round-trips CSV rows', async () => {
    const store = new MemoryFileStore()
    const rows = [
      ['month', 'accountId', 'balance'],
      ['2024-01', '1', '1,500'],
    ]
    await store.writeCSV('balances/2024.csv', rows)
    await expect(store.readCSV('balances/2024.csv')).resolves.toEqual(rows)
  })

  it('returns an empty matrix when reading a missing CSV', async () => {
    const store = new MemoryFileStore()
    await expect(store.readCSV('balances/1999.csv')).resolves.toEqual([])
  })

  it('round-trips binary data', async () => {
    const store = new MemoryFileStore()
    const buffer = new Uint8Array([1, 2, 3]).buffer
    await store.writeBinary('taxes/2024/files/w2.pdf', buffer)
    const read = await store.readBinary('taxes/2024/files/w2.pdf')
    expect(read && new Uint8Array(read)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('returns null when reading missing binary data', async () => {
    const store = new MemoryFileStore()
    await expect(store.readBinary('nope.bin')).resolves.toBeNull()
  })

  it('lists only direct children of a directory', async () => {
    const store = new MemoryFileStore()
    await store.writeCSV('balances/2023.csv', [['a']])
    await store.writeCSV('balances/2024.csv', [['a']])
    await store.writeCSV('balances/nested/2025.csv', [['a']])
    await store.writeJSON('accounts.json', [])
    await expect(store.listFiles('balances')).resolves.toEqual(['2023.csv', '2024.csv'])
  })

  it('lists root-level files when given an empty directory', async () => {
    const store = new MemoryFileStore()
    await store.writeJSON('accounts.json', [])
    await store.writeCSV('balances/2024.csv', [['a']])
    await expect(store.listFiles('')).resolves.toEqual(['accounts.json'])
  })

  it('removes a path on delete and reports it missing afterwards', async () => {
    const store = new MemoryFileStore()
    await store.writeJSON('goals.json', { a: 1 })
    await expect(store.exists('goals.json')).resolves.toBe(true)
    await store.delete('goals.json')
    await expect(store.exists('goals.json')).resolves.toBe(false)
    await expect(store.readJSON('goals.json', null)).resolves.toBeNull()
  })

  it('fires subscribers on delete', async () => {
    const store = new MemoryFileStore()
    const cb = vi.fn()
    await store.writeJSON('goals.json', {})
    store.subscribe('goals.json', cb)
    await store.delete('goals.json')
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('exposes no directory handle', () => {
    expect(new MemoryFileStore().getHandle()).toBeNull()
  })
})

/* ── FileSystemFileStore ─────────────────────────────────────── */

describe('FileSystemFileStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const setup = async () => {
    const root = new FakeDirectoryHandle()
    const store = new FileSystemFileStore()
    await store.init(asHandle(root))
    return { root, store }
  }

  it('returns the fallback before any folder is connected', async () => {
    const store = new FileSystemFileStore()
    await expect(store.readJSON('accounts.json', [])).resolves.toEqual([])
    expect(store.getHandle()).toBeNull()
  })

  it('exposes the directory handle after init', async () => {
    const { root, store } = await setup()
    expect(store.getHandle()).toBe(asHandle(root))
  })

  it('debounces writes and persists to the underlying directory', async () => {
    const { root, store } = await setup()
    const promise = store.writeJSON('accounts.json', [{ id: 1 }])
    expect(root.contents.has('accounts.json')).toBe(false)
    await vi.advanceTimersByTimeAsync(300)
    await promise
    expect(JSON.parse(String(root.contents.get('accounts.json')))).toEqual([{ id: 1 }])
  })

  it('serves reads from cache before the debounced write lands', async () => {
    const { store } = await setup()
    void store.writeJSON('accounts.json', [{ id: 7 }])
    await expect(store.readJSON('accounts.json', [])).resolves.toEqual([{ id: 7 }])
  })

  it('auto-creates nested directories on write', async () => {
    const { root, store } = await setup()
    const promise = store.writeCSV('transactions/2024/2024-01.csv', [['Date', 'Amount']])
    await vi.advanceTimersByTimeAsync(300)
    await promise
    const year = root.dirs.get('transactions')?.dirs.get('2024')
    expect(year?.contents.get('2024-01.csv')).toBe('Date,Amount')
  })

  it('reads CSV back from disk after the cache is bypassed', async () => {
    const { root, store } = await setup()
    root.contents.set('balances/2024.csv', 'ignored')
    const dir = await root.getDirectoryHandle('balances', { create: true })
    dir.contents.set('2024.csv', 'month,accountId,balance\n2024-01,1,100')
    await expect(store.readCSV('balances/2024.csv')).resolves.toEqual([
      ['month', 'accountId', 'balance'],
      ['2024-01', '1', '100'],
    ])
  })

  it('notifies subscribers once the write flushes', async () => {
    const { store } = await setup()
    const cb = vi.fn()
    store.subscribe('accounts.json', cb)
    const promise = store.writeJSON('accounts.json', [])
    expect(cb).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    await promise
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('coalesces rapid writes to the same path into one flush', async () => {
    const { root, store } = await setup()
    const first = store.writeJSON('accounts.json', [1])
    await vi.advanceTimersByTimeAsync(100)
    const second = store.writeJSON('accounts.json', [1, 2])
    await vi.advanceTimersByTimeAsync(300)
    await Promise.all([first, second])
    expect(JSON.parse(String(root.contents.get('accounts.json')))).toEqual([1, 2])
  })

  it('reports existence for files on disk and missing paths', async () => {
    const { root, store } = await setup()
    root.contents.set('profile.json', '{}')
    await expect(store.exists('profile.json')).resolves.toBe(true)
    await expect(store.exists('nothing.json')).resolves.toBe(false)
    await expect(store.exists('missing/dir/file.json')).resolves.toBe(false)
  })

  it('lists files in a directory and ignores subdirectories', async () => {
    const { root, store } = await setup()
    const dir = await root.getDirectoryHandle('balances', { create: true })
    dir.contents.set('2024.csv', '')
    dir.contents.set('2023.csv', '')
    await dir.getDirectoryHandle('nested', { create: true })
    await expect(store.listFiles('balances')).resolves.toEqual(['2023.csv', '2024.csv'])
  })

  it('returns an empty list for a directory that does not exist', async () => {
    const { store } = await setup()
    await expect(store.listFiles('balances')).resolves.toEqual([])
  })

  it('round-trips binary content', async () => {
    const { store } = await setup()
    const promise = store.writeBinary('taxes/2024/files/w2.pdf', new Uint8Array([9, 8, 7]).buffer)
    await vi.advanceTimersByTimeAsync(300)
    await promise
    const read = await store.readBinary('taxes/2024/files/w2.pdf')
    expect(read && new Uint8Array(read)).toEqual(new Uint8Array([9, 8, 7]))
  })

  it('returns null for missing binary content', async () => {
    const { store } = await setup()
    await expect(store.readBinary('taxes/2024/files/none.pdf')).resolves.toBeNull()
  })

  it('deletes files, drops the cache entry and stays quiet for missing files', async () => {
    const { root, store } = await setup()
    const promise = store.writeJSON('goals.json', { a: 1 })
    await vi.advanceTimersByTimeAsync(300)
    await promise
    await store.delete('goals.json')
    expect(root.contents.has('goals.json')).toBe(false)
    await expect(store.readJSON('goals.json', null)).resolves.toBeNull()
    await expect(store.delete('goals.json')).resolves.toBeUndefined()
  })

  it('cancels a queued write when the path is deleted first', async () => {
    const { root, store } = await setup()
    const promise = store.writeJSON('goals.json', { a: 1 })
    await store.delete('goals.json')
    await vi.advanceTimersByTimeAsync(300)
    await promise
    expect(root.contents.has('goals.json')).toBe(false)
  })

  it('flushes pending writes on demand', async () => {
    const { root, store } = await setup()
    const promise = store.writeJSON('accounts.json', ['flushed'])
    await store.flush()
    await promise
    expect(JSON.parse(String(root.contents.get('accounts.json')))).toEqual(['flushed'])
  })

  it('falls back when stored JSON cannot be parsed', async () => {
    const { root, store } = await setup()
    root.contents.set('accounts.json', '{not json')
    await expect(store.readJSON('accounts.json', ['fallback'])).resolves.toEqual(['fallback'])
  })
})
