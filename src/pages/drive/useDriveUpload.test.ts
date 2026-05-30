import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDriveUpload } from './useDriveUpload'

/* ─── Mock dependencies ─── */

const mockUploadCSV = vi.fn((): { ok: boolean; newCategories: string[]; error?: string } => ({ ok: true, newCategories: [] }))

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
    mockUploadCSV.mockReturnValueOnce({ ok: false, newCategories: [], error: 'Invalid format' })
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

/* ═══════════════════════════════════════════════════════════════
   handlePreviewConfirm — early return when no preview
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — handlePreviewConfirm edge cases', () => {
  it('does nothing when csvPreview is null', () => {
    const { result } = renderUploadHook()

    act(() => {
      result.current.handlePreviewConfirm('any-csv')
    })

    expect(mockUploadCSV).not.toHaveBeenCalled()
    expect(refreshTree).not.toHaveBeenCalled()
  })

  it('shows new categories toast when last file in bulk queue is confirmed', async () => {
    vi.useFakeTimers()
    mockUploadCSV
      .mockReturnValueOnce({ ok: true, newCategories: ['Food'] })
      .mockReturnValueOnce({ ok: true, newCategories: ['Travel'] })
    setupFileReader('csv')

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([
        new File(['a'], '2025-01.csv', { type: 'text/csv' }),
        new File(['b'], '2025-02.csv', { type: 'text/csv' }),
      ])
    })

    // Confirm first — should not show toast yet (queue remains)
    await act(async () => {
      result.current.handlePreviewConfirm('csv-a')
    })
    expect(result.current.toastMsg).toBeNull()

    // Confirm second — should show combined new categories
    await act(async () => {
      result.current.handlePreviewConfirm('csv-b')
    })
    expect(result.current.toastMsg).toContain('Food')
    expect(result.current.toastMsg).toContain('Travel')
  })
})

/* ═══════════════════════════════════════════════════════════════
   handlePreviewCancel — advances queue and shows pending cats
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — handlePreviewCancel with queue', () => {
  it('advances to the next queued file on cancel', async () => {
    setupFileReader('csv')

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([
        new File(['a'], '2025-01.csv', { type: 'text/csv' }),
        new File(['b'], '2025-02.csv', { type: 'text/csv' }),
      ])
    })

    expect(result.current.csvPreview?.monthKey).toBe('2025-01')

    await act(async () => {
      result.current.handlePreviewCancel()
    })

    expect(result.current.csvPreview?.monthKey).toBe('2025-02')
  })

  it('shows pending new categories toast when cancelling the last file after confirms', async () => {
    vi.useFakeTimers()
    mockUploadCSV.mockReturnValueOnce({ ok: true, newCategories: ['Groceries'] })
    setupFileReader('csv')

    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.processFiles([
        new File(['a'], '2025-01.csv', { type: 'text/csv' }),
        new File(['b'], '2025-02.csv', { type: 'text/csv' }),
      ])
    })

    // Confirm first file — adds new categories to pending
    await act(async () => {
      result.current.handlePreviewConfirm('csv-a')
    })

    // Cancel second file — should show pending categories toast
    await act(async () => {
      result.current.handlePreviewCancel()
    })

    expect(result.current.csvPreview).toBeNull()
    expect(result.current.toastMsg).toContain('Groceries')
  })
})

/* ═══════════════════════════════════════════════════════════════
   handleDragLeave
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — handleDragLeave', () => {
  it('decrements drag counter and clears dragOver when counter reaches 0', () => {
    const { result } = renderUploadHook()

    // Enter twice
    act(() => {
      result.current.handleDragEnter({ preventDefault: vi.fn() } as unknown as React.DragEvent)
    })
    act(() => {
      result.current.handleDragEnter({ preventDefault: vi.fn() } as unknown as React.DragEvent)
    })
    expect(result.current.dragOver).toBe(true)

    // Leave once — counter is 1, still dragging
    act(() => {
      result.current.handleDragLeave({ preventDefault: vi.fn() } as unknown as React.DragEvent)
    })
    expect(result.current.dragOver).toBe(true)

    // Leave again — counter is 0, no longer dragging
    act(() => {
      result.current.handleDragLeave({ preventDefault: vi.fn() } as unknown as React.DragEvent)
    })
    expect(result.current.dragOver).toBe(false)
  })
})

/* ═══════════════════════════════════════════════════════════════
   handleDrop — no CSV files
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — handleDrop no CSVs', () => {
  it('shows toast when dropped files contain no CSVs', async () => {
    vi.useFakeTimers()
    const { result } = renderUploadHook()

    await act(async () => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
      } as unknown as React.DragEvent)
    })

    expect(result.current.toastMsg).toContain('No CSV files found')
    expect(result.current.dragOver).toBe(false)
  })

  it('processes only CSV files from dropped mixed files', async () => {
    setupFileReader('csv')

    const { result } = renderUploadHook()

    await act(async () => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: {
          files: [
            new File(['img'], 'photo.png', { type: 'image/png' }),
            new File(['csv'], '2025-01.csv', { type: 'text/csv' }),
          ],
        },
      } as unknown as React.DragEvent)
    })

    expect(result.current.csvPreview?.monthKey).toBe('2025-01')
  })
})

/* ═══════════════════════════════════════════════════════════════
   handleFileInputChange
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — handleFileInputChange', () => {
  it('processes files from file input and resets input value', async () => {
    setupFileReader('csv')

    const { result } = renderUploadHook()

    const inputEl = { value: '2025-01.csv' } as HTMLInputElement
    ;(result.current.fileInputRef as { current: HTMLInputElement }).current = inputEl

    await act(async () => {
      const fakeFiles = [new File(['csv'], '2025-01.csv', { type: 'text/csv' })]
      const fileList = {
        ...fakeFiles,
        length: fakeFiles.length,
        item: (i: number) => fakeFiles[i],
        [Symbol.iterator]: function* () {
          for (const f of fakeFiles) yield f
        },
      } as unknown as FileList

      await result.current.handleFileInputChange({
        target: { files: fileList },
      } as unknown as React.ChangeEvent<HTMLInputElement>)
    })

    expect(result.current.csvPreview?.monthKey).toBe('2025-01')
    expect(inputEl.value).toBe('')
  })

  it('does nothing when file input has no files', async () => {
    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.handleFileInputChange({
        target: { files: null },
      } as unknown as React.ChangeEvent<HTMLInputElement>)
    })

    expect(result.current.csvPreview).toBeNull()
  })
})

/* ═══════════════════════════════════════════════════════════════
   handleDragOver
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — handleDragOver', () => {
  it('prevents default on dragOver event', () => {
    const { result } = renderUploadHook()
    const preventDefault = vi.fn()

    act(() => {
      result.current.handleDragOver({ preventDefault } as unknown as React.DragEvent)
    })

    expect(preventDefault).toHaveBeenCalled()
  })
})

/* ═══════════════════════════════════════════════════════════════
   openFilePicker
   ═══════════════════════════════════════════════════════════════ */

describe('useDriveUpload — openFilePicker', () => {
  it('calls click on fileInputRef', () => {
    const { result } = renderUploadHook()
    const mockClick = vi.fn()
    ;(result.current.fileInputRef as { current: HTMLInputElement }).current = {
      click: mockClick,
    } as unknown as HTMLInputElement

    act(() => {
      result.current.openFilePicker()
    })

    expect(mockClick).toHaveBeenCalled()
  })
})
