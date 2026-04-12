import { Account, BalanceEntry } from './types'

const escapeCell = (val: string): string =>
  val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val

export const exportCsv = (accounts: Account[], balances: BalanceEntry[]): void => {
  const allMonths = [...new Set(balances.map(b => b.month))].sort((a, b) => a.localeCompare(b))
  if (accounts.length === 0 || allMonths.length === 0) return

  // Row 1: institutions (blank in col 0)
  const institutionRow = ['', ...accounts.map(a => escapeCell(a.institution || ''))]
  // Row 2: account names
  const accountRow = ['', ...accounts.map(a => escapeCell(a.name))]

  const balanceMap = new Map<string, number>()
  for (const b of balances) balanceMap.set(`${b.accountId}:${b.month}`, b.balance)

  // Data rows: month, then each account balance
  const dataRows = allMonths.map(month => {
    const cells = [month, ...accounts.map(a => {
      const val = balanceMap.get(`${a.id}:${month}`)
      return val !== undefined ? String(val) : ''
    })]
    return cells.join(',')
  })

  const csv = [institutionRow.join(','), accountRow.join(','), ...dataRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance-data-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
