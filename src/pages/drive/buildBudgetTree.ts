import { loadBudgetStore } from '../budget/utils/budgetStorage'
import { formatMonthKey } from '../budget/utils/csvParser'
import { loadTaxStore } from '../taxes/types'
import { buildTaxTree } from '../taxes/buildTaxTree'
import type { FileStore } from '../../utils/fileStoreTypes'
import type { DriveFolder, DriveFile } from './types'
import type { Account } from '../data/types'

export async function buildDriveTree(
  fileStore: FileStore,
  accounts: Account[],
  profile: { name?: string; partner?: { name?: string } | null },
): Promise<DriveFolder> {
  const [store, taxStore] = await Promise.all([loadBudgetStore(fileStore), loadTaxStore(fileStore)])
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

  const topFolders: DriveFolder[] = []
  if (yearFolders.length > 0) {
    topFolders.push({
      name: 'Budget',
      slug: 'budget',
      folders: yearFolders,
      files: [],
    })
  }

  const taxFolder = buildTaxTree(taxStore, accounts, profile)
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
