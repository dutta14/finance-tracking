import { FC, useState, useMemo, useCallback, useRef } from 'react'
import { loadBudgetStore } from '../budget/utils/budgetStorage'
import { splitCSVRows, parseCSVLine, formatMonthKey } from '../budget/utils/csvParser'
import { useBudget } from '../budget/hooks/useBudget'
import CSVPreviewModal from '../budget/components/CSVPreviewModal'
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

import { monthKeyFromFilename } from '../budget/hooks/useCSVUpload'

/* ── main component ──────────────────────────────────────────── */

type BreadcrumbPath =
  | { level: 'root' }
  | { level: 'folder'; folderName: string; year: number }

const Drive: FC = () => {
  const [treeVersion, setTreeVersion] = useState(0)
  const tree = useMemo(() => buildBudgetTree(), [treeVersion])
  const refreshTree = useCallback(() => setTreeVersion(v => v + 1), [])

  const [path, setPath] = useState<BreadcrumbPath>({ level: 'root' })
  const [viewingFile, setViewingFile] = useState<FileEntry | null>(null)

  /* ── upload pipeline ───────────────────────────────────────── */
  const { uploadCSV } = useBudget()
  const [csvPreview, setCsvPreview] = useState<{ monthKey: string; csv: string } | null>(null)
  const [bulkQueue, setBulkQueue] = useState<{ monthKey: string; csv: string }[]>([])
  const [pendingNewCats, setPendingNewCats] = useState<string[]>([])
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [addYearOpen, setAddYearOpen] = useState(false)
  const [newYearValue, setNewYearValue] = useState(new Date().getFullYear())

  /* ── drag & drop ───────────────────────────────────────────── */
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) { dragCounter.current = 0; setDragOver(false) }
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    dragCounter.current = 0
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'))
    if (files.length === 0) {
      showToast('No CSV files found. Drop .csv files to upload.')
      return
    }
    await processFiles(files)
  }

  const processFiles = async (files: File[]) => {
    const pending: { monthKey: string; csv: string }[] = []
    const skipped: string[] = []

    for (const file of files) {
      const monthKey = monthKeyFromFilename(file.name)
      if (!monthKey) { skipped.push(file.name); continue }
      const text = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target?.result as string)
        reader.readAsText(file)
      })
      pending.push({ monthKey, csv: text })
    }

    if (skipped.length > 0) {
      showToast(`Skipped ${skipped.length} file(s): couldn't determine month from filename`)
    }

    if (pending.length > 0) {
      setCsvPreview(pending[0])
      setBulkQueue(pending.slice(1))
    }
  }

  const handlePreviewConfirm = (filteredCsv: string) => {
    if (!csvPreview) return
    const result = uploadCSV(csvPreview.monthKey, filteredCsv)
    const newCats = [...pendingNewCats, ...(result.newCategories || [])]

    if (!result.ok) {
      showToast(`Upload failed: ${result.error}`)
    } else if (bulkQueue.length === 0) {
      const uniqueNew = [...new Set(newCats)]
      if (uniqueNew.length > 0) {
        showToast(`Uploaded! New categories: ${uniqueNew.join(', ')}`)
      } else {
        showToast('Uploaded successfully')
      }
      setPendingNewCats([])
    } else {
      setPendingNewCats(newCats)
    }

    if (bulkQueue.length > 0) {
      setCsvPreview(bulkQueue[0])
      setBulkQueue(bulkQueue.slice(1))
    } else {
      setCsvPreview(null)
      refreshTree()
    }
  }

  const handlePreviewCancel = () => {
    if (bulkQueue.length > 0) {
      setCsvPreview(bulkQueue[0])
      setBulkQueue(bulkQueue.slice(1))
    } else {
      setCsvPreview(null)
      if (pendingNewCats.length > 0) {
        const uniqueNew = [...new Set(pendingNewCats)]
        showToast(`New categories: ${uniqueNew.join(', ')}`)
        setPendingNewCats([])
      }
      refreshTree()
    }
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 5000)
  }

  /* ── add year ──────────────────────────────────────────────── */
  const handleAddYear = () => {
    const yr = newYearValue
    if (yr < 2000 || yr > 2100) return
    // Navigate to that year — it will show as empty with the drop zone
    setPath({ level: 'folder', folderName: String(yr), year: yr })
    setAddYearOpen(false)
  }

  /* ── file input ref for click-to-browse ────────────────────── */
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await processFiles(Array.from(files))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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

  /* Build full year list: tree years + the currently navigated year (for empty new years) */
  const allYears = [...new Set([
    ...tree.map(f => f.year),
    ...(path.level === 'folder' ? [path.year] : []),
  ])].sort((a, b) => b - a)

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
            <button className="drive-breadcrumb-item" onClick={() => setPath({ level: 'folder', folderName: String(allYears[0] ?? path.year), year: allYears[0] ?? path.year })}>Budget</button>
            <span className="drive-breadcrumb-sep">/</span>
            <button className="drive-breadcrumb-item active">{path.folderName}</button>
          </>
        )}
      </nav>

      {/* Root level: show top-level folders */}
      {path.level === 'root' && (
        <div className="drive-list">
          <div
            className="drive-row drive-row--folder"
            onClick={() => {
              if (tree.length > 0) {
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

      {/* Inside a year folder */}
      {path.level === 'folder' && (
        <>
          {/* Year tabs + add year */}
          <div className="drive-year-tabs">
            {allYears.map(yr => (
              <button
                key={yr}
                className={`drive-year-tab${yr === path.year ? ' active' : ''}`}
                onClick={() => setPath({ level: 'folder', folderName: String(yr), year: yr })}
              >
                {yr}
              </button>
            ))}
            {!addYearOpen ? (
              <button className="drive-year-tab drive-year-add" onClick={() => setAddYearOpen(true)}>+</button>
            ) : (
              <div className="drive-add-year-form">
                <input type="number" className="drive-add-year-input" value={newYearValue}
                  onChange={e => setNewYearValue(Number(e.target.value))} min={2000} max={2100} />
                <button className="drive-add-year-go" onClick={handleAddYear}>Go</button>
                <button className="drive-add-year-cancel" onClick={() => setAddYearOpen(false)}>×</button>
              </div>
            )}
          </div>

          {/* File list */}
          <div className="drive-list">
            <div className="drive-row drive-row--back" onClick={() => setPath({ level: 'root' })}>
              <BackIcon />
              <span className="drive-row-name">..</span>
            </div>
            {currentFolder?.files.map(file => (
              <div key={file.monthKey} className="drive-row drive-row--file" onClick={() => setViewingFile(file)}>
                <FileIcon />
                <span className="drive-row-name">{file.label}</span>
                <span className="drive-row-meta">{new Date(file.uploadedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>

          {/* Drop zone */}
          <div
            className={`drive-dropzone${dragOver ? ' active' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".csv" multiple
              style={{ display: 'none' }} onChange={handleFileInputChange} />
            <div className="drive-dropzone-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="drive-dropzone-text">
              {dragOver ? 'Drop CSV files here' : 'Drag & drop CSV files or click to browse'}
            </div>
            <div className="drive-dropzone-hint">
              Filenames should contain YYYY-MM (e.g. 2025-05.csv) or match "Our Finances - MMM YYYY.csv"
            </div>
          </div>
        </>
      )}

      {/* Empty state at root */}
      {path.level === 'root' && tree.length === 0 && (
        <div className="drive-empty">
          No budget files yet. Upload CSVs in the Budget page to see them here.
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="drive-toast">
          <span>{toastMsg}</span>
          <button className="drive-toast-close" onClick={() => setToastMsg(null)}>×</button>
        </div>
      )}

      {/* CSV Preview Modal */}
      {csvPreview && (
        <CSVPreviewModal
          csv={csvPreview.csv}
          monthKey={csvPreview.monthKey}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
        />
      )}
    </div>
  )
}

export default Drive
