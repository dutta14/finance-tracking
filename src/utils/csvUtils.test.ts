import { describe, it, expect } from 'vitest'
import { parseCSV, serializeCSV } from './csvUtils'

describe('parseCSV', () => {
  it('returns an empty matrix for empty input', () => {
    expect(parseCSV('')).toEqual([])
  })

  it('parses a simple header and row', () => {
    expect(parseCSV('month,accountId,balance\n2024-01,1,100')).toEqual([
      ['month', 'accountId', 'balance'],
      ['2024-01', '1', '100'],
    ])
  })

  it('parses quoted fields containing commas', () => {
    expect(parseCSV('a,"b,c",d')).toEqual([['a', 'b,c', 'd']])
  })

  it('parses quoted fields containing newlines', () => {
    expect(parseCSV('a,"line1\nline2",c')).toEqual([['a', 'line1\nline2', 'c']])
  })

  it('unescapes doubled quotes inside quoted fields', () => {
    expect(parseCSV('a,"say ""hi""",c')).toEqual([['a', 'say "hi"', 'c']])
  })

  it('treats CRLF as a record separator', () => {
    expect(parseCSV('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('ignores a trailing newline', () => {
    expect(parseCSV('a,b\n')).toEqual([['a', 'b']])
  })

  it('preserves empty trailing cells', () => {
    expect(parseCSV('a,,c')).toEqual([['a', '', 'c']])
  })
})

describe('serializeCSV', () => {
  it('joins plain cells with commas and newlines', () => {
    expect(
      serializeCSV([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a,b\nc,d')
  })

  it('quotes cells containing a comma', () => {
    expect(serializeCSV([['a', 'b,c']])).toBe('a,"b,c"')
  })

  it('quotes and escapes cells containing a quote', () => {
    expect(serializeCSV([['say "hi"']])).toBe('"say ""hi"""')
  })

  it('quotes cells containing a newline', () => {
    expect(serializeCSV([['line1\nline2']])).toBe('"line1\nline2"')
  })
})

describe('CSV round-trip', () => {
  it('survives quoting, commas, newlines and escaped quotes', () => {
    const rows = [
      ['month', 'note', 'balance'],
      ['2024-01', 'contains, comma', '100'],
      ['2024-02', 'contains "quotes"', '200'],
      ['2024-03', 'contains\nnewline', '300'],
      ['2024-04', '', '0'],
    ]
    expect(parseCSV(serializeCSV(rows))).toEqual(rows)
  })
})
