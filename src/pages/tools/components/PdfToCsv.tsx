import { FC, useState, useCallback, useRef, useEffect } from 'react'
import '../../../styles/PdfToCsv.css'

interface TextItem {
  text: string
  x: number
  y: number
  width: number
  height: number
}

/** Detect column boundaries using centroid-based bucketing scaled to font size */
function detectColumns(items: TextItem[]): number[] {
  if (items.length === 0) return []

  // Use average item height as a proxy for font size
  const avgHeight = items.reduce((s, i) => s + i.height, 0) / items.length
  // Tolerance: ~1.5× font height absorbs within-column drift
  // (alignment differences, slight indentation) without bridging column gaps
  const tolerance = Math.max(avgHeight * 1.5, 12)

  const xPositions = items.map(i => i.x).sort((a, b) => a - b)

  // Centroid-based bucketing: each bucket tracks its mean X and count
  // so gradually drifting positions don't cause false splits
  const buckets: { mean: number; count: number }[] = []
  for (const x of xPositions) {
    const match = buckets.find(b => Math.abs(x - b.mean) <= tolerance)
    if (match) {
      // Update running centroid
      match.mean = (match.mean * match.count + x) / (match.count + 1)
      match.count++
    } else {
      buckets.push({ mean: x, count: 1 })
    }
  }

  return buckets.map(b => b.mean).sort((a, b) => a - b)
}

/** Group items into rows (preserving TextItem refs) by Y proximity */
function groupIntoRows(items: TextItem[], yTolerance = 3): TextItem[][] {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => {
    const dy = a.y - b.y
    if (Math.abs(dy) > yTolerance) return dy
    return a.x - b.x
  })

  const rows: TextItem[][] = []
  let currentRow: TextItem[] = [sorted[0]]
  let currentY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) <= yTolerance) {
      currentRow.push(sorted[i])
    } else {
      rows.push(currentRow)
      currentRow = [sorted[i]]
      currentY = sorted[i].y
    }
  }
  rows.push(currentRow)

  return rows.map(row => row.sort((a, b) => a.x - b.x))
}

