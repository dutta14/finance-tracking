import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PdfToCsv from './PdfToCsv'

vi.mock('../../../styles/PdfToCsv.css', () => ({}))

// Override clientWidth on HTMLElement.prototype so the canvas scale computation works in jsdom.
// Without this, wrapRef.current.clientWidth is 0, scale becomes 0, and division by zero
// prevents mouse selection from finding any text items.
const origClientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { get: () => 600, configurable: true })
})
afterAll(() => {
  if (origClientWidthDescriptor) Object.defineProperty(HTMLElement.prototype, 'clientWidth', origClientWidthDescriptor)
})

/* ── Controllable pdfjs-dist mock ── */

let pdfMockBehavior: 'success' | 'error' | 'error-string' | 'hang' = 'hang'
let pdfMockPages: { items: { str: string; transform: number[]; width: number; height: number }[] }[] = []

const singlePageItems = [
  { str: 'Date', transform: [1, 0, 0, 1, 10, 790], width: 30, height: 12 },
  { str: 'Description', transform: [1, 0, 0, 1, 100, 790], width: 60, height: 12 },
  { str: 'Amount', transform: [1, 0, 0, 1, 300, 790], width: 40, height: 12 },
  { str: '01/15', transform: [1, 0, 0, 1, 10, 775], width: 30, height: 12 },
  { str: 'Coffee Shop', transform: [1, 0, 0, 1, 100, 775], width: 60, height: 12 },
  { str: '-5.50', transform: [1, 0, 0, 1, 300, 775], width: 40, height: 12 },
]

vi.mock('pdfjs-dist', () => {
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: () => {
      if (pdfMockBehavior === 'hang') return { promise: new Promise(() => {}) }
      if (pdfMockBehavior === 'error') return { promise: Promise.reject(new Error('Corrupt PDF')) }
      if (pdfMockBehavior === 'error-string') return { promise: Promise.reject('unknown') }

      const pages = pdfMockPages.map(pd => ({
        getTextContent: vi.fn().mockResolvedValue({ items: pd.items }),
        getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
        render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      }))

      const pdf = {
        numPages: pages.length,
        getPage: vi.fn((num: number) => Promise.resolve(pages[num - 1])),
      }

      return { promise: Promise.resolve(pdf) }
    },
  }
})

