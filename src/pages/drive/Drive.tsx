import { FC, useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import CSVPreviewModal from '../budget/components/CSVPreviewModal'
import '../../styles/Drive.css'
import { FileIcon, getFileExt, FolderIcon, BackIcon, UploadIcon } from './driveIcons'
import { buildDriveTree } from './buildBudgetTree'
import CSVViewer from './CSVViewer'
import { useDriveUpload } from './useDriveUpload'
import { resolvePathSegments } from './types'
import type { DriveFolder, DriveFile } from './types'

function segmentsFromUrl(pathname: string): string[] {
  const raw = pathname.replace(/^\/drive\/?/, '').replace(/\/$/, '')
  return raw ? raw.split('/').map(decodeURIComponent) : []
}

function urlFromSegments(segments: string[]): string {
  if (segments.length === 0) return '/drive'
  return '/drive/' + segments.map(encodeURIComponent).join('/')
}

const Drive: FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [treeVersion, setTreeVersion] = useState(0)
  const root = useMemo(() => buildDriveTree(), [treeVersion])
  const refreshTree = useCallback(() => setTreeVersion(v => v + 1), [])

  const [segments, setSegmentsState] = useState<string[]>(() => segmentsFromUrl(location.pathname))
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'name' | 'owner' | 'date'>('name')

  const goTo = useCallback((segs: string[]) => {
    setSegmentsState(segs)
    navigate(urlFromSegments(segs))
  }, [navigate])

  // Sync state on browser back/forward
  useEffect(() => {
    setSegmentsState(segmentsFromUrl(location.pathname))
  }, [location.pathname])

  const resolved = useMemo(() => resolvePathSegments(root, segments), [root, segments])

  const {
    csvPreview, toastMsg, dismissToast, dragOver, fileInputRef,
    handlePreviewConfirm, handlePreviewCancel,
    handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
    handleFileInputChange, openFilePicker,
  } = useDriveUpload(refreshTree)

  // ── Folder / root view ──────────────────────────────────────
  const folder: DriveFolder = resolved.kind === 'folder' ? resolved.folder
    : resolved.kind === 'root' ? resolved.folder
    : root // notfound fallback → root

  const isRoot = segments.length === 0

  // Check if any files have owner metadata (show filter/sort controls)
  const hasMetaFiles = folder.files.some(f => f.meta?.owner)

  // Collect unique owners for filter options
  const ownerOptions = useMemo(() => {
    const owners = new Set<string>()
    for (const f of folder.files) {
      if (f.meta?.owner) owners.add(f.meta.owner)
    }
    return [...owners].sort()
  }, [folder.files])

  // Filter and sort files
  const displayFiles = useMemo(() => {
    let files: DriveFile[] = folder.files
    if (ownerFilter) {
      files = files.filter(f => f.meta?.owner === ownerFilter)
    }
    const sorted = [...files]
    if (sortField === 'owner') {
      sorted.sort((a, b) => (a.meta?.owner || '').localeCompare(b.meta?.owner || ''))
    } else if (sortField === 'date') {
      sorted.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    }
    return sorted
  }, [folder.files, ownerFilter, sortField])

  // For budget year folders, find sibling year tabs
  const parentFolder = resolved.kind === 'folder' && resolved.parents.length > 0
    ? resolved.parents[resolved.parents.length - 1]
    : null
  const siblingYearFolders = parentFolder?.folders
  const currentSlug = resolved.kind === 'folder' ? resolved.folder.slug : null

  // ── File view ───────────────────────────────────────────────
  if (resolved.kind === 'file') {
    const { file } = resolved
    const parentSegs = segments.slice(0, -1)
    const isPdf = file.ext.toLowerCase() === 'pdf'
    return (
      <div className="drive-page">
        {isPdf ? (
          <div className="drive-viewer">
            <button className="drive-viewer-back" onClick={() => goTo(parentSegs)}>
              <BackIcon /> Back
            </button>
            <h2 className="drive-viewer-title">{file.name}</h2>
            <div className="drive-pdf-wrap">
              <iframe
                src={file.content}
                title={file.name}
                className="drive-pdf-frame"
              />
            </div>
          </div>
        ) : (
          <CSVViewer
            content={file.content}
            label={file.name}
            ext={file.ext}
            onBack={() => goTo(parentSegs)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="drive-page">
      <div className="drive-header">
        <h1 className="drive-title">Drive</h1>
      </div>

      {/* Breadcrumb */}
      <nav className="drive-breadcrumb">
        <button
          className={`drive-breadcrumb-item${isRoot ? ' active' : ''}`}
          onClick={() => goTo([])}
        >
          Drive
        </button>
        {segments.map((seg, i) => {
          const crumbSegs = segments.slice(0, i + 1)
          const node = resolvePathSegments(root, crumbSegs)
          const label = node.kind === 'folder' ? node.folder.name : node.kind === 'root' ? node.folder.name : seg
          const isLast = i === segments.length - 1
          return (
            <span key={i}>
              <span className="drive-breadcrumb-sep">/</span>
              <button
                className={`drive-breadcrumb-item${isLast ? ' active' : ''}`}
                onClick={() => goTo(crumbSegs)}
              >
                {label}
              </button>
            </span>
          )
        })}
      </nav>

      {/* Year tabs (shown when inside a year-level folder with sibling folders) */}
      {siblingYearFolders && siblingYearFolders.length > 1 && (
        <div className="drive-year-tabs">
          {siblingYearFolders.map(sib => (
            <button
              key={sib.slug}
              className={`drive-year-tab${sib.slug === currentSlug ? ' active' : ''}`}
              onClick={() => goTo([...segments.slice(0, -1), sib.slug])}
            >
              {sib.name}
            </button>
          ))}
        </div>
      )}

      {/* Filter / Sort bar (shown when files have metadata) */}
      {hasMetaFiles && folder.files.length > 0 && (
        <div className="drive-filter-bar">
          <div className="drive-filter-group">
            <span className="drive-filter-label">Owner:</span>
            <button
              className={`drive-filter-btn${ownerFilter === null ? ' active' : ''}`}
              onClick={() => setOwnerFilter(null)}
            >All</button>
            {ownerOptions.map(o => (
              <button
                key={o}
                className={`drive-filter-btn${ownerFilter === o ? ' active' : ''}`}
                onClick={() => setOwnerFilter(ownerFilter === o ? null : o)}
              >{o}</button>
            ))}
          </div>
          <div className="drive-filter-group">
            <span className="drive-filter-label">Sort:</span>
            <button className={`drive-filter-btn${sortField === 'name' ? ' active' : ''}`} onClick={() => setSortField('name')}>Name</button>
            <button className={`drive-filter-btn${sortField === 'owner' ? ' active' : ''}`} onClick={() => setSortField('owner')}>Owner</button>
            <button className={`drive-filter-btn${sortField === 'date' ? ' active' : ''}`} onClick={() => setSortField('date')}>Date</button>
          </div>
        </div>
      )}

      {/* Folder listing */}
      <div className="drive-list">
        {!isRoot && (
          <div className="drive-row drive-row--back" onClick={() => goTo(segments.slice(0, -1))}>
            <BackIcon />
            <span className="drive-row-name">..</span>
          </div>
        )}
        {folder.folders.map(sub => (
          <div
            key={sub.slug}
            className="drive-row drive-row--folder"
            onClick={() => goTo([...segments, sub.slug])}
          >
            <FolderIcon />
            <span className="drive-row-name">{sub.name}</span>
            <span className="drive-row-meta">
              {sub.folders.length + sub.files.length} item{sub.folders.length + sub.files.length !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
        {displayFiles.map(file => (
          <div
            key={file.slug}
            className="drive-row drive-row--file"
            onClick={() => goTo([...segments, file.slug])}
          >
            <FileIcon ext={file.ext || getFileExt(file.name)} />
            <span className="drive-row-name">{file.name}</span>
            {file.meta?.owner && <span className="drive-row-tag">{file.meta.owner}</span>}
            {file.meta?.category && <span className="drive-row-tag drive-row-tag--cat">{file.meta.category}</span>}
            {file.meta?.accounts && <span className="drive-row-tag drive-row-tag--acct">{file.meta.accounts}</span>}
            <span className="drive-row-meta">{new Date(file.uploadedAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>

      {/* Drop zone (show when inside any folder, not root) */}
      {!isRoot && (
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
      )}

      {/* Empty state */}
      {isRoot && folder.folders.length === 0 && folder.files.length === 0 && (
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
