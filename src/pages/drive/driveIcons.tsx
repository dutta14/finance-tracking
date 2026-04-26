import { FC, ReactNode } from 'react'

const FileIconBase: FC<{ children?: ReactNode }> = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="drive-icon">
    <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H4z" fill="currentColor" opacity="0.15" />
    <path
      d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H4zm8 0v4a2 2 0 002 2h4"
      stroke="currentColor"
      strokeWidth="1.3"
    />
    {children}
  </svg>
)

const fileIconDetails: Record<string, ReactNode> = {
  csv: (
    <>
      <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <line x1="5" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <line x1="9" y1="10" x2="9" y2="16" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
    </>
  ),
  json: (
    <>
      <text x="10" y="14.5" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor" opacity="0.55">
        {'{}'}
      </text>
    </>
  ),
  txt: (
    <>
      <line x1="5" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="0.8" opacity="0.45" />
      <line x1="5" y1="12.5" x2="11" y2="12.5" stroke="currentColor" strokeWidth="0.8" opacity="0.45" />
      <line x1="5" y1="15" x2="14" y2="15" stroke="currentColor" strokeWidth="0.8" opacity="0.45" />
    </>
  ),
  pdf: (
    <>
      <text x="10" y="14.5" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="currentColor" opacity="0.55">
        PDF
      </text>
    </>
  ),
}

export const FileIcon: FC<{ ext?: string }> = ({ ext }) => (
  <FileIconBase>{ext && fileIconDetails[ext.toLowerCase()]}</FileIconBase>
)

export function getFileExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export const FolderIcon: FC<{ open?: boolean }> = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="drive-icon">
    {open ? (
      <path
        d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1H8.5a2 2 0 00-1.8 1.1L4 16H2V6z M4 16l2.7-5.4a1 1 0 01.9-.6H18l-2.7 5.4a1 1 0 01-.9.6H4z"
        fill="currentColor"
      />
    ) : (
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" fill="currentColor" />
    )}
  </svg>
)

export const BackIcon: FC = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="drive-icon">
    <path
      d="M10 16l-6-6 6-6M4 10h12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const UploadIcon: FC = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)
