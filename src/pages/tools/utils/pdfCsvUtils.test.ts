import { describe, it, expect } from 'vitest'
import {
  detectColumns,
  groupIntoRows,
  escapeCsvField,
  rowsToCsv,
  structureRows,
  parseDebitCreditNum,
  mergeDebitCredit,
} from './pdfCsvUtils'
import type { TextItem } from './pdfCsvUtils'

function item(x: number, y: number, text: string, width = 50, height = 12): TextItem {
  return { x, y, text, width, height }
}

describe('detectColumns', () => {
  it('returns empty array for no items', () => {
    expect(detectColumns([])).toEqual([])
  })

  it('detects two distinct columns', () => {
    const items = [item(10, 0, 'A'), item(10, 20, 'B'), item(200, 0, 'C'), item(200, 20, 'D')]
    const cols = detectColumns(items)
    expect(cols).toHaveLength(2)
    expect(cols[0]).toBeCloseTo(10, 0)
    expect(cols[1]).toBeCloseTo(200, 0)
  })

  it('merges nearby x positions into one column', () => {
    const items = [item(10, 0, 'A'), item(12, 20, 'B'), item(11, 40, 'C')]
    const cols = detectColumns(items)
    expect(cols).toHaveLength(1)
  })

  it('detects three columns with varying item counts', () => {
    const items = [
      item(10, 0, 'A'),
      item(10, 20, 'B'),
      item(100, 0, 'C'),
      item(200, 0, 'D'),
      item(200, 20, 'E'),
      item(200, 40, 'F'),
    ]
    const cols = detectColumns(items)
    expect(cols).toHaveLength(3)
  })
})

describe('groupIntoRows', () => {
  it('returns empty array for no items', () => {
    expect(groupIntoRows([])).toEqual([])
  })

  it('groups items on the same y into one row', () => {
    const items = [item(100, 10, 'B'), item(10, 10, 'A')]
    const rows = groupIntoRows(items)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(2)
    expect(rows[0][0].text).toBe('A')
    expect(rows[0][1].text).toBe('B')
  })

  it('separates items on different y values into rows', () => {
    const items = [item(10, 10, 'A'), item(10, 30, 'B'), item(10, 50, 'C')]
    const rows = groupIntoRows(items)
    expect(rows).toHaveLength(3)
  })

  it('groups items within yTolerance into same row', () => {
    const items = [item(10, 10, 'A'), item(50, 12, 'B')]
    const rows = groupIntoRows(items, 3)
    expect(rows).toHaveLength(1)
  })

  it('sorts items within a row by x position', () => {
    const items = [item(200, 10, 'C'), item(10, 10, 'A'), item(100, 10, 'B')]
    const rows = groupIntoRows(items)
    expect(rows[0].map(i => i.text)).toEqual(['A', 'B', 'C'])
  })
})

describe('escapeCsvField', () => {
  it('returns plain text unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello')
  })

  it('wraps field with commas in quotes', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"')
  })

  it('escapes embedded quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps field with newlines in quotes', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('handles field with commas and quotes together', () => {
    expect(escapeCsvField('"a",b')).toBe('"""a"",b"')
  })

  it('returns empty string unchanged', () => {
    expect(escapeCsvField('')).toBe('')
  })
})

describe('rowsToCsv', () => {
  it('converts simple rows to CSV', () => {
    const rows = [
      ['Name', 'Age'],
      ['Alice', '30'],
    ]
    expect(rowsToCsv(rows)).toBe('Name,Age\nAlice,30')
  })

  it('escapes fields with special characters', () => {
    const rows = [['a,b', 'c']]
    expect(rowsToCsv(rows)).toBe('"a,b",c')
  })

  it('handles empty rows', () => {
    expect(rowsToCsv([])).toBe('')
  })
})

describe('structureRows', () => {
  it('returns empty array for no items', () => {
    expect(structureRows([])).toEqual([])
  })

  it('structures items into columns and rows', () => {
    const items = [item(10, 10, 'A'), item(200, 10, 'B'), item(10, 30, 'C'), item(200, 30, 'D')]
    const rows = structureRows(items)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual(['A', 'B'])
    expect(rows[1]).toEqual(['C', 'D'])
  })

  it('concatenates multiple items in the same cell with space', () => {
    // Items at x=10 and x=15 — within tolerance (avgHeight*1.5 = 18), same column
    const items = [item(10, 10, 'Hello'), item(15, 10, 'World', 50, 12)]
    const rows = structureRows(items)
    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toBe('Hello World')
  })
})

describe('parseDebitCreditNum', () => {
  it('parses plain number', () => {
    expect(parseDebitCreditNum('100.50')).toBe(100.5)
  })

  it('strips dollar sign and commas', () => {
    expect(parseDebitCreditNum('$1,234.56')).toBe(1234.56)
  })

  it('parses parenthesized negative numbers', () => {
    expect(parseDebitCreditNum('($500.00)')).toBe(-500)
  })

  it('parses negative with dollar sign', () => {
    expect(parseDebitCreditNum('$(1,000.00)')).toBe(-1000)
  })

  it('returns 0 for empty string', () => {
    expect(parseDebitCreditNum('')).toBe(0)
  })

  it('returns 0 for non-numeric text', () => {
    expect(parseDebitCreditNum('abc')).toBe(0)
  })

  it('strips whitespace', () => {
    expect(parseDebitCreditNum(' $ 42.00 ')).toBe(42)
  })
})

describe('mergeDebitCredit', () => {
  it('returns null for empty rows', () => {
    expect(mergeDebitCredit([])).toBeNull()
  })

  it('returns null when no debit/credit columns exist', () => {
    const rows = [['Date', 'Description', 'Amount']]
    expect(mergeDebitCredit(rows)).toBeNull()
  })

  it('merges debit and credit into Amount column', () => {
    const rows = [
      ['Date', 'Debit', 'Credit', 'Balance'],
      ['01/01', '$100.00', '', '$900.00'],
      ['01/02', '', '$50.00', '$950.00'],
    ]
    const merged = mergeDebitCredit(rows)
    expect(merged).not.toBeNull()
    expect(merged![0]).toEqual(['Date', 'Amount', 'Balance'])
    expect(merged![1][1]).toBe('-$100.00')
    expect(merged![2][1]).toBe('$50.00')
  })

  it('handles both debit and credit empty (amount is empty string)', () => {
    const rows = [
      ['Debit', 'Credit'],
      ['', ''],
    ]
    const merged = mergeDebitCredit(rows)
    expect(merged).not.toBeNull()
    expect(merged![1][0]).toBe('')
  })

  it('drops the higher-index column and keeps the lower', () => {
    const rows = [
      ['Credit', 'Debit'],
      ['$50.00', ''],
    ]
    const merged = mergeDebitCredit(rows)
    expect(merged).not.toBeNull()
    expect(merged![0]).toEqual(['Amount'])
    expect(merged![1][0]).toBe('$50.00')
  })

  it('formats amounts with two decimal places', () => {
    const rows = [
      ['Debit', 'Credit'],
      ['$1234', ''],
    ]
    const merged = mergeDebitCredit(rows)
    expect(merged).not.toBeNull()
    expect(merged![1][0]).toBe('-$1,234.00')
  })

  it('handles parenthesized debit values', () => {
    const rows = [
      ['Debit', 'Credit'],
      ['($250.50)', ''],
    ]
    const merged = mergeDebitCredit(rows)
    expect(merged).not.toBeNull()
    expect(merged![1][0]).toBe('-$250.50')
  })
})
