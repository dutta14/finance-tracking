import 'fake-indexeddb/auto'
import { ReactNode, useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  fsInitMock,
  fsReadJSONMock,
  fsWriteJSONMock,
  fsSubscribeMock,
  loadHandleMock,
  saveHandleMock,
  clearHandleMock,
  seedDemoDataMock,
} = vi.hoisted(() => ({
  fsInitMock: vi.fn(() => Promise.resolve()),
  fsReadJSONMock: vi.fn((_path: string, fallback: unknown) => Promise.resolve(fallback)),
  fsWriteJSONMock: vi.fn(() => Promise.resolve()),
  fsSubscribeMock: vi.fn(() => () => {}),
  loadHandleMock: vi.fn<() => Promise<FileSystemDirectoryHandle | null>>(() => Promise.resolve(null)),
  saveHandleMock: vi.fn(() => Promise.resolve()),
  clearHandleMock: vi.fn(() => Promise.resolve()),
  seedDemoDataMock: vi.fn(() => Promise.resolve()),
}))

vi.mock('../utils/fileStore', () => ({
  FileSystemFileStore: class {
    init = fsInitMock
    readJSON = fsReadJSONMock
    writeJSON = fsWriteJSONMock
    subscribe = fsSubscribeMock
  },
}))

vi.mock('../utils/handlePersistence', () => ({
  loadHandle: loadHandleMock,
  saveHandle: saveHandleMock,
  clearHandle: clearHandleMock,
}))

vi.mock('../pages/settings/demoMode', () => ({
  seedDemoData: seedDemoDataMock,
}))

import { FileStoreProvider, isDemoActive, useFileStore } from './FileStoreContext'

function Consumer() {
  const { isReady, folderName, pickFolder, disconnect, enterDemo, exitDemo, fileStore } = useFileStore()
  const [pickError, setPickError] = useState('')
  return (
    <div>
      <span data-testid="ready">{String(isReady)}</span>
      <span data-testid="folder">{folderName}</span>
      <span data-testid="store-type">{fileStore.constructor.name}</span>
      <span data-testid="pick-error">{pickError}</span>
      <button onClick={() => void pickFolder().catch(error => setPickError(String(error.message)))}>Pick</button>
      <button onClick={disconnect}>Disconnect</button>
      <button onClick={enterDemo}>Demo</button>
      <button onClick={exitDemo}>Exit Demo</button>
    </div>
  )
}

const renderProvider = (children: ReactNode = <Consumer />) => render(<FileStoreProvider>{children}</FileStoreProvider>)

