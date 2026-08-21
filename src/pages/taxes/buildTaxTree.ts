import type { DriveFolder, DriveFile } from '../drive/types'
import type { TaxStore, TaxChecklistItem } from './types'
import type { Account } from '../data/types'

interface TaxTreeProfile {
  name?: string
  partner?: { name?: string } | null
}

function ownerLabel(owner: string, profile: TaxTreeProfile): string {
  if (owner === 'primary') return profile.name || 'Primary'
  if (owner === 'partner') return profile.partner?.name || 'Partner'
  return 'Joint'
}

function categoryLabel(cat: string): string | undefined {
  if (cat === 'paystub') return 'Paystub'
  if (cat === 'tax-return') return 'Tax Return'
  return undefined
}

function itemFiles(item: TaxChecklistItem, accounts: Account[], profile: TaxTreeProfile): DriveFile[] {
  const acctNames =
    item.accountIds.length > 0
      ? item.accountIds
          .map(id => accounts.find(a => a.id === id)?.name)
          .filter(Boolean)
          .join(', ')
      : undefined
  return item.files.map(f => ({
    name: f.name,
    slug: f.id,
    ext: f.ext,
    content: f.content ?? '',
    uploadedAt: f.uploadedAt,
    meta: {
      owner: ownerLabel(item.owner, profile),
      accounts: acctNames,
      category: categoryLabel(item.category),
    },
  }))
}

export function buildTaxTree(store: TaxStore, accounts: Account[], profile: TaxTreeProfile): DriveFolder {
  const yearFolders: DriveFolder[] = []
  for (const [yearStr, yearData] of Object.entries(store.years || {})) {
    const files: DriveFile[] = []
    for (const item of (yearData as { items: TaxChecklistItem[] }).items || []) {
      files.push(...itemFiles(item, accounts, profile))
    }
    if (files.length > 0) {
      yearFolders.push({ name: yearStr, slug: yearStr, folders: [], files })
    }
  }

  yearFolders.sort((a, b) => b.slug.localeCompare(a.slug))

  return {
    name: 'Taxes',
    slug: 'taxes',
    folders: yearFolders,
    files: [],
  }
}
