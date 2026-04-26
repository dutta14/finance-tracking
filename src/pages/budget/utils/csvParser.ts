import { Transaction } from '../types'

/** Parse an amount string, handling $, commas, parentheses for negatives, and whitespace */
function parseAmount(raw: string): number | null {
  let s = raw.trim()
  // Handle parentheses as negative: (50.00) => -50.00
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1)
  }
  // Strip currency symbols, commas, whitespace
  s = s.replace(/[$€£¥,\s]/g, '')
  // Handle leading minus
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  }
  const num = parseFloat(s)
  if (isNaN(num)) return null
  return negative ? -num : num
}

/** Normalize a date string to yyyy-mm-dd. Handles MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc. */
function normalizeDate(raw: string): string | null {
  const s = raw.trim()

  // Try yyyy-mm-dd or yyyy/mm/dd first
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const date = new Date(+y, +m - 1, +d)
    if (!isNaN(date.getTime())) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Try mm/dd/yyyy or mm-dd-yyyy (assume US format: month <= 12)
  const usMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (usMatch) {
    const [, a, b, y] = usMatch
    // Prefer MM/DD/YYYY; if a > 12, swap to DD/MM/YYYY
    let m = +a,
      d = +b
    if (m > 12 && d <= 12) {
      m = +b
      d = +a
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = new Date(+y, m - 1, d)
      if (!isNaN(date.getTime())) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  // Fallback: try native Date parsing
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)

  return null
}

/**
 * Parse a CSV string into Transaction[].
 * Expected CSV format:
 *   Date,Category,Amount[,Description]
 *
 * - Date: any parseable date (yyyy-mm-dd recommended)
 * - Category: text string
 * - Amount: number (positive = income, negative = expense)
 * - Description (optional): text
 *
 * The first row must be a header row containing at least: Date, Category, Amount
 */
export function parseCSV(csvText: string): Transaction[] {
  const lines = splitCSVRows(csvText.trim())
  if (lines.length < 2) return []

  // Parse header
  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase())

  const dateIdx = headers.findIndex(h => h === 'date')
  const catIdx = headers.findIndex(h => h === 'category')
  const amtIdx = headers.findIndex(h => h === 'amount')
  const descIdx = headers.findIndex(
    h => h === 'description' || h === 'merchant name' || h === 'original statement' || h === 'notes' || h === 'note',
  )

  if (dateIdx === -1 || catIdx === -1 || amtIdx === -1) {
    throw new Error(
      'CSV must have headers: Date, Category, Amount. ' +
        'Optional: Description / Merchant Name / Original Statement. Found: ' +
        headers.join(', '),
    )
  }

  const transactions: Transaction[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = parseCSVLine(line)
    const dateStr = cols[dateIdx]?.trim()
    const category = cols[catIdx]?.trim()
    const amountStr = cols[amtIdx]?.trim()

    if (!dateStr || !category || !amountStr) continue

    const amount = parseAmount(amountStr)
    if (amount === null) continue

    // Normalize the date to yyyy-mm-dd
    const isoDate = normalizeDate(dateStr)
    if (!isoDate) continue

    transactions.push({
      date: isoDate,
      category,
      amount,
      description: descIdx !== -1 ? cols[descIdx]?.trim() : undefined,
    })
  }

  return transactions
}

/**
 * Returns an array mapping parsed-transaction index → raw CSV line index.
 * Replicates the exact skip logic of parseCSV so indices stay in sync.
 */
export function getValidLineIndices(csvText: string): number[] {
  const lines = splitCSVRows(csvText)
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
  const dateIdx = headers.findIndex(h => h === 'date')
  const catIdx = headers.findIndex(h => h === 'category')
  const amtIdx = headers.findIndex(h => h === 'amount')
  if (dateIdx === -1 || catIdx === -1 || amtIdx === -1) return []

  const indices: number[] = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cols = parseCSVLine(lines[i])
    const dateStr = cols[dateIdx]?.trim()
    const category = cols[catIdx]?.trim()
    const amountStr = cols[amtIdx]?.trim()
    if (!dateStr || !category || !amountStr) continue
    if (parseAmount(amountStr) === null) continue
    if (!normalizeDate(dateStr)) continue
    indices.push(i)
  }
  return indices
}

/** Parse a single CSV line, handling quoted fields and tolerating malformed quotes */
export function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"' && current === '') {
        // Only enter quote mode if quote is at start of field
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

/**
 * Split a CSV string into logical rows, respecting quoted fields that may
 * contain newlines. Returns the raw row strings (including quotes).
 */
export function splitCSVRows(csvText: string): string[] {
  const rows: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csvText.length && csvText[i + 1] === '"') {
          current += '""'
          i++
        } else {
          inQuotes = false
          current += ch
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        current += ch
      } else if (ch === '\n') {
        // Handle \r\n
        if (current.endsWith('\r')) current = current.slice(0, -1)
        rows.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  if (current) rows.push(current)
  return rows
}

/** Get month key from a date string: "2025-05" */
export function monthKeyFromDate(dateStr: string): string {
  return dateStr.slice(0, 7)
}

/** Get display name for a month key: "May 2025" */
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[parseInt(month, 10) - 1]} ${year}`
}

/** Get short month name from index (0-based) */
export function shortMonthName(monthIndex: number): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return names[monthIndex]
}

/** Build "yyyy-mm" key from year and month index (0-based) */
export function buildMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

/** Generate a CSV string from Text describing the expected format */
export function getCSVFormatHelp(): string {
  return (
    'Expected CSV format:\n' +
    '  Date, Category, Amount [, Description]\n\n' +
    'Rules:\n' +
    '  • Date: any parseable date (e.g. 2025-05-01, 05/01/2025, May 1 2025)\n' +
    '  • Category: text label for the transaction type\n' +
    '  • Amount: positive for income, negative for expenses (e.g. 5000 or -120.50)\n' +
    '  • Description: column named Description, Merchant Name, or Original Statement\n\n' +
    'Example:\n' +
    '  Date,Category,Amount,Description\n' +
    '  2025-05-01,Salary,5000,Monthly paycheck\n' +
    '  2025-05-02,Groceries,-85.50,Trader Joes\n' +
    '  2025-05-05,Rent,-2000,Monthly rent'
  )
}
