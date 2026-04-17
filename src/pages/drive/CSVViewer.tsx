import { FC, useMemo } from 'react'
import { splitCSVRows, parseCSVLine } from '../budget/utils/csvParser'
import { BackIcon } from './driveIcons'

interface Props {
  content: string
  label: string
  ext: string
  onBack: () => void
}

const CSVViewer: FC<Props> = ({ content, label, ext, onBack }) => {
  const lines = useMemo(() => splitCSVRows(content.trim()), [content])
  const headers = useMemo(() => parseCSVLine(lines[0]).map(h => h.trim()), [lines])
  const rows = useMemo(
    () => lines.slice(1).filter(l => l.trim()).map(l => parseCSVLine(l)),
    [lines],
  )

  // For non-CSV files, show raw content
  if (ext !== 'csv') {
    return (
      <div className="drive-viewer">
        <button className="drive-viewer-back" onClick={onBack}>
          <BackIcon /> Back
        </button>
        <h2 className="drive-viewer-title">{label}</h2>
        <div className="drive-viewer-table-wrap">
          <pre style={{ padding: '1rem', margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.82rem', color: 'var(--color-text)' }}>{content}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="drive-viewer">
      <button className="drive-viewer-back" onClick={onBack}>
        <BackIcon /> Back
      </button>
      <h2 className="drive-viewer-title">{label}</h2>
      <div className="drive-viewer-table-wrap">
        <table className="drive-viewer-table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cols, ri) => (
              <tr key={ri}>
                {cols.map((c, ci) => (
                  <td key={ci}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="drive-viewer-meta">{rows.length} rows</div>
    </div>
  )
}

export default CSVViewer
