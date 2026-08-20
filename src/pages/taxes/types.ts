import type { FileStore } from '../../utils/fileStoreTypes'

export type TaxDocOwner = 'primary' | 'partner' | 'joint'

export type ChecklistCategory = 'paystub' | 'account' | 'tax-return' | 'custom'

export interface TaxDocFile {
  id: string
  name: string
  /** base64 data URL — undefined once the bytes live in `taxes/{year}/files/` */
  content: string | undefined
  /** File name inside `taxes/{year}/files/`, unique within the year */
  storedName?: string
  ext: string
  uploadedAt: string
}

export interface TaxChecklistItem {
  id: string
  label: string
  owner: TaxDocOwner
  category: ChecklistCategory
  accountIds: number[] // linked Data-page account IDs
  files: TaxDocFile[]
}

export interface TaxYear {
  items: TaxChecklistItem[]
}

export interface TaxStore {
  years: Record<number, TaxYear>
}

export const EMPTY_STORE: TaxStore = { years: {} }

export const getEmptyYear = (): TaxYear => ({ items: [] })

/* ── Templates ──────────────────────────────────────────────── */
export interface TaxTemplateItem {
  label: string
  owner: TaxDocOwner
  category: ChecklistCategory
}

export interface TaxTemplate {
  id: string
  name: string
  items: TaxTemplateItem[]
}

/* ── Storage paths ──────────────────────────────────────────── */

export const TAXES_DIR = 'taxes'
export const TEMPLATES_PATH = `${TAXES_DIR}/templates.json`

const YEAR_FILE = /^(\d{4})\.json$/

export const taxYearPath = (year: number | string): string => `${TAXES_DIR}/${year}.json`

export const taxFilesDir = (year: number | string): string => `${TAXES_DIR}/${year}/files`

export const taxFilePath = (year: number | string, fileName: string): string => `${taxFilesDir(year)}/${fileName}`

/** Lists the years that have a `taxes/{year}.json` file, newest first. */
export async function loadTaxYears(fileStore: FileStore): Promise<number[]> {
  const names = await fileStore.listFiles(TAXES_DIR)
  return names
    .map(name => YEAR_FILE.exec(name)?.[1])
    .filter((year): year is string => !!year)
    .map(Number)
    .sort((a, b) => b - a)
}

/** Reads a single `taxes/{year}.json`, normalizing malformed shapes. */
export async function loadTaxYear(fileStore: FileStore, year: number): Promise<TaxYear> {
  const data = await fileStore.readJSON<TaxYear | null>(taxYearPath(year), null)
  return data && typeof data === 'object' && Array.isArray(data.items) ? data : getEmptyYear()
}

/** Reads every year file into a single in-memory store. */
export async function loadTaxStore(fileStore: FileStore): Promise<TaxStore> {
  const years = await loadTaxYears(fileStore)
  const store: TaxStore = { years: {} }
  for (const year of years) {
    store.years[year] = await loadTaxYear(fileStore, year)
  }
  return store
}

export async function saveTaxYear(fileStore: FileStore, year: number, data: TaxYear): Promise<void> {
  await fileStore.writeJSON(taxYearPath(year), data)
}

/** Removes the year file plus every uploaded document belonging to it. */
export async function deleteTaxYear(fileStore: FileStore, year: number, data?: TaxYear): Promise<void> {
  const files = data ? data.items.flatMap(item => item.files) : []
  for (const file of files) {
    const stored = file.storedName || file.name
    await fileStore.delete(taxFilePath(year, stored))
  }
  await fileStore.delete(taxYearPath(year))
}

export async function loadTemplates(fileStore: FileStore): Promise<TaxTemplate[]> {
  const templates = await fileStore.readJSON<TaxTemplate[]>(TEMPLATES_PATH, [])
  return Array.isArray(templates) ? templates : []
}

export async function saveTemplates(fileStore: FileStore, templates: TaxTemplate[]): Promise<void> {
  await fileStore.writeJSON(TEMPLATES_PATH, templates)
}

/** Picks a name that does not collide with an existing document in the year. */
export async function uniqueTaxFileName(fileStore: FileStore, year: number, desired: string): Promise<string> {
  const existing = new Set(await fileStore.listFiles(taxFilesDir(year)))
  if (!existing.has(desired)) return desired

  const dot = desired.lastIndexOf('.')
  const base = dot > 0 ? desired.slice(0, dot) : desired
  const ext = dot > 0 ? desired.slice(dot) : ''
  let counter = 2
  while (existing.has(`${base} (${counter})${ext}`)) counter++
  return `${base} (${counter})${ext}`
}
