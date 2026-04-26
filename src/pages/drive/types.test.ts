import { describe, it, expect } from 'vitest'
import { resolvePathSegments } from './types'
import type { DriveFolder, DriveFile } from './types'

const makeFile = (name: string, slug: string): DriveFile => ({
  name,
  slug,
  ext: 'csv',
  content: 'test',
  uploadedAt: '2025-01-01',
})

const buildTree = (): DriveFolder => ({
  name: 'Drive',
  slug: '',
  folders: [
    {
      name: 'Budget',
      slug: 'budget',
      folders: [
        {
          name: '2025',
          slug: '2025',
          folders: [],
          files: [makeFile('January 2025', '2025-01'), makeFile('February 2025', '2025-02')],
        },
      ],
      files: [],
    },
    {
      name: 'Taxes',
      slug: 'taxes',
      folders: [
        {
          name: '2024',
          slug: '2024',
          folders: [],
          files: [makeFile('W2', 'w2-doc')],
        },
      ],
      files: [],
    },
  ],
  files: [makeFile('README', 'readme')],
})

describe('resolvePathSegments', () => {
  const root = buildTree()

  it('returns root when segments is empty', () => {
    const result = resolvePathSegments(root, [])
    expect(result.kind).toBe('root')
    if (result.kind === 'root') {
      expect(result.folder.name).toBe('Drive')
    }
  })

  it('resolves a top-level folder', () => {
    const result = resolvePathSegments(root, ['budget'])
    expect(result.kind).toBe('folder')
    if (result.kind === 'folder') {
      expect(result.folder.name).toBe('Budget')
      expect(result.parents).toHaveLength(1)
      expect(result.parents[0].name).toBe('Drive')
    }
  })

  it('resolves a nested folder', () => {
    const result = resolvePathSegments(root, ['budget', '2025'])
    expect(result.kind).toBe('folder')
    if (result.kind === 'folder') {
      expect(result.folder.name).toBe('2025')
      expect(result.parents).toHaveLength(2)
    }
  })

  it('resolves a file inside a nested folder', () => {
    const result = resolvePathSegments(root, ['budget', '2025', '2025-01'])
    expect(result.kind).toBe('file')
    if (result.kind === 'file') {
      expect(result.file.name).toBe('January 2025')
      expect(result.parent.name).toBe('2025')
      expect(result.parents).toHaveLength(2)
    }
  })

  it('resolves a file at the root level', () => {
    const result = resolvePathSegments(root, ['readme'])
    expect(result.kind).toBe('file')
    if (result.kind === 'file') {
      expect(result.file.name).toBe('README')
    }
  })

  it('returns notfound for invalid path', () => {
    expect(resolvePathSegments(root, ['nonexistent']).kind).toBe('notfound')
  })

  it('returns notfound for valid folder but invalid file', () => {
    expect(resolvePathSegments(root, ['budget', 'nonexistent']).kind).toBe('notfound')
  })

  it('returns notfound for path past a file (too deep)', () => {
    expect(resolvePathSegments(root, ['budget', '2025', '2025-01', 'extra']).kind).toBe('notfound')
  })

  it('resolves in a different branch (taxes)', () => {
    const result = resolvePathSegments(root, ['taxes', '2024', 'w2-doc'])
    expect(result.kind).toBe('file')
    if (result.kind === 'file') {
      expect(result.file.name).toBe('W2')
    }
  })
})