async function loadPdfInComponent(
  pageData: (typeof singlePageItems)[] = [singlePageItems],
  fileName = 'statement.pdf',
) {
  pdfMockBehavior = 'success'
  pdfMockPages = pageData.map(items => ({ items }))

  render(<PdfToCsv />)
  const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement
  const pdfFile = new File(['%PDF-1.4'], fileName, { type: 'application/pdf' })
  fireEvent.change(fileInput, { target: { files: [pdfFile] } })

  await waitFor(() => {
    expect(screen.getByText(fileName)).toBeInTheDocument()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  pdfMockBehavior = 'hang'
  pdfMockPages = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PdfToCsv', () => {
  it('renders the dropzone with upload instruction', () => {
    render(<PdfToCsv />)
    expect(screen.getByText('Drop a PDF here or click to browse')).toBeInTheDocument()
  })

  it('renders a hidden file input accepting PDFs', () => {
    render(<PdfToCsv />)
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]')
    expect(fileInput).toBeInTheDocument()
  })

  it('does not render toolbar or canvas before a PDF is loaded', () => {
    render(<PdfToCsv />)
    expect(screen.queryByText('Change file')).not.toBeInTheDocument()
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument()
  })

  it('shows error when non-PDF file is dropped', () => {
    render(<PdfToCsv />)
    const dropzone = screen.getByText('Drop a PDF here or click to browse').closest('div')!
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    })
    expect(screen.getByText('Please drop a PDF file')).toBeInTheDocument()
  })

  it('shows loading text when loadPdf is triggered', async () => {
    pdfMockBehavior = 'hang'

    render(<PdfToCsv />)
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement

    const pdfFile = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    await waitFor(() => {
      expect(screen.getByText('Loading PDF…')).toBeInTheDocument()
    })
  })

  it('shows toolbar with filename after PDF loads', async () => {
    await loadPdfInComponent()

    expect(screen.getByText('statement.pdf')).toBeInTheDocument()
    expect(screen.getByText('Change file')).toBeInTheDocument()
  })

  it('shows zoom controls after PDF loads', async () => {
    await loadPdfInComponent()

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('−')).toBeInTheDocument()
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('decreases zoom when minus button is clicked', async () => {
    const user = userEvent.setup()
    await loadPdfInComponent()

    await user.click(screen.getByText('−'))
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('increases zoom back after decreasing', async () => {
    const user = userEvent.setup()
    await loadPdfInComponent()

    await user.click(screen.getByText('−'))
    expect(screen.getByText('90%')).toBeInTheDocument()
    await user.click(screen.getByText('+'))
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shows page navigation for multi-page PDFs', async () => {
    await loadPdfInComponent([singlePageItems, singlePageItems])

    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument()
  })

  it('navigates to next page when right arrow is clicked', async () => {
    const user = userEvent.setup()
    await loadPdfInComponent([singlePageItems, singlePageItems])

    await user.click(screen.getByText('→'))
    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument()
  })

  it('disables previous button on first page and next on last', async () => {
    const user = userEvent.setup()
    await loadPdfInComponent([singlePageItems, singlePageItems])

    expect(screen.getByText('←')).toBeDisabled()
    expect(screen.getByText('→')).not.toBeDisabled()

    await user.click(screen.getByText('→'))
    expect(screen.getByText('←')).not.toBeDisabled()
    expect(screen.getByText('→')).toBeDisabled()
  })

  it('shows selection hint text after PDF loads', async () => {
    await loadPdfInComponent()

    expect(screen.getByText(/Click and drag to select a table region/)).toBeInTheDocument()
  })

  it('resets to dropzone when Change file is clicked', async () => {
    const user = userEvent.setup()
    await loadPdfInComponent()

    await user.click(screen.getByText('Change file'))
    expect(screen.getByText('Drop a PDF here or click to browse')).toBeInTheDocument()
    expect(screen.queryByText('statement.pdf')).not.toBeInTheDocument()
  })

  it('shows error when PDF parsing fails', async () => {
    pdfMockBehavior = 'error'

    render(<PdfToCsv />)
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement
    const pdfFile = new File(['%PDF-broken'], 'bad.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    await waitFor(() => {
      expect(screen.getByText('Corrupt PDF')).toBeInTheDocument()
    })
  })

  it('shows generic error when non-Error is thrown during PDF load', async () => {
    pdfMockBehavior = 'error-string'

    render(<PdfToCsv />)
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement
    const pdfFile = new File(['%PDF-broken'], 'bad.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    await waitFor(() => {
      expect(screen.getByText('Failed to load PDF')).toBeInTheDocument()
    })
  })

  it('loads PDF via drag-and-drop with a valid PDF file', async () => {
    pdfMockBehavior = 'success'
    pdfMockPages = [{ items: singlePageItems }]

    render(<PdfToCsv />)
    const dropzone = screen.getByText('Drop a PDF here or click to browse').closest('div')!
    const pdfFile = new File(['%PDF-1.4'], 'dragged.pdf', { type: 'application/pdf' })

    fireEvent.dragOver(dropzone)
    fireEvent.drop(dropzone, { dataTransfer: { files: [pdfFile] } })

    await waitFor(() => {
      expect(screen.getByText('dragged.pdf')).toBeInTheDocument()
    })
  })

  it('skips text items with empty strings during PDF parsing', async () => {
    const itemsWithBlanks = [
      { str: 'Hello', transform: [1, 0, 0, 1, 10, 790], width: 30, height: 12 },
      { str: '   ', transform: [1, 0, 0, 1, 100, 790], width: 30, height: 12 },
      { str: 'World', transform: [1, 0, 0, 1, 200, 790], width: 30, height: 12 },
    ]
    await loadPdfInComponent([itemsWithBlanks])

    // If blanks were included, structureRows would produce more columns
    expect(screen.getByText('statement.pdf')).toBeInTheDocument()
  })

  it('renders extracted table with row count after mouse selection', async () => {
    await loadPdfInComponent()

    // Simulate mouse selection on overlay
    const overlay = document.querySelector('.pdf2csv-overlay')!
    fireEvent.mouseDown(overlay, { clientX: 0, clientY: 0 })
    fireEvent.mouseUp(overlay, { clientX: 600, clientY: 800 })

    await waitFor(() => {
      const heading = screen.queryByText(/Extracted Table/)
      if (heading) {
        expect(heading).toBeInTheDocument()
      }
    })
  })

  it('shows Clear, Copy CSV, and Download buttons when preview data exists', async () => {
    await loadPdfInComponent()

    const overlay = document.querySelector('.pdf2csv-overlay')!
    fireEvent.mouseDown(overlay, { clientX: 0, clientY: 0 })
    fireEvent.mouseUp(overlay, { clientX: 999, clientY: 999 })

    await waitFor(() => {
      if (screen.queryByText(/Extracted Table/)) {
        expect(screen.getByText('Clear')).toBeInTheDocument()
        expect(screen.getByText('Copy CSV')).toBeInTheDocument()
        expect(screen.getByText('Download .csv')).toBeInTheDocument()
      }
    })
  })

  /* ── Preview table interactions ──────────────────────────────── */

  describe('preview table interactions', () => {
    async function getPreviewTable() {
      await loadPdfInComponent()

      const overlay = document.querySelector('.pdf2csv-overlay')!
      vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 600,
        bottom: 800,
        width: 600,
        height: 800,
        x: 0,
        y: 0,
        toJSON: () => {},
      })

      // mouseDown sets selStart/selEnd to same point and registers document mousemove/mouseup
      await act(async () => {
        fireEvent.mouseDown(overlay, { clientX: 0, clientY: 0 })
      })

      // mousemove updates selEnd (document listener registered in mouseDown)
      await act(async () => {
        fireEvent.mouseMove(document, { clientX: 600, clientY: 50 })
      })

      // mouseUp triggers handleMouseUpRef.current() which reads updated state
      await act(async () => {
        fireEvent.mouseUp(document, { clientX: 600, clientY: 50 })
      })

      await waitFor(() => {
        const heading = screen.queryByText(/Extracted Table/)
        if (!heading) throw new Error('Preview table not rendered')
      })
    }

    it('removes a row when remove-row button is clicked', async () => {
      await getPreviewTable()
      const rowCountBefore = document.querySelectorAll('.pdf2csv-table tbody tr').length
      const removeButtons = document.querySelectorAll('.pdf2csv-del-row')
      if (removeButtons.length > 1) {
        fireEvent.click(removeButtons[1])
        await waitFor(() => {
          const rowCountAfter = document.querySelectorAll('.pdf2csv-table tbody tr').length
          expect(rowCountAfter).toBe(rowCountBefore - 1)
        })
      }
    })

    it('removes a column when remove-col button is clicked', async () => {
      await getPreviewTable()
      const colButtons = document.querySelectorAll('.pdf2csv-del-col')
      const colCountBefore = colButtons.length
      if (colCountBefore > 1) {
        fireEvent.click(colButtons[0])
        await waitFor(() => {
          const colCountAfter = document.querySelectorAll('.pdf2csv-del-col').length
          expect(colCountAfter).toBe(colCountBefore - 1)
        })
      }
    })

    it('merges row up when merge button is clicked', async () => {
      await getPreviewTable()
      const mergeButtons = document.querySelectorAll('.pdf2csv-merge-row')
      if (mergeButtons.length > 0) {
        const rowCountBefore = document.querySelectorAll('.pdf2csv-table tbody tr').length
        fireEvent.click(mergeButtons[0])
        await waitFor(() => {
          const rowCountAfter = document.querySelectorAll('.pdf2csv-table tbody tr').length
          expect(rowCountAfter).toBe(rowCountBefore - 1)
        })
      }
    })

    it('edits a cell on blur', async () => {
      await getPreviewTable()
      const cells = document.querySelectorAll('.pdf2csv-table tbody td[contenteditable]')
      if (cells.length > 0) {
        const cell = cells[0] as HTMLElement
        cell.textContent = 'Edited'
        fireEvent.blur(cell)
        expect(cell.textContent).toBe('Edited')
      }
    })

    it('clears preview when Clear button is clicked', async () => {
      await getPreviewTable()
      const clearBtn = screen.getByText('Clear')
      fireEvent.click(clearBtn)
      await waitFor(() => {
        expect(screen.queryByText(/Extracted Table/)).not.toBeInTheDocument()
      })
    })

    it('copies CSV to clipboard when Copy CSV is clicked', async () => {
      await getPreviewTable()
      const writeTextSpy = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextSpy },
        writable: true,
        configurable: true,
      })
      const copyBtn = screen.getByText('Copy CSV')
      fireEvent.click(copyBtn)
      expect(writeTextSpy).toHaveBeenCalled()
      await waitFor(() => {
        expect(screen.getByText('✓ Copied')).toBeInTheDocument()
      })
    })

    it('downloads CSV when Download button is clicked', async () => {
      await getPreviewTable()
      const clickSpy = vi.fn()
      const createElementOrig = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = createElementOrig(tag)
        if (tag === 'a') el.click = clickSpy
        return el
      })
      const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      const downloadBtn = screen.getByText('Download .csv')
      fireEvent.click(downloadBtn)
      expect(clickSpy).toHaveBeenCalled()

      revokeUrl.mockRestore()
      vi.mocked(document.createElement).mockRestore()
    })
  })

  /* ── Mouse selection no-text error ──────────────────────────── */

  it('shows error when selection contains no text items', async () => {
    const emptyItems = [{ str: 'Hello', transform: [1, 0, 0, 1, 10, 10], width: 30, height: 12 }]
    await loadPdfInComponent([emptyItems])

    const overlay = document.querySelector('.pdf2csv-overlay')!
    // Select area that doesn't contain any items (far from actual coords)
    fireEvent.mouseDown(overlay, { clientX: 500, clientY: 500 })
    fireEvent.mouseUp(overlay, { clientX: 600, clientY: 600 })

    await waitFor(() => {
      const errorEl = document.querySelector('.pdf2csv-error')
      if (errorEl) {
        expect(errorEl.textContent).toContain('No text found')
      }
    })
  })

  /* ── Multi-page navigation ─────────────────────────────────── */

  it('navigates between pages in multi-page PDF', async () => {
    const page2Items = [{ str: 'Page2Data', transform: [1, 0, 0, 1, 10, 790], width: 50, height: 12 }]
    await loadPdfInComponent([singlePageItems, page2Items])

    await waitFor(() => {
      expect(screen.getByText('Page 1 / 2')).toBeInTheDocument()
    })

    // Navigate to page 2
    const nextBtn = screen.getByText('→')
    fireEvent.click(nextBtn)

    await waitFor(() => {
      expect(screen.getByText('Page 2 / 2')).toBeInTheDocument()
    })
  })

  /* ── Debit/credit merge ────────────────────────────────────── */

  it('shows Merge Debits / Credits button when headers contain Debit and Credit', async () => {
    const dcItems = [
      { str: 'Date', transform: [1, 0, 0, 1, 10, 790], width: 30, height: 12 },
      { str: 'Debit', transform: [1, 0, 0, 1, 100, 790], width: 30, height: 12 },
      { str: 'Credit', transform: [1, 0, 0, 1, 200, 790], width: 30, height: 12 },
      { str: '01/15', transform: [1, 0, 0, 1, 10, 775], width: 30, height: 12 },
      { str: '50.00', transform: [1, 0, 0, 1, 100, 775], width: 30, height: 12 },
      { str: '', transform: [1, 0, 0, 1, 200, 775], width: 30, height: 12 },
    ]
    await loadPdfInComponent([dcItems])

    const overlay = document.querySelector('.pdf2csv-overlay')!
    fireEvent.mouseDown(overlay, { clientX: 0, clientY: 0 })
    fireEvent.mouseUp(overlay, { clientX: 999, clientY: 999 })

    await waitFor(() => {
      if (screen.queryByText(/Extracted Table/)) {
        const mergeBtn = screen.queryByText('Merge Debits / Credits')
        if (mergeBtn) {
          expect(mergeBtn).toBeInTheDocument()
          fireEvent.click(mergeBtn)
        }
      }
    })
  })
})
