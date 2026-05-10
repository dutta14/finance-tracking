import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PdfToCsv from './PdfToCsv'

vi.mock('../../../styles/PdfToCsv.css', () => ({}))

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPdfToCsv() {
  return render(<PdfToCsv />)
}

describe('PdfToCsv', () => {
  it('renders the dropzone with upload instruction', () => {
    renderPdfToCsv()
    expect(screen.getByText('Drop a PDF here or click to browse')).toBeInTheDocument()
  })

  it('renders a hidden file input accepting PDFs', () => {
    renderPdfToCsv()
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]')
    expect(fileInput).toBeInTheDocument()
  })

  it('does not render toolbar or canvas before a PDF is loaded', () => {
    renderPdfToCsv()
    expect(screen.queryByText('Change file')).not.toBeInTheDocument()
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument()
  })

  it('shows error when non-PDF file is dropped', () => {
    renderPdfToCsv()
    const dropzone = screen.getByText('Drop a PDF here or click to browse').closest('div')!
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    })
    expect(screen.getByText('Please drop a PDF file')).toBeInTheDocument()
  })

  it('shows loading text when loadPdf is triggered', async () => {
    // Mock pdfjs-dist to delay indefinitely so we can see loading state
    vi.doMock('pdfjs-dist', () => ({
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: () => ({ promise: new Promise(() => {}) }),
    }))

    renderPdfToCsv()
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement

    const pdfFile = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    // The loading state shows 'Loading PDF…' in the dropzone
    await waitFor(() => {
      expect(screen.getByText('Loading PDF…')).toBeInTheDocument()
    })

    vi.doUnmock('pdfjs-dist')
  })
})

// detectColumns, groupIntoRows, escapeCsvField, and rowsToCsv are private functions
// in PdfToCsv.tsx. They should be tested through the component's public interface
// (uploading a PDF and verifying CSV output). The previous tests re-implemented these
// functions locally, which doesn't validate the actual source code. These functions
// are exercised indirectly when the component processes a PDF.
