import { Account, BalanceEntry } from './types'

const parseRow = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

const parseMonth = (raw: string): string => {
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}`

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{4})/)
  if (slashMatch) return `${slashMatch[2]}-${slashMatch[1].padStart(2, '0')}`

  const d = new Date(raw + ' 1')
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  return ''
}

export const parseCsvImport = (
  text: string,
  existingAccounts: Account[],
  existingBalances: BalanceEntry[],
): { accounts: Account[]; balances: BalanceEntry[] } => {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 3) return { accounts: existingAccounts, balances: existingBalances }

  const institutionRow = parseRow(lines[0])
  const accountRow = parseRow(lines[1])

  const columns: { institution: string; accountName: string }[] = []
  for (let c = 1; c < Math.max(institutionRow.length, accountRow.length); c++) {
    const inst = institutionRow[c] || ''
    const name = accountRow[c] || ''
    if (name) columns.push({ institution: inst, accountName: name })
  }

  if (columns.length === 0) return { accounts: existingAccounts, balances: existingBalances }

  let nextAccountId = existingAccounts.length > 0 ? Math.max(...existingAccounts.map(a => a.id)) + 1 : 1
  const newAccounts = [...existingAccounts]
  const columnAccountIds: number[] = []

  for (const col of columns) {
    const newAccount: Account = {
      id: nextAccountId++,
      name: col.accountName,
      type: 'retirement',
      owner: 'primary',
      status: 'active',
      goalType: 'fi',
      nature: 'asset',
      allocation: 'cash',
      institution: col.institution || undefined,
    }
    newAccounts.push(newAccount)
    columnAccountIds.push(newAccount.id)
  }

  let nextBalanceId = existingBalances.length > 0 ? Math.max(...existingBalances.map(b => b.id)) + 1 : 1
  const newBalances = [...existingBalances]

  for (let r = 2; r < lines.length; r++) {
    const row = parseRow(lines[r])
    const monthRaw = row[0]
    if (!monthRaw) continue

    const ym = parseMonth(monthRaw)
    if (!ym) continue

    for (let c = 0; c < columnAccountIds.length; c++) {
      const val = row[c + 1]
      if (!val || val.trim() === '') continue
      const balance = parseFloat(val.replace(/[$,]/g, ''))
      if (isNaN(balance)) continue

      const accountId = columnAccountIds[c]
      const existingEntry = newBalances.find(b => b.accountId === accountId && b.month === ym)
      if (existingEntry) {
        existingEntry.balance = balance
      } else {
        newBalances.push({ id: nextBalanceId++, accountId, month: ym, balance })
      }
    }
  }

  return { accounts: newAccounts, balances: newBalances }
}
