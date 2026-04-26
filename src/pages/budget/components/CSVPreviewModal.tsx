import { FC, useState, useMemo } from 'react'
import { parseCSVLine, splitCSVRows } from '../utils/csvParser'

interface CSVPreviewModalProps {
  csv: string
  monthKey: string
  onConfirm: (filteredCsv: string) => void
  onCancel: () => void
}

const MAX_PREVIEW_ROWS = 8

const CSVPreviewModal: FC<CSVPreviewModalProps> = ({ csv, monthKey, onConfirm, onCancel }) => {
  const lines = useMemo(() => splitCSVRows(csv.trim()), [csv])
  const headers = useMemo(() => parseCSVLine(lines[0]).map(h => h.trim()), [lines])
  const rows = useMemo(() => {
    const dataLines = lines.slice(1).filter(l => l.trim())
    return dataLines.slice(0, MAX_PREVIEW_ROWS).map(l => parseCSVLine(l))
  }, [lines])
  const totalRows = lines.slice(1).filter(l => l.trim()).length

  const [excludedCols, setExcludedCols] = useState<Set<number>>(new Set())

  const toggleCol = (idx: number) => {
    setExcludedCols(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleConfirm = () => {
    if (excludedCols.size === 0) {
      onConfirm(csv)
      return
    }
    // Rebuild CSV with only included columns
    const kept = headers.map((_, i) => i).filter(i => !excludedCols.has(i))
    const newLines = lines.map(line => {
      const cols = parseCSVLine(line)
      return kept
        .map(i => {
          const val = cols[i] ?? ''
          // Re-quote if the value contains comma, quote, or newline
          if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
            return `"${val.replace(/"/g, '""')}"`
          }
          return val
        })
        .join(',')
    })
    onConfirm(newLines.join('\n'))
  }

  const label = monthKey.replace(/^(\d{4})-(\d{2})$/, (_, y, m) => {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${names[+m - 1]} ${y}`
  })

  return (
    <div className="csv-preview-overlay" onClick={onCancel}>
      <div className="csv-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="csv-preview-header">
          <h3>Preview — {label}</h3>
          <span className="csv-preview-meta">
            {totalRows} rows · {headers.length} columns
          </span>
        </div>

        <p className="csv-preview-hint">Click column headers to exclude them.</p>

        <div className="csv-preview-table-wrap">
          <table className="csv-preview-table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className={excludedCols.has(i) ? 'csv-col-excluded' : ''}
                    onClick={() => toggleCol(i)}
                    title={excludedCols.has(i) ? 'Click to include' : 'Click to exclude'}
                  >
                    <span className="csv-col-name">{h}</span>
                    {excludedCols.has(i) && <span className="csv-col-x">✕</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci} className={excludedCols.has(ci) ? 'csv-col-excluded' : ''}>
                      {row[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalRows > MAX_PREVIEW_ROWS && (
          <p className="csv-preview-more">… and {totalRows - MAX_PREVIEW_ROWS} more rows</p>
        )}

        <div className="csv-preview-actions">
          <button className="csv-preview-btn csv-preview-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="csv-preview-btn csv-preview-btn--confirm" onClick={handleConfirm}>
            {excludedCols.size > 0
              ? `Import (${headers.length - excludedCols.size} of ${headers.length} columns)`
              : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CSVPreviewModal
