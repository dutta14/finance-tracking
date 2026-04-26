/**
 * IndexedDB storage for tax document file content (base64 data URLs).
 *
 * Metadata (file name, ext, uploadedAt) stays in localStorage via useTaxStore.
 * Only binary content lives here, giving us GB+ storage vs the 5-10 MB
 * localStorage quota.
 */

const DB_NAME = 'finance-tracking-files'
const STORE_NAME = 'tax-files'
export const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Store base64 content by file ID */
export async function saveFileContent(id: string, content: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ id, content })
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

/** Retrieve base64 content by file ID */
export async function getFileContent(id: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => {
      db.close()
      resolve(req.result ? (req.result as { id: string; content: string }).content : null)
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** Remove a single file from IndexedDB */
export async function deleteFileContent(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

/** Batch-delete multiple files */
export async function deleteMultipleFiles(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const id of ids) store.delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

/** Get all stored file contents — used for GitHub sync */
export async function getAllFileContents(): Promise<Map<string, string>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      db.close()
      const map = new Map<string, string>()
      for (const row of req.result as { id: string; content: string }[]) {
        map.set(row.id, row.content)
      }
      resolve(map)
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** Estimate storage usage for the UI indicator */
export async function getStorageEstimate(): Promise<{ usedMB: number; quotaMB: number }> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    return {
      usedMB: Math.round(((est.usage ?? 0) / (1024 * 1024)) * 10) / 10,
      quotaMB: Math.round(((est.quota ?? 0) / (1024 * 1024)) * 10) / 10,
    }
  }
  // Fallback: sum up all stored content sizes
  const all = await getAllFileContents()
  let bytes = 0
  for (const content of all.values()) bytes += content.length
  return { usedMB: Math.round((bytes / (1024 * 1024)) * 10) / 10, quotaMB: 0 }
}
