import { loadBudgetStore } from '../budget/utils/budgetStorage'
import { formatMonthKey } from '../budget/utils/csvParser'
import { buildTaxTree } from '../taxes/buildTaxTree'
import type { DriveFolder, DriveFile } from './types'

export function buildDriveTree(): DriveFolder {
  const store = loadBudgetStore()
  const byYear = new Map<number, DriveFile[]>()

  for (const [key, m] of Object.entries(store.csvs)) {
    const yr = parseInt(key.split('-')[0], 10)
    if (!byYear.has(yr)) byYear.set(yr, [])
    byYear.get(yr)!.push({
      name: formatMonthKey(key),
      slug: key,
      ext: 'csv',
      content: m.csv,
      uploadedAt: m.uploadedAt,
    })
  }

  const yearFolders: DriveFolder[] = []
  for (const [year, files] of byYear) {
    files.sort((a, b) => a.slug.localeCompare(b.slug))
    yearFolders.push({ name: String(year), slug: String(year), folders: [], files })
  }
  yearFolders.sort((a, b) => b.slug.localeCompare(a.slug))

  const budgetFolder: DriveFolder = {
    name: 'Budget',
    slug: 'budget',
    folders: yearFolders,
    files: [],
  }

  const taxFolder = buildTaxTree()
  const topFolders: DriveFolder[] = [budgetFolder]
  if (taxFolder.folders.length > 0 || taxFolder.files.length > 0) {
    topFolders.push(taxFolder)
  }

  return {
    name: 'Drive',
    slug: '',
    folders: topFolders,
    files: [],
  }
}
