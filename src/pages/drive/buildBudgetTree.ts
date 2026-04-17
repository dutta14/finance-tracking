import { loadBudgetStore } from '../budget/utils/budgetStorage'
import { formatMonthKey } from '../budget/utils/csvParser'
import type { FileEntry, YearFolder } from './types'

export function buildBudgetTree(): YearFolder[] {
  const store = loadBudgetStore()
  const byYear = new Map<number, FileEntry[]>()
  for (const [key, m] of Object.entries(store.csvs)) {
    const yr = parseInt(key.split('-')[0], 10)
    if (!byYear.has(yr)) byYear.set(yr, [])
    byYear.get(yr)!.push({
      monthKey: key,
      label: formatMonthKey(key),
      csv: m.csv,
      uploadedAt: m.uploadedAt,
    })
  }
  const folders: YearFolder[] = []
  for (const [year, files] of byYear) {
    files.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    folders.push({ year, files })
  }
  folders.sort((a, b) => b.year - a.year)
  return folders
}
