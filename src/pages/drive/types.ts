export interface FileEntry {
  monthKey: string   // "2025-05"
  label: string      // "May 2025"
  csv: string
  uploadedAt: string
}

export interface YearFolder {
  year: number
  files: FileEntry[]
}

export type BreadcrumbPath =
  | { level: 'root' }
  | { level: 'folder'; folderName: string; year: number }
