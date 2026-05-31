import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FileIcon, FolderIcon, BackIcon, RenameIcon, UploadIcon, getFileExt } from './driveIcons'

describe('getFileExt', () => {
  it('returns extension in lowercase when dot present', () => {
    expect(getFileExt('report.PDF')).toBe('pdf')
    expect(getFileExt('data.csv')).toBe('csv')
  })

  it('returns empty string when no dot present (line 52)', () => {
    expect(getFileExt('noextension')).toBe('')
  })

  it('returns last extension for multiple dots', () => {
    expect(getFileExt('archive.tar.gz')).toBe('gz')
  })
})

describe('FileIcon', () => {
  it('renders with ext-specific details for csv', () => {
    const { container } = render(<FileIcon ext="csv" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelectorAll('line').length).toBeGreaterThan(0)
  })

  it('renders without details when ext is undefined', () => {
    const { container } = render(<FileIcon />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders without details when ext has no matching icon', () => {
    const { container } = render(<FileIcon ext="xyz" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('FolderIcon', () => {
  it('renders open folder when open is true', () => {
    const { container } = render(<FolderIcon open={true} />)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(1)
    expect(paths[0].getAttribute('d')).toContain('M2 6')
  })

  it('renders closed folder when open is false', () => {
    const { container } = render(<FolderIcon open={false} />)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(1)
  })
})

describe('BackIcon', () => {
  it('renders svg', () => {
    const { container } = render(<BackIcon />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('RenameIcon', () => {
  it('renders svg', () => {
    const { container } = render(<RenameIcon />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('UploadIcon', () => {
  it('renders svg', () => {
    const { container } = render(<UploadIcon />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
