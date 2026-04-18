import { describe, it, expect } from 'vitest'

// Test pure helper functions from taxGitHubSync.ts
// These are not exported, so we replicate the logic to validate correctness

/** Strip data-URL prefix to get raw base64 */
function stripDataUrl(content: string): string {
  const idx = content.indexOf(',')
  return idx >= 0 ? content.slice(idx + 1) : content
}

/** Build GitHub path: taxes/<year>/<owner>_<label>.<ext> */
function filePath(year: number, ownerLabel: string, itemLabel: string, fileId: string, ext: string): string {
  const safeName = `${ownerLabel}_${itemLabel}`.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
  return `taxes/${year}/${safeName}_${fileId}.${ext}`
}

describe('stripDataUrl', () => {
  it('strips data URL prefix from base64 content', () => {
    const input = 'data:application/pdf;base64,JVBERi0xLjQK'
    expect(stripDataUrl(input)).toBe('JVBERi0xLjQK')
  })

  it('strips image data URL prefix', () => {
    const input = 'data:image/png;base64,iVBORw0KGgo='
    expect(stripDataUrl(input)).toBe('iVBORw0KGgo=')
  })

  it('returns raw string if no comma present', () => {
    const input = 'rawbase64content'
    expect(stripDataUrl(input)).toBe('rawbase64content')
  })

  it('handles empty string', () => {
    expect(stripDataUrl('')).toBe('')
  })

  it('handles content with multiple commas (takes first split)', () => {
    const input = 'data:text/csv;base64,abc,def,ghi'
    expect(stripDataUrl(input)).toBe('abc,def,ghi')
  })
})

describe('filePath', () => {
  it('builds correct path with clean names', () => {
    const result = filePath(2024, 'Jane', 'W-2', 'abc123', 'pdf')
    expect(result).toBe('taxes/2024/Jane_W-2_abc123.pdf')
  })

  it('sanitizes special characters in names', () => {
    const result = filePath(2024, 'Jane', 'Tax Return (Federal)', 'f1', 'pdf')
    expect(result).toBe('taxes/2024/Jane_Tax_Return_Federal_f1.pdf')
  })

  it('collapses multiple spaces', () => {
    const result = filePath(2024, 'Jane  Doe', 'My  Document', 'f1', 'csv')
    expect(result).toBe('taxes/2024/Jane_Doe_My_Document_f1.csv')
  })

  it('handles minimal inputs', () => {
    const result = filePath(2025, 'A', 'B', 'x', 'txt')
    expect(result).toBe('taxes/2025/A_B_x.txt')
  })
})
