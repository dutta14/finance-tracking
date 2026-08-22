import { createContext, useCallback, useContext, useEffect, useMemo, useState, FC, ReactNode } from 'react'
import { FileSystemFileStore } from '../utils/fileStore'
import { MemoryFileStore } from '../utils/memoryFileStore'
import type { FileStore } from '../utils/fileStoreTypes'
import { clearHandle, loadHandle, saveHandle } from '../utils/handlePersistence'
import { seedDemoData } from '../pages/settings/demoMode'
import { parseCSV, serializeCSV } from '../utils/csvUtils'

const DEMO_FLAG = '_demoMode'
const E2E_FLAG = '_e2eMode'
const E2E_SNAPSHOT_KEY = '__e2eSeedData'

type E2EWindow = Window & typeof globalThis & {
  __e2eSeedData?: Record<string, string>
  __e2eFileStore?: MemoryFileStore
}

type E2ESnapshotEntry = {
  type: 'text' | 'binary'
  content: string
}

const encodeBinary = (data: ArrayBuffer): string => {
  const bytes = new Uint8Array(data)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const decodeBinary = (content: string): ArrayBuffer => {
  const binary = atob(content)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export interface FileStoreContextValue {
  fileStore: FileStore
  isReady: boolean
  folderName: string
  disconnect: () => void
  pickFolder: () => Promise<void>
  enterDemo: () => void
  exitDemo: () => void
}

/** True when the app is currently showing seeded sample data. */
export const isDemoActive = (): boolean => {
  try {
    return localStorage.getItem(DEMO_FLAG) === '1'
  } catch {
    return false
  }
}

const defaultValue: FileStoreContextValue = {
  fileStore: new MemoryFileStore(),
  isReady: true,
  folderName: '',
  disconnect: () => {},
  pickFolder: async () => {},
  enterDemo: () => {},
  exitDemo: () => {},
}

export const FileStoreContext = createContext<FileStoreContextValue>(defaultValue)

/**
 * Tests and stories render components without a provider; falling back to an
 * in-memory store keeps them working instead of throwing.
 */
export const useFileStore = (): FileStoreContextValue => useContext(FileStoreContext)

export const FileStoreProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [fileStore, setFileStore] = useState<FileStore>(() => new FileSystemFileStore())
  const [isReady, setIsReady] = useState(false)
  const [folderName, setFolderName] = useState('')

  const enterDemo = useCallback(() => {
    const memory = new MemoryFileStore()
    seedDemoData(memory)
      .then(() => {
        try {
          localStorage.setItem(DEMO_FLAG, '1')
        } catch {
          /* storage unavailable — demo still works for this tab */
        }
        setFileStore(memory)
        setFolderName('Demo data')
        setIsReady(true)
      })
      .catch(error => console.error('Failed to seed demo data:', error))
  }, [])

  const exitDemo = useCallback(() => {
    try {
      localStorage.removeItem(DEMO_FLAG)
    } catch {
      /* ignore */
    }
    setFileStore(new FileSystemFileStore())
    setFolderName('')
    setIsReady(false)
    window.location.reload()
  }, [])

  const connect = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const store = new FileSystemFileStore()
    await store.init(handle)
    setFileStore(store)
    setFolderName(handle.name)
    setIsReady(true)
  }, [])

  const pickFolder = useCallback(async () => {
    if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
      throw new Error('unsupported-browser')
    }
    const handle = await window.showDirectoryPicker({ id: 'finance-tracking-root', mode: 'readwrite' })
    await saveHandle(handle)
    await connect(handle)
  }, [connect])

  const disconnect = useCallback(() => {
    clearHandle().catch(error => console.error('Failed to clear folder handle:', error))
    setFileStore(new FileSystemFileStore())
    setFolderName('')
    setIsReady(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    const restore = async () => {
      let e2eFlag = null
      try {
        e2eFlag = localStorage.getItem(E2E_FLAG)
      } catch {
        /* ignore */
      }

      if (e2eFlag === '1') {
        const memory = new MemoryFileStore()
        const e2eWindow = window as E2EWindow
        let snapshot: Record<string, E2ESnapshotEntry> = {}

        try {
          const persisted = localStorage.getItem(E2E_SNAPSHOT_KEY)
          if (persisted) {
            const parsed = JSON.parse(persisted) as Record<string, E2ESnapshotEntry>
            if (parsed && typeof parsed === 'object') snapshot = parsed
          } else if (e2eWindow.__e2eSeedData) {
            snapshot = Object.fromEntries(
              Object.entries(e2eWindow.__e2eSeedData).map(([path, content]) => [path, { type: 'text' as const, content }]),
            )
            localStorage.setItem(E2E_SNAPSHOT_KEY, JSON.stringify(snapshot))
          }
        } catch (error) {
          console.error('Failed to load E2E seed snapshot:', error)
        }

        for (const [path, entry] of Object.entries(snapshot)) {
          try {
            if (entry.type === 'binary') {
              await memory.writeBinary(path, decodeBinary(entry.content))
            } else if (path.endsWith('.csv')) {
              await memory.writeCSV(path, parseCSV(entry.content))
            } else {
              await memory.writeJSON(path, JSON.parse(entry.content))
            }
          } catch (error) {
            console.error(`Failed to seed E2E file ${path}:`, error)
          }
        }

        const persistSnapshot = () => {
          try {
            localStorage.setItem(E2E_SNAPSHOT_KEY, JSON.stringify(snapshot))
          } catch {
            /* ignore */
          }
        }

        const syncTaxIndexedDB = (store: { years?: Record<string, { items?: Array<{ files?: Array<{ id?: string }> }> }> }) => {
          void (async () => {
            try {
              const desiredIds = new Set<string>()
              Object.values(store.years ?? {}).forEach(year => {
                year.items?.forEach(item => item.files?.forEach(file => file.id && desiredIds.add(file.id)))
              })

              const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const req = indexedDB.open('finance-tracking-files', 1)
                req.onupgradeneeded = () => {
                  const next = req.result
                  if (!next.objectStoreNames.contains('tax-files')) next.createObjectStore('tax-files', { keyPath: 'id' })
                }
                req.onsuccess = () => resolve(req.result)
                req.onerror = () => reject(req.error)
              })

              const existingIds = await new Promise<string[]>((resolve, reject) => {
                const tx = db.transaction('tax-files', 'readonly')
                const req = tx.objectStore('tax-files').getAllKeys()
                req.onsuccess = () => resolve(req.result as string[])
                req.onerror = () => reject(req.error)
              })

              await new Promise<void>((resolve, reject) => {
                const tx = db.transaction('tax-files', 'readwrite')
                const storeRef = tx.objectStore('tax-files')
                for (const id of existingIds) {
                  if (!desiredIds.has(id)) storeRef.delete(id)
                }
                for (const id of desiredIds) {
                  if (!existingIds.includes(id)) storeRef.put({ id, content: '' })
                }
                tx.oncomplete = () => resolve()
                tx.onerror = () => reject(tx.error)
              })

              db.close()
            } catch (error) {
              console.error('Failed to sync E2E tax IndexedDB mirror:', error)
            }
          })()
        }

        const syncLegacyStorage = () => {
          const readText = (path: string): string | null => {
            const entry = snapshot[path]
            return entry?.type === 'text' ? entry.content : null
          }

          const parseJSONText = <T,>(path: string): T | null => {
            const raw = readText(path)
            if (!raw) return null
            try {
              return JSON.parse(raw) as T
            } catch {
              return null
            }
          }

          const writeLegacy = (key: string, value: unknown) => {
            if (value === null || value === undefined) {
              localStorage.removeItem(key)
              return
            }
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
          }

          writeLegacy('data-accounts', parseJSONText('accounts.json'))
          writeLegacy('user-profile', parseJSONText('profile.json'))

          const goals = parseJSONText<{ financialGoals?: unknown[]; gwGoals?: unknown[] }>('goals.json')
          writeLegacy('financialGoals', goals ? goals.financialGoals ?? [] : null)
          writeLegacy('gw-goals', goals ? goals.gwGoals ?? [] : null)

          const balanceFiles = Object.entries(snapshot)
            .filter(([path, entry]) => entry.type === 'text' && /^balances\/\d{4}\.csv$/.test(path))
            .sort(([a], [b]) => a.localeCompare(b))
          if (balanceFiles.length > 0) {
            const balances: Array<{ id: number; accountId: number; month: string; balance: number }> = []
            let nextId = 1
            for (const [, entry] of balanceFiles) {
              for (const row of parseCSV(entry.content)) {
                if (row.length < 3 || row[0] === 'month') continue
                const accountId = Number(row[1])
                const balance = Number(row[2])
                if (!Number.isFinite(accountId) || !Number.isFinite(balance)) continue
                balances.push({ id: nextId++, accountId, month: row[0], balance })
              }
            }
            writeLegacy('data-balances', balances)
          } else {
            writeLegacy('data-balances', null)
          }

          const budgetConfig = parseJSONText<{ version?: number; years?: number[]; categoryGroups?: unknown[] }>(
            'budget/categories.json',
          )
          const transactionFiles = Object.entries(snapshot)
            .filter(([path, entry]) => entry.type === 'text' && /^transactions\/\d{4}\/\d{4}-\d{2}\.csv$/.test(path))
            .sort(([a], [b]) => a.localeCompare(b))
          if (transactionFiles.length > 0 || budgetConfig) {
            const csvs: Record<string, { month: string; csv: string; uploadedAt: string }> = {}
            const years = new Set<number>(budgetConfig?.years ?? [])
            for (const [txPath, entry] of transactionFiles) {
              const monthKey = txPath.split('/').pop()!.replace('.csv', '')
              csvs[monthKey] = { month: monthKey, csv: entry.content, uploadedAt: '' }
              years.add(Number(monthKey.slice(0, 4)))
            }
            const orderedYears = [...years].filter(Number.isFinite).sort((a, b) => a - b)
            writeLegacy('budget-store', {
              csvs,
              configs: {},
              years: orderedYears,
              categoryGroups: budgetConfig?.categoryGroups ?? [],
            })
            writeLegacy(
              'budget-config',
              budgetConfig
                ? {
                    version: budgetConfig.version ?? 1,
                    years: orderedYears,
                    categoryGroups: budgetConfig.categoryGroups ?? [],
                  }
                : null,
            )
          } else {
            writeLegacy('budget-store', null)
            writeLegacy('budget-config', null)
          }
          writeLegacy('budget-summary', parseJSONText('budget/summary-cache.json'))

          const taxYearFiles = Object.entries(snapshot)
            .filter(([path, entry]) => entry.type === 'text' && /^taxes\/\d{4}\.json$/.test(path))
            .sort(([a], [b]) => a.localeCompare(b))
          if (taxYearFiles.length > 0) {
            const years: Record<string, unknown> = {}
            for (const [taxPath] of taxYearFiles) {
              const year = taxPath.match(/\d{4}/)?.[0]
              const data = parseJSONText(taxPath)
              if (year && data) years[year] = data
            }
            const taxStore = { years }
            writeLegacy('tax-store', taxStore)
            syncTaxIndexedDB(taxStore as { years?: Record<string, { items?: Array<{ files?: Array<{ id?: string }> }> }> })
          } else {
            writeLegacy('tax-store', null)
            syncTaxIndexedDB({ years: {} })
          }
          writeLegacy('tax-templates', parseJSONText('taxes/templates.json'))
          writeLegacy('allocation-custom-ratios', parseJSONText('allocation.json'))
          writeLegacy('fi-simulations', parseJSONText('fi-simulations.json'))
          writeLegacy('sgt-overrides', parseJSONText('savings-tracker-overrides.json'))
          writeLegacy('leverage', parseJSONText('leverage.json'))
        }

        syncLegacyStorage()

        const writeJSON = memory.writeJSON.bind(memory)
        memory.writeJSON = async (path, data) => {
          await writeJSON(path, data)
          const serialized = JSON.stringify(data, null, 2)
          if (serialized === undefined) return
          snapshot[path] = { type: 'text', content: serialized }
          persistSnapshot()
          syncLegacyStorage()
        }

        const writeCSV = memory.writeCSV.bind(memory)
        memory.writeCSV = async (path, rows) => {
          await writeCSV(path, rows)
          snapshot[path] = { type: 'text', content: serializeCSV(rows) }
          persistSnapshot()
          syncLegacyStorage()
        }

        const writeBinary = memory.writeBinary.bind(memory)
        memory.writeBinary = async (path, data) => {
          await writeBinary(path, data)
          snapshot[path] = { type: 'binary', content: encodeBinary(data) }
          persistSnapshot()
          syncLegacyStorage()
        }

        const remove = memory.delete.bind(memory)
        memory.delete = async path => {
          await remove(path)
          delete snapshot[path]
          persistSnapshot()
          syncLegacyStorage()
        }

        e2eWindow.__e2eFileStore = memory
        if (cancelled) return
        setFileStore(memory)
        setFolderName('E2E Test Data')
        setIsReady(true)
        return
      }

      if (isDemoActive()) {
        const memory = new MemoryFileStore()
        await seedDemoData(memory)
        if (cancelled) return
        setFileStore(memory)
        setFolderName('Demo data')
        setIsReady(true)
        return
      }

      const handle = await loadHandle()
      if (!handle || cancelled) return
      try {
        const permission = (await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'granted'
        if (permission !== 'granted' || cancelled) return
        await connect(handle)
      } catch (error) {
        console.error('Failed to reconnect data folder:', error)
      }
    }

    restore().catch(error => console.error('Failed to restore data folder:', error))
    return () => {
      cancelled = true
    }
  }, [connect])

  const value = useMemo<FileStoreContextValue>(
    () => ({ fileStore, isReady, folderName, disconnect, pickFolder, enterDemo, exitDemo }),
    [fileStore, isReady, folderName, disconnect, pickFolder, enterDemo, exitDemo],
  )

  return <FileStoreContext.Provider value={value}>{children}</FileStoreContext.Provider>
}

export default FileStoreContext
