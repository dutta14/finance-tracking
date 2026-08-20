import { createContext, useCallback, useContext, useEffect, useMemo, useState, FC, ReactNode } from 'react'
import { FileSystemFileStore } from '../utils/fileStore'
import { MemoryFileStore } from '../utils/memoryFileStore'
import type { FileStore } from '../utils/fileStoreTypes'
import { clearHandle, loadHandle, saveHandle } from '../utils/handlePersistence'
import { seedDemoData } from '../pages/settings/demoMode'

const DEMO_FLAG = '_demoMode'

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
