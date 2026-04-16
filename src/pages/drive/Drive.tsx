import { FC, useState, useMemo } from 'react'
import { loadBudgetStore } from '../budget/utils/budgetStorage'
import { splitCSVRows, parseCSVLine, formatMonthKey } from '../budget/utils/csvParser'
import '../../styles/Drive.css'

/* ── helpers ─────────────────────────────────────────────────── */

interface FileEntry {
  monthKey: string   // "2025-05"
  label: string      // "May 2025"
  csv: string
  uploadedAt: string
}

interface YearFolder {
  year: number
  files: FileEntry[]
}

function buildBudgetTree(): YearFolder[] {
  const store = loadBudgetStore()
  const byYear = new Map<number, FileEntry[]>()
  for (const [key, m] of Object.entries(store.csvs)) {
    const yr = parseInt(key.split('-')[0], 10)
    if (!byYear.has(yr)) byYear.set(yr, [])
    byYear.get(yr)!.push({
      monthKey: key,
      label: formatMonthKey(key),
      csv: m.csv,
      uploadedAt: m.uploadedAt,
    })
  }
  // sort years descending, months ascending within each year
  const folders: YearFolder[] = []
  for (const [year, files] of byYear) {
    files.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    folders.push({ year, files })
  }
  folders.sort((a, b) => b.year - a.year)
  return folders
}

/* ── icons ───────────────────────────────────────────────────── */

const FolderIcon: FC<{ open?: boolean }> = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="drive-icon">
    {open ? (
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1H8.5a2 2 0 00-1.8 1.1L4 16H2V6z M4 16l2.7-5.4a1 1 0 01.9-.6H18l-2.7 5.4a1 1 0 01-.9.6H4z" fill="currentColor" />
    ) : (
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" fill="currentColor" />
    )}
  </svg>
)

const FileIcon: FC = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="drive-icon">
    <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H4z" fill="currentColor" opacity="0.15" />
    <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H4zm8 0v4a2 2 0 002 2h4" stroke="currentColor" strokeWidth="1.3" />
  </svg>
)

const BackIcon: FC = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="drive-icon">
    <path d="M10 16l-6-6 6-6M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/* ── CSV viewer ──────────────────────────────────────────────── */

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

/* ── main component ──────────────────────────────────────────── */

type BreadcrumbPath =
  | { level: 'root' }
  | { level: 'folder'; folderName: string; year: number }

const Drive: FC = () => {
  const tree = useMemo(() => buildBudgetTree(), [])
  const [path, setPath] = useState<BreadcrumbPath>({ level: 'root' })
  const [viewingFile, setViewingFile] = useState<FileEntry | null>(null)

  if (viewingFile) {
    return (
      <div className="drive-page">
        <CSVViewer
          csv={viewingFile.csv}
          label={viewingFile.label}
          onBack={() => setViewingFile(null)}
        />
      </div>
    )
  }

  const currentFolder = path.level === 'folder'
    ? tree.find(f => f.year === path.year)
    : null

  return (
    <div className="drive-page">
      <div className="drive-header">
        <h1 className="drive-title">Drive</h1>
      </div>

      {/* Breadcrumb */}
      <nav className="drive-breadcrumb">
        <button
          className={`drive-breadcrumb-item${path.level === 'root' ? ' active' : ''}`}
          onClick={() => setPath({ level: 'root' })}
        >
          Drive
        </button>
        {path.level === 'folder' && (
          <>
            <span className="drive-breadcrumb-sep">/</span>
            <button className="drive-breadcrumb-item active">Budget</button>
            <span className="drive-breadcrumb-sep">/</span>
            <button className="drive-breadcrumb-item active">{path.folderName}</button>
          </>
        )}
        {path.level === 'root' && (
          <>
            {/* show nothing extra at root */}
          </>
        )}
      </nav>

      {/* Root level: show top-level folders */}
      {path.level === 'root' && (
        <div className="drive-list">
          <div
            className="drive-row drive-row--folder"
            onClick={() => {
              // If there are budget files, go into the first year; otherwise just show "Budget" folder
              if (tree.length > 0) {
                // Show year folders inside Budget
                setPath({ level: 'folder', folderName: String(tree[0].year), year: tree[0].year })
              }
            }}
          >
            <FolderIcon />
            <span className="drive-row-name">Budget</span>
            <span className="drive-row-meta">{tree.reduce((s, f) => s + f.files.length, 0)} files</span>
          </div>
        </div>
      )}

      {/* Inside a year folder: show files */}
      {path.level === 'folder' && currentFolder && (
        <>
          {/* Year tabs */}
          <div className="drive-year-tabs">
            {tree.map(f => (
              <button
                key={f.year}
                className={`drive-year-tab${f.year === path.year ? ' active' : ''}`}
                onClick={() => setPath({ level: 'folder', folderName: String(f.year), year: f.year })}
              >
                {f.year}
              </button>
            ))}
          </div>

          <div className="drive-list">
            <div
              className="drive-row drive-row--back"
              onClick={() => setPath({ level: 'root' })}
            >
              <BackIcon />
              <span className="drive-row-name">..</span>
            </div>
            {currentFolder.files.map(file => (
              <div
                key={file.monthKey}
                className="drive-row drive-row--file"
                onClick={() => setViewingFile(file)}
              >
                <FileIcon />
                <span className="drive-row-name">{file.label}</span>
                <span className="drive-row-meta">
                  {new Date(file.uploadedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {path.level === 'folder' && !currentFolder && (
        <div className="drive-empty">No files found.</div>
      )}
      {path.level === 'root' && tree.length === 0 && (
        <div className="drive-empty">
          No budget files yet. Upload CSVs in the Budget page to see them here.
        </div>
      )}
    </div>
  )
}

export default Drive
