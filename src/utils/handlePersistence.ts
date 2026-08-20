/**
 * Persists the user-selected root directory handle in IndexedDB so the app
 * can reconnect to the same folder after a reload (subject to the browser
 * re-granting permission).
 */

const DB_NAME = 'filestore-handle'
const STORE_NAME = 'handles'
const KEY = 'root'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const request = action(tx.objectStore(STORE_NAME))
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => db.close()
      }),
  )
}

export async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    await run<void>('readwrite', store => store.put(handle, KEY))
  } catch (error) {
    console.error('Failed to persist folder handle:', error)
  }
}

export async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await run<FileSystemDirectoryHandle | undefined>('readonly', store => store.get(KEY))
    return handle ?? null
  } catch {
    return null
  }
}

export async function clearHandle(): Promise<void> {
  try {
    await run<void>('readwrite', store => store.delete(KEY))
  } catch (error) {
    console.error('Failed to clear folder handle:', error)
  }
}