describe('FileStoreContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.restoreAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: vi.fn() },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports demo mode state defensively', () => {
    expect(isDemoActive()).toBe(false)
    localStorage.setItem('_demoMode', '1')
    expect(isDemoActive()).toBe(true)

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(isDemoActive()).toBe(false)
    getItemSpy.mockRestore()
  })

  it('enters and exits demo mode', async () => {
    const user = userEvent.setup()
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'Demo' }))

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true')
      expect(screen.getByTestId('folder')).toHaveTextContent('Demo data')
    })
    expect(localStorage.getItem('_demoMode')).toBe('1')
    expect(seedDemoDataMock).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Exit Demo' }))

    expect(localStorage.getItem('_demoMode')).toBeNull()
    expect(window.location.reload).toHaveBeenCalledOnce()
    expect(screen.getByTestId('ready')).toHaveTextContent('false')
    expect(screen.getByTestId('folder')).toHaveTextContent('')
  })

  it('restores demo mode on mount when the flag is already set', async () => {
    localStorage.setItem('_demoMode', '1')

    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true')
      expect(screen.getByTestId('folder')).toHaveTextContent('Demo data')
    })
    expect(seedDemoDataMock).toHaveBeenCalledOnce()
  })

  it('picks a directory handle, saves it, and connects a file system store', async () => {
    const user = userEvent.setup()
    const handle = {
      name: 'Finance Root',
      requestPermission: vi.fn(async (): Promise<PermissionState> => 'granted'),
    } as unknown as FileSystemDirectoryHandle
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn(() => Promise.resolve(handle)),
    })

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'Pick' }))

    await waitFor(() => {
      expect(saveHandleMock).toHaveBeenCalledWith(handle)
      expect(fsInitMock).toHaveBeenCalledWith(handle)
      expect(screen.getByTestId('ready')).toHaveTextContent('true')
      expect(screen.getByTestId('folder')).toHaveTextContent('Finance Root')
    })
  })

  it('surfaces an unsupported-browser error when folder picking is unavailable', async () => {
    const user = userEvent.setup()
    renderProvider()
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined })

    await user.click(screen.getByRole('button', { name: 'Pick' }))

    await waitFor(() => {
      expect(screen.getByTestId('pick-error')).toHaveTextContent('unsupported-browser')
    })
  })

  it('disconnects and clears the persisted handle', async () => {
    const user = userEvent.setup()
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'Disconnect' }))

    expect(clearHandleMock).toHaveBeenCalledOnce()
    expect(screen.getByTestId('ready')).toHaveTextContent('false')
    expect(screen.getByTestId('folder')).toHaveTextContent('')
  })

  it('restores a saved handle when permission is granted', async () => {
    loadHandleMock.mockResolvedValueOnce({
      name: 'Restored Folder',
      requestPermission: vi.fn(async (): Promise<PermissionState> => 'granted'),
    } as unknown as FileSystemDirectoryHandle)

    renderProvider()

    await waitFor(() => {
      expect(fsInitMock).toHaveBeenCalled()
      expect(screen.getByTestId('ready')).toHaveTextContent('true')
      expect(screen.getByTestId('folder')).toHaveTextContent('Restored Folder')
    })
  })

  it('skips reconnecting when permission is denied', async () => {
    loadHandleMock.mockResolvedValueOnce({
      name: 'Private Folder',
      requestPermission: vi.fn(async (): Promise<PermissionState> => 'denied'),
    } as unknown as FileSystemDirectoryHandle)

    renderProvider()

    await waitFor(() => {
      expect(loadHandleMock).toHaveBeenCalledOnce()
    })
    expect(fsInitMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('ready')).toHaveTextContent('false')
  })

  it('restores e2e seed data and syncs legacy localStorage snapshots', async () => {
    localStorage.setItem('_e2eMode', '1')
    ;(window as Window & typeof globalThis & { __e2eSeedData?: Record<string, string> }).__e2eSeedData = {
      'accounts.json': JSON.stringify([{ id: 1, name: 'Visa', nature: 'liability' }]),
      'profile.json': JSON.stringify({ name: 'Alex', birthday: '1990-01-01', avatarDataUrl: '', partner: null }),
      'goals.json': JSON.stringify({ financialGoals: [{ id: 1 }], gwGoals: [{ id: 2 }] }),
      'balances/2026.csv': 'month,accountId,balance\n2026-01,1,-500',
      'budget/categories.json': JSON.stringify({ version: 1, years: [2026], categoryGroups: [] }),
      'transactions/2026/2026-01.csv': 'Date,Category,Amount\n2026-01-01,Salary,5000',
      'taxes/2026.json': JSON.stringify({ items: [{ files: [{ id: 'file-1' }] }] }),
      'taxes/templates.json': JSON.stringify([{ id: 'tpl' }]),
      'allocation.json': JSON.stringify([{ id: 'alloc-1' }]),
      'fi-simulations.json': JSON.stringify([{ name: 'Base Case' }]),
      'savings-tracker-overrides.json': JSON.stringify({ custom: true }),
      'leverage.json': JSON.stringify({ target: 2.5 }),
    }

    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true')
      expect(screen.getByTestId('folder')).toHaveTextContent('E2E Test Data')
    })
    expect(localStorage.getItem('__e2eSeedData')).toContain('accounts.json')
    expect(localStorage.getItem('data-accounts')).toContain('Visa')
    expect(localStorage.getItem('user-profile')).toContain('Alex')
    expect(localStorage.getItem('budget-store')).toContain('2026-01')
    expect(localStorage.getItem('tax-store')).toContain('2026')
    expect(localStorage.getItem('leverage')).toContain('2.5')

    const e2eStore = (
      window as Window &
        typeof globalThis & {
          __e2eFileStore?: {
            writeJSON: (path: string, data: unknown) => Promise<void>
            delete: (path: string) => Promise<void>
          }
        }
    ).__e2eFileStore
    expect(e2eStore).toBeTruthy()

    await act(async () => {
      await e2eStore!.writeJSON('profile.json', { name: 'Updated', birthday: '', avatarDataUrl: '', partner: null })
      await e2eStore!.delete('leverage.json')
    })

    expect(localStorage.getItem('__e2eSeedData')).toContain('Updated')
    expect(localStorage.getItem('__e2eSeedData')).not.toContain('leverage.json')
  })
})
