/**
 * Minimal RFC 4180 CSV reader/writer.
 *
 * Handles quoted fields, embedded commas, embedded newlines inside quoted
 * fields, and `""` escaping for literal quotes.
 */

/** Parses CSV text into a matrix of raw cell strings. */
export function parseCSV(text: string): string[][] {
  if (text === '') return []

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let sawAnyChar = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      sawAnyChar = true
      continue
    }

    if (char === ',') {
      row.push(field)
      field = ''
      sawAnyChar = true
      continue
    }

    if (char === '\r') {
      // Swallow CR; the following LF (if any) terminates the record.
      if (text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      sawAnyChar = false
      continue
    }

    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      sawAnyChar = false
      continue
    }

    field += char
    sawAnyChar = true
  }

  if (field !== '' || row.length > 0 || sawAnyChar) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

const needsQuoting = (value: string): boolean =>
  value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')

const escapeCell = (value: string): string => (needsQuoting(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** Serializes a matrix of cells back into RFC 4180 CSV text. */
export function serializeCSV(rows: string[][]): string {
  return rows.map(row => row.map(cell => escapeCell(cell ?? '')).join(',')).join('\n')
}
