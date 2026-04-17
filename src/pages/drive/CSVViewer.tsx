import { FC, useMemo } from 'react'
import { splitCSVRows, parseCSVLine } from '../budget/utils/csvParser'
import { BackIcon } from './driveIcons'

const CSVViewer: FC<{ csv: string; label: string; onBack: () => void }> = ({ csv, label, onBack }) => {
  const lines = useMemo(() => splitCSVRows(csv.trim()), [csv])
  const headers = useMemo(() => parseCSVLine(lines[0]).map(h => h.trim()), [lines])
  const rows = useMemo(
    () => lines.slice(1).filter(l => l.trim()).map(l => parseCSVLine(l)),
    [lines],
  )

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
