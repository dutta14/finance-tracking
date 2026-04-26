import { describe, it, expect } from 'vitest'
import { parseCSV, parseCSVLine, splitCSVRows, monthKeyFromDate, formatMonthKey, shortMonthName } from './csvParser'

describe('parseCSVLine', () => {
  it('splits a simple comma-separated line', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('handles quoted fields with commas', () => {
    expect(parseCSVLine('a,"hello, world",c')).toEqual(['a', 'hello, world', 'c'])
  })

  it('handles escaped quotes inside quoted fields', () => {
    expect(parseCSVLine('"say ""hi""",b')).toEqual(['say "hi"', 'b'])
  })

  it('handles empty fields', () => {
    expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c'])
  })

  it('handles single field', () => {
    expect(parseCSVLine('hello')).toEqual(['hello'])
  })

  it('handles empty string', () => {
    expect(parseCSVLine('')).toEqual([''])
  })
})

describe('splitCSVRows', () => {
  it('splits simple rows by newline', () => {
    expect(splitCSVRows('a\nb\nc')).toEqual(['a', 'b', 'c'])
  })

  it('handles \\r\\n line endings', () => {
    expect(splitCSVRows('a\r\nb\r\nc')).toEqual(['a', 'b', 'c'])
  })

  it('preserves newlines inside quoted fields', () => {
    const csv = 'a,"line1\nline2",c\nd,e,f'
    const rows = splitCSVRows(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('line1\nline2')
  })
})

describe('parseCSV', () => {
  it('parses a basic CSV with Date, Category, Amount', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,Groceries,-50.00\n2025-01-20,Salary,3000'
    const txns = parseCSV(csv)
    expect(txns).toHaveLength(2)
    expect(txns[0]).toEqual({
      date: '2025-01-15',
      category: 'Groceries',
      amount: -50,
      description: undefined,
    })
    expect(txns[1].amount).toBe(3000)
  })

  it('parses amounts with dollar signs and commas', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,Rent,"$1,500.00"'
    const txns = parseCSV(csv)
    expect(txns[0].amount).toBe(1500)
  })

  it('parses parenthesized amounts as negative', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,Expense,"(250.00)"'
    const txns = parseCSV(csv)
    expect(txns[0].amount).toBe(-250)
  })

  it('handles Description column', () => {
    const csv = 'Date,Category,Amount,Description\n2025-01-15,Food,-25,Lunch'
    const txns = parseCSV(csv)
    expect(txns[0].description).toBe('Lunch')
  })

  it('normalizes MM/DD/YYYY dates to YYYY-MM-DD', () => {
    const csv = 'Date,Category,Amount\n01/15/2025,Food,-10'
    const txns = parseCSV(csv)
    expect(txns[0].date).toBe('2025-01-15')
  })

  it('skips rows with missing required fields', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,,100\n2025-01-16,Valid,200'
    const txns = parseCSV(csv)
    expect(txns).toHaveLength(1)
    expect(txns[0].category).toBe('Valid')
  })

  it('skips rows with unparseable amounts', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,Food,abc\n2025-01-16,Food,100'
    const txns = parseCSV(csv)
    expect(txns).toHaveLength(1)
  })

  it('throws when required headers are missing', () => {
    const csv = 'Name,Value\nfoo,100'
    expect(() => parseCSV(csv)).toThrow('CSV must have headers')
  })

  it('returns empty for CSV with only headers', () => {
    const csv = 'Date,Category,Amount'
    expect(parseCSV(csv)).toEqual([])
  })

  it('returns empty for empty input', () => {
    expect(parseCSV('')).toEqual([])
  })
})

describe('monthKeyFromDate', () => {
  it('extracts YYYY-MM from a date string', () => {
    expect(monthKeyFromDate('2025-06-15')).toBe('2025-06')
  })
})

describe('formatMonthKey', () => {
  it('formats "2025-01" as "Jan 2025"', () => {
    expect(formatMonthKey('2025-01')).toBe('Jan 2025')
  })

  it('formats "2024-12" as "Dec 2024"', () => {
    expect(formatMonthKey('2024-12')).toBe('Dec 2024')
  })
})

describe('shortMonthName', () => {
  it('returns correct month for index 0', () => {
    expect(shortMonthName(0)).toBe('Jan')
  })

  it('returns correct month for index 11', () => {
    expect(shortMonthName(11)).toBe('Dec')
  })

  it('returns correct month for mid-year', () => {
    expect(shortMonthName(6)).toBe('Jul')
  })
})