/** Merge cell texts into structured columns */
function structureRows(items: TextItem[], yTolerance = 3): string[][] {
  if (items.length === 0) return []
  const columns = detectColumns(items)
  const rows = groupIntoRows(items, yTolerance)

  return rows.map(rowItems => {
    const structured: string[] = new Array(columns.length).fill('')
    for (const item of rowItems) {
      // Assign to column: find the last column start that is <= item.x
      let colIdx = 0
      for (let i = columns.length - 1; i >= 0; i--) {
        if (item.x >= columns[i] - 5) {
          colIdx = i
          break
        }
      }
      const text = item.text.trim()
      if (text) {
        structured[colIdx] = structured[colIdx] ? structured[colIdx] + ' ' + text : text
      }
    }
    return structured
  })
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

function rowsToCsv(rows: string[][]): string {
  return rows.map(row => row.map(escapeCsvField).join(',')).join('\n')
}

const PdfToCsv: FC = () => {
  const [fileName, setFileName] = useState<string | null>(null)
  const [pages, setPages] = useState<{ pageNum: number; items: TextItem[] }[]>([])
  const [selectedPage, setSelectedPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selecting, setSelecting] = useState(false)
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null)
  const [selEnd, setSelEnd] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // Results
  const [previewRows, setPreviewRows] = useState<string[][] | null>(null)
  const [copied, setCopied] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addFileInputRef = useRef<HTMLInputElement>(null)
  const pdfDocRef = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const [zoom, setZoom] = useState(1.0)

  const loadPdf = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    setCopied(false)
    setSelection(null)
    setFileName(file.name)

    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      pdfDocRef.current = pdf

      const allPages: { pageNum: number; items: TextItem[] }[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const viewport = page.getViewport({ scale: 1 })
        const items: TextItem[] = []
        for (const item of textContent.items) {
          if ('str' in item && item.str.trim()) {
            const tx = (item as any).transform
            items.push({
              text: (item as any).str,
              x: tx[4],
              y: viewport.height - tx[5],
              width: (item as any).width,
              height: (item as any).height,
            })
          }
        }
        allPages.push({ pageNum: i, items })
      }

      setPages(allPages)
      setSelectedPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PDF')
    } finally {
      setLoading(false)
    }
  }, [])

  const renderPage = useCallback(async (pdf: any, pageNum: number, z: number) => {
    const page = await pdf.getPage(pageNum)
    const baseVp = page.getViewport({ scale: 1 })
    const wrapWidth = wrapRef.current?.clientWidth ?? 700
    const fitScale = wrapWidth / baseVp.width
    const scale = fitScale * z
    scaleRef.current = scale
    const viewport = page.getViewport({ scale })
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
  }, [])

  useEffect(() => {
    if (pdfDocRef.current && pages.length > 0) {
      renderPage(pdfDocRef.current, selectedPage, zoom)
    }
  }, [pages, selectedPage, zoom, renderPage])

  const handlePageChange = useCallback((pageNum: number) => {
    setSelectedPage(pageNum)
    setSelection(null)
  }, [])

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type === 'application/pdf') loadPdf(file)
      else setError('Please drop a PDF file')
    },
    [loadPdf],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) loadPdf(file)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (addFileInputRef.current) addFileInputRef.current.value = ''
    },
    [loadPdf],
  )

  const handleZoom = (delta: number) => {
    setZoom(z => {
      const next = Math.round((z + delta) * 10) / 10
      return Math.max(0.25, Math.min(1, next))
    })
    setSelection(null)
    setSelStart(null)
    setSelEnd(null)
  }

  // Selection handlers on overlay
  const getRelativePos = (e: React.MouseEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleMouseUpRef = useRef<() => void>(() => {})

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!pages.length) return
    const pos = getRelativePos(e)
    setSelStart(pos)
    setSelEnd(pos)
    setSelecting(true)

    const onMove = (ev: MouseEvent) => {
      const rect = overlayRef.current?.getBoundingClientRect()
      if (!rect) return
      setSelEnd({ x: ev.clientX - rect.left, y: ev.clientY - rect.top })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      handleMouseUpRef.current()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleMouseUp = () => {
    if (!selecting || !selStart || !selEnd) return
    setSelecting(false)

    const scale = scaleRef.current
    const x1 = Math.min(selStart.x, selEnd.x) / scale
    const y1 = Math.min(selStart.y, selEnd.y) / scale
    const x2 = Math.max(selStart.x, selEnd.x) / scale
    const y2 = Math.max(selStart.y, selEnd.y) / scale

    setSelection({ x1, y1, x2, y2 })

    // Extract items within selection
    const pageItems = pages.find(p => p.pageNum === selectedPage)?.items || []
    const selected = pageItems.filter(i => i.x >= x1 && i.x <= x2 && i.y >= y1 && i.y <= y2)

    if (selected.length === 0) {
      setError('No text found in selection. Try selecting a larger area.')
      return
    }

    const rows = structureRows(selected)
    setPreviewRows(prev => (prev ? [...prev, ...rows] : rows))
    setError(null)
  }
  handleMouseUpRef.current = handleMouseUp

  const currentCsv = previewRows ? rowsToCsv(previewRows) : ''

  const handleCopy = () => {
    if (currentCsv) {
      navigator.clipboard.writeText(currentCsv)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (!currentCsv) return
    const blob = new Blob([currentCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (fileName?.replace(/\.pdf$/i, '') || 'extracted') + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const removeRow = (ri: number) => {
    if (!previewRows) return
    setPreviewRows(previewRows.filter((_, i) => i !== ri))
  }

  const mergeRowUp = (ri: number) => {
    if (!previewRows || ri <= 0) return
    const updated = [...previewRows.map(r => [...r])]
    const above = updated[ri - 1]
    const current = updated[ri]
    for (let ci = 0; ci < Math.max(above.length, current.length); ci++) {
      const a = (above[ci] || '').trim()
      const b = (current[ci] || '').trim()
      above[ci] = a && b ? a + ' ' + b : a || b
    }
    updated.splice(ri, 1)
    setPreviewRows(updated)
  }

  const removeCol = (ci: number) => {
    if (!previewRows) return
    setPreviewRows(previewRows.map(row => row.filter((_, i) => i !== ci)))
  }

  const editCell = (ri: number, ci: number, value: string) => {
    if (!previewRows) return
    const updated = previewRows.map(r => [...r])
    updated[ri][ci] = value
    setPreviewRows(updated)
  }

  // Detect Debits/Credits columns for merge option
  const headers = previewRows?.[0] ?? []
  const debitIdx = headers.findIndex(h => /^debits?$/i.test(h.trim()))
  const creditIdx = headers.findIndex(h => /^credits?$/i.test(h.trim()))
  const canMergeDebitCredit = debitIdx >= 0 && creditIdx >= 0 && debitIdx !== creditIdx

  const mergeDebitCredit = () => {
    if (!previewRows || !canMergeDebitCredit) return
    const keepIdx = Math.min(debitIdx, creditIdx)
    const dropIdx = Math.max(debitIdx, creditIdx)

    const merged = previewRows.map((row, ri) => {
      if (ri === 0) {
        // Header row — replace with "Amount", drop the other
        const next = row.map((c, i) => (i === keepIdx ? 'Amount' : c))
        return next.filter((_, i) => i !== dropIdx)
      }
      const debitRaw = row[debitIdx].trim()
      const creditRaw = row[creditIdx].trim()
      // Parse number: strip $, commas, parens
      const parseNum = (s: string) => {
        const cleaned = s.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1')
        return parseFloat(cleaned) || 0
      }
      let amount = ''
      if (debitRaw && parseNum(debitRaw) !== 0) {
        const n = parseNum(debitRaw)
        amount = '-$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      } else if (creditRaw && parseNum(creditRaw) !== 0) {
        const n = parseNum(creditRaw)
        amount = '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
      const next = row.map((c, i) => (i === keepIdx ? amount : c))
      return next.filter((_, i) => i !== dropIdx)
    })
    setPreviewRows(merged)
  }

  // Selection rect for rendering (in canvas coords)
  const selRect =
    selStart && selEnd
      ? {
          left: Math.min(selStart.x, selEnd.x),
          top: Math.min(selStart.y, selEnd.y),
          width: Math.abs(selEnd.x - selStart.x),
          height: Math.abs(selEnd.y - selStart.y),
        }
      : null

  return (
    <div className="pdf2csv">
      {/* Upload area */}
      {!pages.length && (
        <div
          className="pdf2csv-dropzone"
          onDragOver={e => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileInput} />
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <polyline points="9 15 12 12 15 15" />
          </svg>
          <p className="pdf2csv-dropzone-text">{loading ? 'Loading PDF…' : 'Drop a PDF here or click to browse'}</p>
        </div>
      )}

      {error && <div className="pdf2csv-error">{error}</div>}

      {/* PDF viewer with selection */}
      {pages.length > 0 && (
        <>
          <div className="pdf2csv-toolbar">
            <span className="pdf2csv-filename">{fileName}</span>
            {pages.length > 1 && (
              <div className="pdf2csv-pages">
                <button disabled={selectedPage <= 1} onClick={() => handlePageChange(selectedPage - 1)}>
                  ←
                </button>
                <span>
                  Page {selectedPage} / {pages.length}
                </span>
                <button disabled={selectedPage >= pages.length} onClick={() => handlePageChange(selectedPage + 1)}>
                  →
                </button>
              </div>
            )}
            <div className="pdf2csv-zoom">
              <button onClick={() => handleZoom(-0.1)} disabled={zoom <= 0.25}>
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => handleZoom(0.1)} disabled={zoom >= 1}>
                +
              </button>
            </div>
            <button
              className="pdf2csv-change-btn"
              onClick={() => {
                setPages([])
                setFileName(null)
                setSelection(null)
                setZoom(1)
              }}
            >
              Change file
            </button>
            <input
              ref={addFileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
          </div>

          <p className="pdf2csv-hint">
            Click and drag to select a table region. Each selection appends to the CSV below.
          </p>

          <div ref={wrapRef} className="pdf2csv-canvas-wrap">
            <canvas ref={canvasRef} className="pdf2csv-canvas" />
            <div ref={overlayRef} className="pdf2csv-overlay" onMouseDown={handleMouseDown}>
              {selecting && selRect && (
                <div
                  className="pdf2csv-sel"
                  style={{ left: selRect.left, top: selRect.top, width: selRect.width, height: selRect.height }}
                />
              )}
              {!selecting && selection && (
                <div
                  className="pdf2csv-sel pdf2csv-sel--final"
                  style={{
                    left: selection.x1 * scaleRef.current,
                    top: selection.y1 * scaleRef.current,
                    width: (selection.x2 - selection.x1) * scaleRef.current,
                    height: (selection.y2 - selection.y1) * scaleRef.current,
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Preview + output */}
      {previewRows && previewRows.length > 0 && (
        <div className="pdf2csv-results">
          <div className="pdf2csv-results-header">
            <h3>Extracted Table ({previewRows.length} rows)</h3>
            <div className="pdf2csv-results-actions">
              <button className="pdf2csv-btn pdf2csv-btn--muted" onClick={() => setPreviewRows(null)}>
                Clear
              </button>
              {canMergeDebitCredit && (
                <button className="pdf2csv-btn" onClick={mergeDebitCredit}>
                  Merge Debits / Credits
                </button>
              )}
              <button className="pdf2csv-btn" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy CSV'}
              </button>
              <button className="pdf2csv-btn pdf2csv-btn--primary" onClick={handleDownload}>
                Download .csv
              </button>
            </div>
          </div>
          <div className="pdf2csv-table-wrap">
            <table className="pdf2csv-table">
              <colgroup>
                <col style={{ width: '1.2rem' }} />
                <col style={{ width: '1%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="pdf2csv-row-action" />
                  {previewRows[0].map((_, ci) => (
                    <th key={ci} className="pdf2csv-col-action">
                      <button className="pdf2csv-del-col" title="Remove column" onClick={() => removeCol(ci)}>
                        ×
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr key={ri} className={ri === 0 ? 'pdf2csv-table-header' : ''}>
                    <td className="pdf2csv-row-action">
                      <button className="pdf2csv-del-row" title="Remove row" onClick={() => removeRow(ri)}>
                        ×
                      </button>
                      {ri > 0 && (
                        <button
                          className="pdf2csv-merge-row"
                          title="Merge into row above"
                          onClick={() => mergeRowUp(ri)}
                        >
                          ↑
                        </button>
                      )}
                    </td>
                    {row.map((cell, ci) => {
                      const Tag = ri === 0 ? 'th' : 'td'
                      return (
                        <Tag
                          key={ci}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={e => editCell(ri, ci, e.currentTarget.textContent || '')}
                        >
                          {cell}
                        </Tag>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default PdfToCsv
