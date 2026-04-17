import { FC, useState, useMemo, useCallback } from 'react'
import CSVPreviewModal from '../budget/components/CSVPreviewModal'
import '../../styles/Drive.css'
import { FileIcon, getFileExt, FolderIcon, BackIcon, UploadIcon } from './driveIcons'
import { buildBudgetTree } from './buildBudgetTree'
import CSVViewer from './CSVViewer'
import { useDriveUpload } from './useDriveUpload'
import type { FileEntry, BreadcrumbPath } from './types'

const Drive: FC = () => {
  const [treeVersion, setTreeVersion] = useState(0)
  const tree = useMemo(() => buildBudgetTree(), [treeVersion])
  const refreshTree = useCallback(() => setTreeVersion(v => v + 1), [])

  const [path, setPath] = useState<BreadcrumbPath>({ level: 'root' })
  const [viewingFile, setViewingFile] = useState<FileEntry | null>(null)
  const [addYearOpen, setAddYearOpen] = useState(false)
  const [newYearValue, setNewYearValue] = useState(new Date().getFullYear())

  const {
    csvPreview, toastMsg, dismissToast, dragOver, fileInputRef,
    handlePreviewConfirm, handlePreviewCancel,
    handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
    handleFileInputChange, openFilePicker,
  } = useDriveUpload(refreshTree)

  const handleAddYear = () => {
    const yr = newYearValue
    if (yr < 2000 || yr > 2100) return
    setPath({ level: 'folder', folderName: String(yr), year: yr })
    setAddYearOpen(false)
  }

  if (viewingFile) {
    return (
      <div className="drive-page">
        <CSVViewer csv={viewingFile.csv} label={viewingFile.label} onBack={() => setViewingFile(null)} />
      </div>
    )
  }

  const currentFolder = path.level === 'folder' ? tree.find(f => f.year === path.year) : null

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

      {/* Root level */}
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
          {/* Year tabs */}
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
                <FileIcon ext={getFileExt(file.label) || 'csv'} />
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
            onClick={openFilePicker}
          >
            <input ref={fileInputRef} type="file" accept=".csv" multiple
              style={{ display: 'none' }} onChange={handleFileInputChange} />
            <div className="drive-dropzone-icon"><UploadIcon /></div>
            <div className="drive-dropzone-text">
              {dragOver ? 'Drop CSV files here' : 'Drag & drop CSV files or click to browse'}
            </div>
            <div className="drive-dropzone-hint">
              Filenames should contain YYYY-MM (e.g. 2025-05.csv) or match "Our Finances - MMM YYYY.csv"
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {path.level === 'root' && tree.length === 0 && (
        <div className="drive-empty">
          No budget files yet. Upload CSVs in the Budget page to see them here.
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="drive-toast">
          <span>{toastMsg}</span>
          <button className="drive-toast-close" onClick={dismissToast}>×</button>
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
