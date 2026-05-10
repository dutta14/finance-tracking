import { describe, it, expect } from 'vitest'
import {
  parseCSV,
  parseCSVLine,
  splitCSVRows,
  monthKeyFromDate,
  formatMonthKey,
  shortMonthName,
  buildMonthKey,
  getValidLineIndices,
  getCSVFormatHelp,
} from './csvParser'

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

describe('buildMonthKey', () => {
  it('builds key from year and 0-based month index', () => {
    expect(buildMonthKey(2025, 0)).toBe('2025-01')
  })

  it('pads single-digit months', () => {
    expect(buildMonthKey(2024, 4)).toBe('2024-05')
  })

  it('handles December (index 11)', () => {
    expect(buildMonthKey(2025, 11)).toBe('2025-12')
  })
})

describe('getCSVFormatHelp', () => {
  it('returns a string containing expected CSV format instructions', () => {
    const help = getCSVFormatHelp()
    expect(help).toContain('Date, Category, Amount')
    expect(help).toContain('positive for income')
    expect(help).toContain('Example')
  })
})

describe('getValidLineIndices', () => {
  it('returns indices of valid data rows (1-based, skipping header)', () => {
    const csv = 'Date,Category,Amount\n2025-01-01,Food,-50\n2025-01-02,Rent,-1000'
    const indices = getValidLineIndices(csv)
    expect(indices).toEqual([1, 2])
  })

  it('skips rows with missing fields', () => {
    const csv = 'Date,Category,Amount\n2025-01-01,,50\n2025-01-02,Valid,100'
    const indices = getValidLineIndices(csv)
    expect(indices).toEqual([2])
  })

  it('skips rows with unparseable amounts', () => {
    const csv = 'Date,Category,Amount\n2025-01-01,Food,abc\n2025-01-02,Food,100'
    const indices = getValidLineIndices(csv)
    expect(indices).toEqual([2])
  })

  it('skips rows with unparseable dates', () => {
    const csv = 'Date,Category,Amount\nnot-a-date,Food,100\n2025-01-02,Food,200'
    const indices = getValidLineIndices(csv)
    expect(indices).toEqual([2])
  })

  it('returns empty array for header-only CSV', () => {
    expect(getValidLineIndices('Date,Category,Amount')).toEqual([])
  })

  it('returns empty array when required headers are missing', () => {
    expect(getValidLineIndices('Name,Value\nfoo,100')).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(getValidLineIndices('')).toEqual([])
  })

  it('skips blank lines between data rows', () => {
    const csv = 'Date,Category,Amount\n2025-01-01,Food,-50\n\n2025-01-03,Rent,-1000'
    const indices = getValidLineIndices(csv)
    expect(indices).toEqual([1, 3])
  })
})

