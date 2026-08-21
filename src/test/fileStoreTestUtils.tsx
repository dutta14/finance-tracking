import { FC, ReactNode } from 'react'
import { FileStoreContext, FileStoreContextValue } from '../contexts/FileStoreContext'
import { MemoryFileStore } from '../utils/memoryFileStore'
import type { FileStore } from '../utils/fileStoreTypes'

/** Builds a fully-populated FileStoreContext value around any FileStore. */
export const makeFileStoreValue = (fileStore: FileStore): FileStoreContextValue => ({
  fileStore,
  isReady: true,
  folderName: 'test-folder',
  disconnect: () => {},
  pickFolder: async () => {},
  enterDemo: () => {},
  exitDemo: () => {},
})

interface Props {
  children: ReactNode
  store?: FileStore
}

/** Wraps children in a ready FileStoreContext backed by an in-memory store. */
export const FileStoreTestProvider: FC<Props> = ({ children, store }) => (
  <FileStoreContext.Provider value={makeFileStoreValue(store ?? new MemoryFileStore())}>
    {children}
  </FileStoreContext.Provider>
)
