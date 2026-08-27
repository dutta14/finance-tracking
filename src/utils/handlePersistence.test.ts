import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearHandle, loadHandle, saveHandle } from './handlePersistence'

describe('handlePersistence', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    if (typeof indexedDB !== 'undefined') await indexedDB.deleteDatabase('filestore-handle')
  })

  it('saves, loads, and clears a persisted directory handle', async () => {
    const handle = { name: 'Finance Data' } as FileSystemDirectoryHandle

    await saveHandle(handle)
    await expect(loadHandle()).resolves.toStrictEqual(handle)

    await clearHandle()
    await expect(loadHandle()).resolves.toBeNull()
  })

  it('returns null when indexedDB is unavailable during load', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(loadHandle()).resolves.toBeNull()
  })

  it('logs and swallows save and clear failures', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('indexedDB', undefined)

    await saveHandle({ name: 'Finance Data' } as FileSystemDirectoryHandle)
    await clearHandle()

    expect(errorSpy).toHaveBeenCalledTimes(2)
  })
})
