/** PDF-to-CSV utility functions extracted for testability */

export interface TextItem {
  text: string
  x: number
  y: number
  width: number
  height: number
}

/** Detect column boundaries using centroid-based bucketing scaled to font size */
export function detectColumns(items: TextItem[]): number[] {
  if (items.length === 0) return []

  const avgHeight = items.reduce((s, i) => s + i.height, 0) / items.length
  const tolerance = Math.max(avgHeight * 1.5, 12)

  const xPositions = items.map(i => i.x).sort((a, b) => a - b)

  const buckets: { mean: number; count: number }[] = []
  for (const x of xPositions) {
    const match = buckets.find(b => Math.abs(x - b.mean) <= tolerance)
    if (match) {
      match.mean = (match.mean * match.count + x) / (match.count + 1)
      match.count++
    } else {
      buckets.push({ mean: x, count: 1 })
    }
  }

  return buckets.map(b => b.mean).sort((a, b) => a - b)
}

/** Group items into rows by Y proximity */
export function groupIntoRows(items: TextItem[], yTolerance = 3): TextItem[][] {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => {
    const dy = a.y - b.y
    if (Math.abs(dy) > yTolerance) return dy
    return a.x - b.x
  })

  const rows: TextItem[][] = []
  let currentRow: TextItem[] = [sorted[0]]
  let currentY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) <= yTolerance) {
      currentRow.push(sorted[i])
    } else {
      rows.push(currentRow)
      currentRow = [sorted[i]]
      currentY = sorted[i].y
    }
  }
  rows.push(currentRow)

  return rows.map(row => row.sort((a, b) => a.x - b.x))
}

/** Escape a CSV field (handles commas, quotes, newlines) */
export function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

/** Convert structured rows to CSV string */
export function rowsToCsv(rows: string[][]): string {
  return rows.map(row => row.map(escapeCsvField).join(',')).join('\n')
}

/** Merge cell texts into structured columns */
export function structureRows(items: TextItem[], yTolerance = 3): string[][] {
  if (items.length === 0) return []
  const columns = detectColumns(items)
  const rows = groupIntoRows(items, yTolerance)

  return rows.map(rowItems => {
    const structured: string[] = new Array(columns.length).fill('')
    for (const item of rowItems) {
      let colIdx = 0
      for (let i = columns.length - 1; i >= 0; i--) {
        if (item.x >= columns[i] - 5) {
          colIdx = i
          break
        }
      }
      const text = item.text.trim()
      if (text) {
        structured[colIdx] = structured[colIdx] ? structured[colIdx] + ' ' + text : text
      }
    }
    return structured
  })
}

/** Parse debit/credit merge number */
export function parseDebitCreditNum(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1')
  return parseFloat(cleaned) || 0
}

/** Merge debit and credit columns into a single Amount column */
export function mergeDebitCredit(rows: string[][]): string[][] | null {
  if (rows.length === 0) return null
  const headers = rows[0]
  const debitIdx = headers.findIndex(h => /^debits?$/i.test(h.trim()))
  const creditIdx = headers.findIndex(h => /^credits?$/i.test(h.trim()))

  if (debitIdx < 0 || creditIdx < 0 || debitIdx === creditIdx) return null

  const keepIdx = Math.min(debitIdx, creditIdx)
  const dropIdx = Math.max(debitIdx, creditIdx)

  return rows.map((row, ri) => {
    if (ri === 0) {
      const next = row.map((c, i) => (i === keepIdx ? 'Amount' : c))
      return next.filter((_, i) => i !== dropIdx)
    }
    const debitRaw = row[debitIdx].trim()
    const creditRaw = row[creditIdx].trim()
    let amount = ''
    if (debitRaw && parseDebitCreditNum(debitRaw) !== 0) {
      const n = parseDebitCreditNum(debitRaw)
      amount = '-$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } else if (creditRaw && parseDebitCreditNum(creditRaw) !== 0) {
      const n = parseDebitCreditNum(creditRaw)
      amount = '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    const next = row.map((c, i) => (i === keepIdx ? amount : c))
    return next.filter((_, i) => i !== dropIdx)
  })
}
