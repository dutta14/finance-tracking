import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { render, screen, act } from '@testing-library/react'
import { ImportExportProvider, useImportExport } from './ImportExportContext'
import { GoalsProvider } from './GoalsContext'
import { SettingsProvider } from './SettingsContext'
import type { ReactNode } from 'react'

/* ── helpers ─────────────────────────────────────────────────────── */

function setupMockFileReader(content: string) {
  const mockReader = {
    readAsText: vi.fn(function (this: FileReader) {
      Object.defineProperty(this, 'result', { value: content, writable: true })
      if (this.onload) this.onload({ target: this } as ProgressEvent<FileReader>)
    }),
    onload: null as ((ev: ProgressEvent<FileReader>) => void) | null,
    onerror: null as ((ev: ProgressEvent<FileReader>) => void) | null,
  }
  const OriginalFileReader = globalThis.FileReader
  globalThis.FileReader = function () {
    return mockReader
  } as unknown as typeof FileReader
  return {
    mockReader,
    restore: () => {
      globalThis.FileReader = OriginalFileReader
    },
  }
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GoalsProvider>
      <ImportExportProvider>{children}</ImportExportProvider>
    </GoalsProvider>
  </SettingsProvider>
)

function ImportExportConsumer() {
  const ctx = useImportExport()
  return (
    <div>
      <span data-testid="hasExport">{String(typeof ctx.handleExport === 'function')}</span>
      <span data-testid="hasImport">{String(typeof ctx.handleImport === 'function')}</span>
      <span data-testid="hasReset">{String(typeof ctx.handleFactoryReset === 'function')}</span>
      <button data-testid="export" onClick={ctx.handleExport} />
    </div>
  )
}

/* ── setup ───────────────────────────────────────────────────────── */

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/* ── tests ───────────────────────────────────────────────────────── */

