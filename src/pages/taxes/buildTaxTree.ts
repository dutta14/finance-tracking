import type { DriveFolder, DriveFile } from '../drive/types'
import type { TaxStore, TaxChecklistItem } from './types'
import type { Account } from '../data/types'

function loadTaxStore(): TaxStore {
  try {
    return JSON.parse(localStorage.getItem('tax-store') || '{}')
  } catch { return { years: {} } }
}

function loadAccounts(): Account[] {
  try {
    return JSON.parse(localStorage.getItem('data-accounts') || '[]')
  } catch { return [] }
}

function ownerLabel(owner: string): string {
  try {
    const profile = JSON.parse(localStorage.getItem('user-profile') || '{}')
    if (owner === 'primary') return profile.name || 'Primary'
    if (owner === 'partner') return profile.partner?.name || 'Partner'
    return 'Joint'
  } catch { return owner }
}

function categoryLabel(cat: string): string | undefined {
  if (cat === 'paystub') return 'Paystub'
  if (cat === 'tax-return') return 'Tax Return'
  return undefined
}

function itemFiles(item: TaxChecklistItem, accounts: Account[]): DriveFile[] {
  const acctNames = item.accountIds.length > 0
    ? item.accountIds.map(id => accounts.find(a => a.id === id)?.name).filter(Boolean).join(', ')
    : undefined
  return item.files.map(f => ({
    name: f.name,
    slug: f.id,
    ext: f.ext,
    content: f.content,
    uploadedAt: f.uploadedAt,
    meta: {
      owner: ownerLabel(item.owner),
      accounts: acctNames,
      category: categoryLabel(item.category),
    },
  }))
}

export function buildTaxTree(): DriveFolder {
  const store = loadTaxStore()
  const accounts = loadAccounts()

  const yearFolders: DriveFolder[] = []
  for (const [yearStr, yearData] of Object.entries(store.years || {})) {
    const files: DriveFile[] = []
    for (const item of (yearData as { items: TaxChecklistItem[] }).items || []) {
      files.push(...itemFiles(item, accounts))
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
