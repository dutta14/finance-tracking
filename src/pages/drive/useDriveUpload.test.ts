import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDriveUpload } from './useDriveUpload'

/* ─── Mock dependencies ─── */

const mockUploadCSV = vi.fn(() => ({ ok: true, newCategories: [] }))

vi.mock('../budget/hooks/useBudget', () => ({
  useBudget: () => ({ uploadCSV: mockUploadCSV }),
}))

vi.mock('../budget/hooks/useCSVUpload', () => ({
  monthKeyFromFilename: vi.fn((name: string) => {
    const match = name.match(/(\d{4})-(\d{2})/)
    return match ? `${match[1]}-${match[2]}` : null
  }),
}))

const refreshTree = vi.fn()

let readerContent = 'csv-content'

function setupFileReader(content: string) {
  readerContent = content
}

beforeEach(() => {
  vi.clearAllMocks()
  readerContent = 'csv-content'

  vi.stubGlobal(
    'FileReader',
    // JSDOM does not implement FileReader, so we provide a synchronous stub.
    // In real browsers, readAsText is async and fires onload via the event loop.
    // Tests using this mock validate handler logic, not async timing behavior.
    class {
      result: string | null = null
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null
      readAsText() {
        this.result = readerContent
        if (this.onload) this.onload({ target: this } as unknown as ProgressEvent<FileReader>)
      }
    },
  )
})

afterEach(() => {
  try {
    vi.runOnlyPendingTimers()
  } catch {
    /* timers not mocked */
  }
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function renderUploadHook() {
  return renderHook(() => useDriveUpload(refreshTree))
}

/* ═══════════════════════════════════════════════════════════════
   processFiles
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — processFiles', () => {
  it('processes a valid CSV file and sets csvPreview', async () => {
    const csvContent = 'Date,Amount\n2025-01-15,-100'
    setupFileReader(csvContent)

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([new File([csvContent], '2025-01.csv', { type: 'text/csv' })])
    })

    expect(result.current.csvPreview).toEqual({
      monthKey: '2025-01',
      csv: csvContent,
    })
  })

  it('shows toast when file has unrecognized filename (no month key)', async () => {
    vi.useFakeTimers()
    setupFileReader('data')

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([new File(['data'], 'random.csv', { type: 'text/csv' })])
    })

    expect(result.current.toastMsg).toMatch(/Skipped 1 file/)
    expect(result.current.csvPreview).toBeNull()
  })

  it('queues multiple valid files and previews the first', async () => {
    setupFileReader('csv-content')

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([
        new File(['a'], '2025-01.csv', { type: 'text/csv' }),
        new File(['b'], '2025-02.csv', { type: 'text/csv' }),
      ])
    })

    expect(result.current.csvPreview?.monthKey).toBe('2025-01')
  })
})

/* ═══════════════════════════════════════════════════════════════
   handlePreviewConfirm
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — handlePreviewConfirm', () => {
  it('uploads the CSV and shows success toast', async () => {
    vi.useFakeTimers()
    setupFileReader('csv-data')

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([new File(['csv-data'], '2025-03.csv', { type: 'text/csv' })])
    })

    await act(async () => {
      result.current.handlePreviewConfirm('filtered-csv')
    })

    expect(mockUploadCSV).toHaveBeenCalledWith('2025-03', 'filtered-csv')
    expect(result.current.csvPreview).toBeNull()
    expect(result.current.toastMsg).toBe('Uploaded successfully')
    expect(refreshTree).toHaveBeenCalled()
  })

  it('shows error toast when upload fails', async () => {
    vi.useFakeTimers()
    mockUploadCSV.mockReturnValueOnce({ ok: false, error: 'Invalid format' })
    setupFileReader('bad-data')

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([new File(['bad-data'], '2025-04.csv', { type: 'text/csv' })])
    })

    await act(async () => {
      result.current.handlePreviewConfirm('bad-csv')
    })

    expect(result.current.toastMsg).toMatch(/Upload failed/)
  })

  it('advances to the next queued file after confirming', async () => {
    setupFileReader('csv')

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([
        new File(['a'], '2025-05.csv', { type: 'text/csv' }),
        new File(['b'], '2025-06.csv', { type: 'text/csv' }),
      ])
    })

    expect(result.current.csvPreview?.monthKey).toBe('2025-05')

    await act(async () => {
      result.current.handlePreviewConfirm('filtered-a')
    })

    expect(result.current.csvPreview?.monthKey).toBe('2025-06')
  })
})

/* ═══════════════════════════════════════════════════════════════
   handlePreviewCancel
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — handlePreviewCancel', () => {
  it('clears preview and refreshes tree when no queue remains', async () => {
    setupFileReader('csv')

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([new File(['csv'], '2025-07.csv', { type: 'text/csv' })])
    })

    await act(async () => {
      result.current.handlePreviewCancel()
    })

    expect(result.current.csvPreview).toBeNull()
    expect(refreshTree).toHaveBeenCalled()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Drag and drop handlers
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — drag and drop', () => {
  it('sets dragOver to true on dragEnter and false on drop', async () => {
    const { result } = renderUploadHook()

    act(() => {
      result.current.handleDragEnter({ preventDefault: vi.fn() } as unknown as React.DragEvent)
    })
    expect(result.current.dragOver).toBe(true)

    await act(async () => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { files: [] },
      } as unknown as React.DragEvent)
    })
    expect(result.current.dragOver).toBe(false)
  })
})

/* ═══════════════════════════════════════════════════════════════
   dismissToast
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — dismissToast', () => {
  it('clears the toast message', async () => {
    vi.useFakeTimers()
    setupFileReader('data')

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([new File(['data'], 'unknown.csv', { type: 'text/csv' })])
    })

    expect(result.current.toastMsg).toBeTruthy()

    act(() => {
      result.current.dismissToast()
    })

    expect(result.current.toastMsg).toBeNull()
  })
})