describe('ImportExportContext', () => {
  it('useImportExport throws when used outside ImportExportProvider', () => {
    expect(() => {
      renderHook(() => useImportExport())
    }).toThrow('useImportExport must be used within an <ImportExportProvider>')
  })

  it('provides all three handler functions', () => {
    render(
      <SettingsProvider>
        <GoalsProvider>
          <ImportExportProvider>
            <ImportExportConsumer />
          </ImportExportProvider>
        </GoalsProvider>
      </SettingsProvider>,
    )

    expect(screen.getByTestId('hasExport').textContent).toBe('true')
    expect(screen.getByTestId('hasImport').textContent).toBe('true')
    expect(screen.getByTestId('hasReset').textContent).toBe('true')
  })

  it('handleExport creates a download link', () => {
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    const clickSpy = vi.fn()
    const origCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement')

    Object.defineProperty(window, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
      configurable: true,
    })

    createElementSpy.mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = {
          _href: '',
          download: '',
          click: clickSpy,
          set href(v: string) {
            this._href = v
          },
          get href() {
            return this._href
          },
        }
        return anchor as unknown as HTMLAnchorElement
      }
      return origCreateElement(tag)
    })

    render(
      <SettingsProvider>
        <GoalsProvider>
          <ImportExportProvider>
            <ImportExportConsumer />
          </ImportExportProvider>
        </GoalsProvider>
      </SettingsProvider>,
    )

    act(() => {
      screen.getByTestId('export').click()
    })

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)

    createElementSpy.mockRestore()
  })

  it('handleFactoryReset clears localStorage and reloads page', () => {
    // Mock window.location.reload
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    })

    localStorage.setItem('test-key', 'test-value')
    localStorage.setItem('goals', JSON.stringify([]))
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Test' }))
    localStorage.setItem('data-accounts', JSON.stringify([]))

    const { result } = renderHook(() => useImportExport(), { wrapper })

    act(() => {
      result.current.handleFactoryReset()
    })

    expect(localStorage.getItem('test-key')).toBeNull()
    expect(localStorage.getItem('goals')).toBeNull()
    expect(localStorage.getItem('user-profile')).toBeNull()
    expect(localStorage.getItem('data-accounts')).toBeNull()
    expect(localStorage.length).toBe(0)
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('provides context via hook', () => {
    const { result } = renderHook(() => useImportExport(), { wrapper })

    expect(typeof result.current.handleExport).toBe('function')
    expect(typeof result.current.handleImport).toBe('function')
    expect(typeof result.current.handleFactoryReset).toBe('function')
  })

  describe('handleExport details', () => {
    let createObjectURL: ReturnType<typeof vi.fn>
    let revokeObjectURL: ReturnType<typeof vi.fn>
    let capturedBlob: Blob | null
    let createElementSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      createObjectURL = vi.fn(() => 'blob:test-url')
      revokeObjectURL = vi.fn()
      capturedBlob = null
      createObjectURL.mockImplementation((blob: Blob) => {
        capturedBlob = blob
        return 'blob:test-url'
      })

      Object.defineProperty(window, 'URL', {
        value: { createObjectURL, revokeObjectURL },
        writable: true,
        configurable: true,
      })

      const origCreateElement = document.createElement.bind(document)
      createElementSpy = vi.spyOn(document, 'createElement')
      createElementSpy.mockImplementation((tag: string) => {
        if (tag === 'a') {
          const anchor = {
            _href: '',
            download: '',
            click: vi.fn(),
            set href(v: string) {
              anchor._href = v
            },
            get href() {
              return anchor._href
            },
          }
          return anchor as unknown as HTMLAnchorElement
        }
        return origCreateElement(tag)
      })
    })

    afterEach(() => {
      createElementSpy.mockRestore()
    })

    it('includes version and timestamp in exported JSON', async () => {
      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleExport()
      })

      expect(capturedBlob).not.toBeNull()
      const text = await capturedBlob!.text()
      const parsed = JSON.parse(text)
      expect(parsed.version).toBe(2)
      expect(parsed.exportedAt).toBeTruthy()
      expect(new Date(parsed.exportedAt).getTime()).not.toBeNaN()
    })

    it('includes all data domains in exported JSON', async () => {
      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleExport()
      })

      const text = await capturedBlob!.text()
      const parsed = JSON.parse(text)
      expect(parsed).toHaveProperty('goals')
      expect(parsed).toHaveProperty('gwGoals')
      expect(parsed).toHaveProperty('profile')
      expect(parsed).toHaveProperty('settings')
      expect(parsed).toHaveProperty('dataAccounts')
      expect(parsed).toHaveProperty('dataBalances')
      expect(parsed).toHaveProperty('budgetCsvs')
      expect(parsed).toHaveProperty('budgetConfig')
      expect(parsed).toHaveProperty('fiSimulations')
      expect(parsed).toHaveProperty('sgtOverrides')
      expect(parsed).toHaveProperty('allocationCustomRatios')
      expect(parsed).toHaveProperty('taxStore')
      expect(parsed).toHaveProperty('taxTemplates')
    })

    it('triggers download via blob URL', () => {
      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleExport()
      })

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
    })

    it('sets download filename with date', async () => {
      let capturedDownload = ''
      const origCreateElement = document.createElement.bind(document)
      createElementSpy.mockRestore()
      createElementSpy = vi.spyOn(document, 'createElement')
      createElementSpy.mockImplementation((tag: string) => {
        if (tag === 'a') {
          const anchor = {
            _href: '',
            _download: '',
            click: vi.fn(),
            set href(v: string) {
              anchor._href = v
            },
            get href() {
              return anchor._href
            },
            set download(v: string) {
              anchor._download = v
              capturedDownload = v
            },
            get download() {
              return anchor._download
            },
          }
          return anchor as unknown as HTMLAnchorElement
        }
        return origCreateElement(tag)
      })

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleExport()
      })

      expect(capturedDownload).toMatch(/^finance-goals-\d{4}-\d{2}-\d{2}\.json$/)
    })

    it('exports settings including goalViewMode and homeCardOrder', async () => {
      localStorage.setItem('goal-view-mode', JSON.stringify('grid'))
      localStorage.setItem('home-card-order', JSON.stringify([3, 2, 1, 0]))

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleExport()
      })

      const text = await capturedBlob!.text()
      const parsed = JSON.parse(text)
      expect(parsed.settings).toBeTruthy()
      expect(parsed.settings.accentTheme).toBeDefined()
      expect(parsed.settings.darkMode).toBeDefined()
    })
  })

  describe('handleImport', () => {
    let fileReaderRestore: (() => void) | null = null

    afterEach(() => {
      if (fileReaderRestore) {
        fileReaderRestore()
        fileReaderRestore = null
      }
    })

    it('reads File via FileReader', () => {
      const validPayload = JSON.stringify({ version: 2, goals: [] })
      const { mockReader: mockFR, restore } = setupMockFileReader(validPayload)
      fileReaderRestore = restore

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleImport(new File([validPayload], 'test.json'))
      })

      expect(mockFR.readAsText).toHaveBeenCalledTimes(1)
    })

    it('validates payload and alerts on invalid data', () => {
      const invalidPayload = JSON.stringify({ version: 2 })
      const { restore } = setupMockFileReader(invalidPayload)
      fileReaderRestore = restore
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleImport(new File([invalidPayload], 'test.json'))
      })

      expect(alertSpy).toHaveBeenCalledTimes(1)
      expect(alertSpy.mock.calls[0][0]).toContain('Import failed')

      alertSpy.mockRestore()
    })

    it('alerts on non-JSON file content', () => {
      const { restore } = setupMockFileReader('this is not json')
      fileReaderRestore = restore
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleImport(new File(['not json'], 'test.txt'))
      })

      expect(alertSpy).toHaveBeenCalledWith('Could not import: the file is not valid JSON.')
      alertSpy.mockRestore()
    })

    it('restores goals from valid import payload', () => {
      vi.useFakeTimers()
      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      })

      const validPayload = JSON.stringify({
        version: 2,
        goals: [{ id: 1, goalName: 'Retirement', targetAmount: 1000000, currentAmount: 50000 }],
      })
      fileReaderRestore = setupMockFileReader(validPayload).restore

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleImport(new File([validPayload], 'test.json'))
      })

      // Should have dispatched data-changed and scheduled reload
      vi.advanceTimersByTime(300)
      expect(reloadMock).toHaveBeenCalled()
    })

    it('dispatches data-changed event on successful import', () => {
      vi.useFakeTimers()
      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      })

      const eventSpy = vi.fn()
      window.addEventListener('data-changed', eventSpy)

      const validPayload = JSON.stringify({
        version: 2,
        goals: [{ id: 1, goalName: 'Test', targetAmount: 100, currentAmount: 0 }],
      })
      fileReaderRestore = setupMockFileReader(validPayload).restore

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleImport(new File([validPayload], 'test.json'))
      })

      expect(eventSpy).toHaveBeenCalledTimes(1)

      window.removeEventListener('data-changed', eventSpy)
    })

    it('reloads page after restore via setTimeout', () => {
      vi.useFakeTimers()
      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      })

      const validPayload = JSON.stringify({
        version: 2,
        goals: [{ id: 1, goalName: 'Test', targetAmount: 100, currentAmount: 0 }],
      })
      fileReaderRestore = setupMockFileReader(validPayload).restore

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleImport(new File([validPayload], 'test.json'))
      })

      expect(reloadMock).not.toHaveBeenCalled()
      vi.advanceTimersByTime(200)
      expect(reloadMock).toHaveBeenCalledTimes(1)
    })

    it('restores settings from import payload', () => {
      vi.useFakeTimers()
      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      })

      const payload = JSON.stringify({
        version: 2,
        goals: [{ id: 1, goalName: 'G', targetAmount: 1, currentAmount: 0 }],
        settings: {
          accentTheme: 'purple',
          darkMode: true,
          allowCsvImport: true,
          goalViewMode: 'list',
        },
      })
      fileReaderRestore = setupMockFileReader(payload).restore

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleImport(new File([payload], 'test.json'))
      })

      // goalViewMode should be persisted
      expect(localStorage.getItem('goal-view-mode')).toBe('list')
    })

    it('restores budget data from import payload', () => {
      vi.useFakeTimers()
      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      })

      const payload = JSON.stringify({
        version: 2,
        goals: [{ id: 1, goalName: 'G', targetAmount: 1, currentAmount: 0 }],
        budgetCsvs: { '2024': 'csv-data' },
      })
      fileReaderRestore = setupMockFileReader(payload).restore

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleImport(new File([payload], 'test.json'))
      })

      // Budget store should contain the imported csvs
      const storedBudget = localStorage.getItem('budget-store')
      expect(storedBudget).toBeTruthy()
      const parsed = JSON.parse(storedBudget!)
      expect(parsed.csvs['2024']).toBe('csv-data')
    })
  })

  describe('handleFactoryReset', () => {
    it('clears all localStorage keys and reloads', () => {
      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      })

      localStorage.setItem('key1', 'value1')
      localStorage.setItem('key2', 'value2')

      const { result } = renderHook(() => useImportExport(), { wrapper })

      act(() => {
        result.current.handleFactoryReset()
      })

      expect(localStorage.length).toBe(0)
      expect(reloadMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('FileReader error handling', () => {
    it('does not crash when FileReader encounters an error', () => {
      const mockReader = {
        readAsText: vi.fn(function (this: FileReader) {
          if (this.onerror) this.onerror({ target: this } as ProgressEvent<FileReader>)
        }),
        onload: null as ((ev: ProgressEvent<FileReader>) => void) | null,
        onerror: null as ((ev: ProgressEvent<FileReader>) => void) | null,
      }
      const OrigFR = globalThis.FileReader
      globalThis.FileReader = function () {
        return mockReader
      } as unknown as typeof FileReader

      const { result } = renderHook(() => useImportExport(), { wrapper })

      expect(() => {
        act(() => {
          result.current.handleImport(new File(['data'], 'test.json'))
        })
      }).not.toThrow()

      globalThis.FileReader = OrigFR
    })
  })

  describe('export → import round-trip', () => {
    it('data survives a full export then import cycle', async () => {
      vi.useFakeTimers()
      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      })

      // Seed data BEFORE rendering (providers read from appStorage/localStorage at mount)
      // Goals are stored under 'financialGoals' key via appStorage
      localStorage.setItem(
        'financialGoals',
        JSON.stringify([{ id: 1, goalName: 'Retire', targetAmount: 1500000, currentAmount: 750000 }]),
      )
      localStorage.setItem('home-card-order', JSON.stringify([2, 0, 1, 3]))

      let capturedBlob: Blob | null = null
      const createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob
        return 'blob:test'
      })
      const revokeObjectURL = vi.fn()
      Object.defineProperty(window, 'URL', {
        value: { createObjectURL, revokeObjectURL },
        writable: true,
        configurable: true,
      })

      const origCreateElement = document.createElement.bind(document)
      const createElementSpy = vi.spyOn(document, 'createElement')
      createElementSpy.mockImplementation((tag: string) => {
        if (tag === 'a') {
          const anchor = {
            _href: '',
            download: '',
            click: vi.fn(),
            set href(v: string) {
              anchor._href = v
            },
            get href() {
              return anchor._href
            },
          }
          return anchor as unknown as HTMLAnchorElement
        }
        return origCreateElement(tag)
      })

      // Mount AFTER seeding localStorage
      const { result } = renderHook(() => useImportExport(), { wrapper })

      // Export
      act(() => {
        result.current.handleExport()
      })
      expect(capturedBlob).not.toBeNull()
      const exportedJson = await capturedBlob!.text()
      const exported = JSON.parse(exportedJson)
      expect(exported.version).toBe(2)
      expect(exported.goals).toEqual([{ id: 1, goalName: 'Retire', targetAmount: 1500000, currentAmount: 750000 }])

      // Verify data exists BEFORE clear
      expect(localStorage.getItem('financialGoals')).toBeTruthy()

      // Clear and import
      localStorage.clear()
      expect(localStorage.getItem('financialGoals')).toBeNull()

      const { restore } = setupMockFileReader(exportedJson)
      act(() => {
        result.current.handleImport(new File([exportedJson], 'backup.json'))
      })

      // Goals should be restored to financialGoals key (via appStorage)
      const restoredGoals = localStorage.getItem('financialGoals')
      expect(restoredGoals).toBeTruthy()
      expect(JSON.parse(restoredGoals!)).toEqual([
        { id: 1, goalName: 'Retire', targetAmount: 1500000, currentAmount: 750000 },
      ])

      createElementSpy.mockRestore()
      restore()
    })
  })
})
