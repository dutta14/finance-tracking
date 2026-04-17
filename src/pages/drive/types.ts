export interface DriveFile {
  name: string        // display name, e.g. "May 2025"
  slug: string        // URL-safe identifier, e.g. "2025-05"
  ext: string         // "csv", "json", etc.
  content: string
  uploadedAt: string
}

export interface DriveFolder {
  name: string        // display name, e.g. "Budget" or "2025"
  slug: string        // URL-safe identifier
  folders: DriveFolder[]
  files: DriveFile[]
}

/** Result of resolving a path against the tree */
export type ResolvedNode =
  | { kind: 'root'; folder: DriveFolder }
  | { kind: 'folder'; folder: DriveFolder; parents: DriveFolder[] }
  | { kind: 'file'; file: DriveFile; parent: DriveFolder; parents: DriveFolder[] }
  | { kind: 'notfound' }

export function resolvePathSegments(root: DriveFolder, segments: string[]): ResolvedNode {
  if (segments.length === 0) return { kind: 'root', folder: root }

  let current = root
  const parents: DriveFolder[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const isLast = i === segments.length - 1

    // Try matching a subfolder
    const sub = current.folders.find(f => f.slug === seg)
    if (sub) {
      parents.push(current)
      if (isLast) return { kind: 'folder', folder: sub, parents }
      current = sub
      continue
    }

    // On the last segment, try matching a file
    if (isLast) {
      const file = current.files.find(f => f.slug === seg)
      if (file) return { kind: 'file', file, parent: current, parents }
    }

    return { kind: 'notfound' }
  }

  return { kind: 'notfound' }
}