describe('parseCSV – additional edge cases', () => {
  it('recognizes "Merchant Name" as description column', () => {
    const csv = 'Date,Category,Amount,Merchant Name\n2025-01-15,Food,-25,Subway'
    const txns = parseCSV(csv)
    expect(txns[0].description).toBe('Subway')
  })

  it('recognizes "Original Statement" as description column', () => {
    const csv = 'Date,Category,Amount,Original Statement\n2025-01-15,Food,-25,POS PURCHASE'
    const txns = parseCSV(csv)
    expect(txns[0].description).toBe('POS PURCHASE')
  })

  it('recognizes "Notes" as description column', () => {
    const csv = 'Date,Category,Amount,Notes\n2025-01-15,Food,-25,Weekly groceries'
    const txns = parseCSV(csv)
    expect(txns[0].description).toBe('Weekly groceries')
  })

  it('recognizes "Note" as description column', () => {
    const csv = 'Date,Category,Amount,Note\n2025-01-15,Food,-25,Quick lunch'
    const txns = parseCSV(csv)
    expect(txns[0].description).toBe('Quick lunch')
  })

  it('handles DD/MM/YYYY dates when day > 12', () => {
    const csv = 'Date,Category,Amount\n25/01/2025,Food,-10'
    const txns = parseCSV(csv)
    expect(txns[0].date).toBe('2025-01-25')
  })

  it('parses euro currency symbol', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,Food,"€50.00"'
    const txns = parseCSV(csv)
    expect(txns[0].amount).toBe(50)
  })

  it('parses pound currency symbol', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,Food,"£1,200.00"'
    const txns = parseCSV(csv)
    expect(txns[0].amount).toBe(1200)
  })

  it('handles negative parenthesized amount with currency symbol', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,Expense,"($1,250.00)"'
    const txns = parseCSV(csv)
    expect(txns[0].amount).toBe(-1250)
  })

  it('handles negative sign with currency symbol', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,Food,"-$75.50"'
    const txns = parseCSV(csv)
    expect(txns[0].amount).toBe(-75.5)
  })

  it('handles YYYY/MM/DD date format', () => {
    const csv = 'Date,Category,Amount\n2025/03/15,Food,-10'
    const txns = parseCSV(csv)
    expect(txns[0].date).toBe('2025-03-15')
  })

  it('handles case-insensitive headers', () => {
    const csv = 'DATE,CATEGORY,AMOUNT\n2025-01-15,Food,-50'
    const txns = parseCSV(csv)
    expect(txns).toHaveLength(1)
    expect(txns[0].category).toBe('Food')
  })

  it('skips rows with missing date', () => {
    const csv = 'Date,Category,Amount\n,Food,100\n2025-01-16,Food,200'
    const txns = parseCSV(csv)
    expect(txns).toHaveLength(1)
    expect(txns[0].date).toBe('2025-01-16')
  })

  it('skips rows with missing amount', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,Food,\n2025-01-16,Food,200'
    const txns = parseCSV(csv)
    expect(txns).toHaveLength(1)
  })

  it('handles columns in non-standard order', () => {
    const csv = 'Amount,Date,Category\n-50,2025-06-01,Groceries'
    const txns = parseCSV(csv)
    expect(txns).toHaveLength(1)
    expect(txns[0]).toEqual({
      date: '2025-06-01',
      category: 'Groceries',
      amount: -50,
      description: undefined,
    })
  })

  it('handles extra columns beyond the recognized ones', () => {
    const csv = 'Date,Category,Amount,Description,ExtraCol\n2025-01-15,Food,-25,Lunch,ignored'
    const txns = parseCSV(csv)
    expect(txns[0].description).toBe('Lunch')
  })

  it('trims whitespace from field values', () => {
    const csv = 'Date,Category,Amount\n 2025-01-15 , Food , -50 '
    const txns = parseCSV(csv)
    expect(txns[0].date).toBe('2025-01-15')
    expect(txns[0].category).toBe('Food')
    expect(txns[0].amount).toBe(-50)
  })

  it('handles BOM marker at start of CSV', () => {
    const csv = '\uFEFFDate,Category,Amount\n2025-01-15,Groceries,-50.00'
    const result = parseCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('Groceries')
    expect(result[0].amount).toBe(-50)
  })
})

describe('parseCSVLine – additional edge cases', () => {
  it('handles a quote character mid-field (not at start) as literal', () => {
    expect(parseCSVLine('a,b"c,d')).toEqual(['a', 'b"c', 'd'])
  })

  it('handles trailing comma producing empty last field', () => {
    expect(parseCSVLine('a,b,')).toEqual(['a', 'b', ''])
  })

  it('handles multiple consecutive commas', () => {
    expect(parseCSVLine('a,,,b')).toEqual(['a', '', '', 'b'])
  })
})

describe('splitCSVRows – additional edge cases', () => {
  it('handles escaped quotes inside quoted fields across rows', () => {
    const csv = '"say ""hi""",b\nc,d'
    const rows = splitCSVRows(csv)
    expect(rows).toEqual(['"say ""hi""",b', 'c,d'])
  })

  it('handles empty input', () => {
    expect(splitCSVRows('')).toEqual([])
  })

  it('handles single row with no newline', () => {
    expect(splitCSVRows('a,b,c')).toEqual(['a,b,c'])
  })

  it('handles trailing newline', () => {
    expect(splitCSVRows('a\nb\n')).toEqual(['a', 'b'])
  })
})

describe('parseCSV – ambiguous date handling', () => {
  it('treats 01/06/2025 as MM/DD (Jan 6) since both parts ≤ 12, preferring US format', () => {
    const csv = 'Date,Category,Amount\n01/06/2025,Food,-50'
    const txns = parseCSV(csv)
    expect(txns[0].date).toBe('2025-01-06')
  })

  it('swaps to DD/MM when first part > 12 (e.g. 13/06/2025 → Jun 13)', () => {
    const csv = 'Date,Category,Amount\n13/06/2025,Food,-50'
    const txns = parseCSV(csv)
    expect(txns[0].date).toBe('2025-06-13')
  })
})

describe('getValidLineIndices count matches parseCSV count', () => {
  it('returns the same number of indices as parseCSV returns transactions', () => {
    const csv = 'Date,Category,Amount\n2025-01-01,Food,-50\n,,\n2025-01-03,Rent,-1000\nbad-date,X,10'
    const txns = parseCSV(csv)
    const indices = getValidLineIndices(csv)
    expect(indices).toHaveLength(txns.length)
  })
})
