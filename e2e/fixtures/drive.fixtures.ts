import { Page } from '@playwright/test'

/**
 * Seed data helpers for Drive Page E2E tests.
 *
 * Drive reads from two stores:
 *   - budget-store → produces the "Budget" subtree (year folders / month files)
 *   - tax-store    → produces the "Taxes" subtree (year folders / file blobs)
 *     plus user-profile (for owner labels) and data-accounts (for account tags)
 *
 * All tests run with encryption disabled (the default in seed). Tests that
 * exercise filename → monthKey parsing (drag-drop, upload button) must use
 * filenames containing YYYY-MM since useDriveUpload routes through
 * monthKeyFromFilename.
 */

export const FIXTURE_YEAR = 2024

// ── Budget CSV builders ─────────────────────────────────────────────

export interface MonthCSV {
  month: string
  csv: string
  uploadedAt: string
}

export interface BudgetStore {
  csvs: Record<string, MonthCSV>
  configs: Record<string, unknown>
  years: number[]
}

interface CsvRow {
  date: string
  category: string
  amount: number
  description?: string
}

export function buildCSV(rows: CsvRow[]): string {
  const header = 'Date,Category,Amount,Description'
  const body = rows.map(r => `${r.date},${r.category},${r.amount},${r.description ?? ''}`).join('\n')
  return `${header}\n${body}`
}

export function monthCSV(monthKey: string, csv: string, uploadedAt?: string): MonthCSV {
  return { month: monthKey, csv, uploadedAt: uploadedAt ?? `${monthKey}-15T00:00:00.000Z` }
}

// ── Known datasets for assertions ───────────────────────────────────

// Jan 2024 — used by test 4 (CSV preview) so the rendered table is deterministic.
export const JAN_2024_ROWS: CsvRow[] = [
  { date: '2024-01-01', category: 'Salary', amount: 8000, description: 'Paycheck' },
  { date: '2024-01-05', category: 'Groceries', amount: -300, description: 'Whole Foods' },
  { date: '2024-01-15', category: 'Utilities', amount: -150, description: 'Electric' },
]
export const JAN_2024_CSV = buildCSV(JAN_2024_ROWS)

export const FEB_2024_CSV = buildCSV([
  { date: '2024-02-01', category: 'Salary', amount: 8000 },
  { date: '2024-02-05', category: 'Groceries', amount: -320 },
])

export const MAR_2024_CSV = buildCSV([
  { date: '2024-03-01', category: 'Salary', amount: 8000 },
  { date: '2024-03-05', category: 'Groceries', amount: -340 },
])

export function multiMonth2024Store(): BudgetStore {
  return {
    csvs: {
      '2024-01': monthCSV('2024-01', JAN_2024_CSV),
      '2024-02': monthCSV('2024-02', FEB_2024_CSV),
      '2024-03': monthCSV('2024-03', MAR_2024_CSV),
    },
    configs: {},
    years: [2024],
  }
}

// ── Upload payloads (NOT seeded — uploaded by tests 5 / 6) ──────────

export const APR_2024_ROWS: CsvRow[] = [
  { date: '2024-04-01', category: 'Salary', amount: 8100, description: 'Paycheck' },
  { date: '2024-04-10', category: 'Groceries', amount: -425, description: 'Trader Joes' },
]
export const APR_2024_CSV = buildCSV(APR_2024_ROWS)
export const APR_2024_FILENAME = '2024-04.csv'

// ── Tax store (used only by test 8: sort needs files with meta.owner) ──

export interface TaxDocFile {
  id: string
  name: string
  ext: string
  content: string
  uploadedAt: string
}

export interface TaxChecklistItem {
  id: string
  label: string
  owner: 'primary' | 'partner' | 'joint'
  category: 'paystub' | 'account' | 'tax-return' | 'custom'
  accountIds: number[]
  files: TaxDocFile[]
}

export interface TaxStore {
  years: Record<number, { items: TaxChecklistItem[] }>
}

export interface ProfileShape {
  name: string
  partner?: { name: string }
}

/**
 * Sort fixture for test 8.
 *
 * Three files with intentionally orthogonal name / owner / uploadedAt
 * so each of the three sort modes produces a distinct ordering:
 *
 *   By name asc:     Alpha-Statement.pdf,  Mike-Report.pdf,  Zeta-Notes.pdf
 *   By owner asc:    Alex (primary),       Joint,            Sam (partner)
 *   By date desc:    2024-03-01 newest,    2024-02-01,       2024-01-01 oldest
 */
export const SORT_FILE_A: TaxDocFile = {
  id: 'file-a',
  name: 'Zeta-Notes.pdf',
  ext: 'pdf',
  content: 'A',
  uploadedAt: '2024-01-01T00:00:00.000Z',
}
export const SORT_FILE_B: TaxDocFile = {
  id: 'file-b',
  name: 'Alpha-Statement.pdf',
  ext: 'pdf',
  content: 'B',
  uploadedAt: '2024-03-01T00:00:00.000Z',
}
export const SORT_FILE_C: TaxDocFile = {
  id: 'file-c',
  name: 'Mike-Report.pdf',
  ext: 'pdf',
  content: 'C',
  uploadedAt: '2024-02-01T00:00:00.000Z',
}

export const SORT_PROFILE: ProfileShape = {
  name: 'Alex',
  partner: { name: 'Sam' },
}

export function sortTaxStore(): TaxStore {
  return {
    years: {
      [FIXTURE_YEAR]: {
        items: [
          {
            id: 'item-primary',
            label: 'W-2',
            owner: 'primary',
            category: 'custom',
            accountIds: [],
            files: [SORT_FILE_A],
          },
          {
            id: 'item-partner',
            label: 'W-2',
            owner: 'partner',
            category: 'custom',
            accountIds: [],
            files: [SORT_FILE_B],
          },
          {
            id: 'item-joint',
            label: '1099',
            owner: 'joint',
            category: 'custom',
            accountIds: [],
            files: [SORT_FILE_C],
          },
        ],
      },
    },
  }
}

// ── Seeders ────────────────────────────────────────────────────────

export interface SeedOptions {
  store?: BudgetStore | null
  taxStore?: TaxStore | null
  profile?: ProfileShape | null
}

export async function seedDrive(page: Page, options: SeedOptions = {}) {
  const { store, taxStore, profile } = options
  await page.addInitScript(
    ({ store, taxStore, profile }) => {
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')
      localStorage.setItem('onboarding-dismissed', '1')
      if (store) localStorage.setItem('budget-store', JSON.stringify(store))
      if (taxStore) localStorage.setItem('tax-store', JSON.stringify(taxStore))
      if (profile) localStorage.setItem('user-profile', JSON.stringify(profile))
    },
    { store: store ?? null, taxStore: taxStore ?? null, profile: profile ?? null },
  )
}

/** Seed three months (Jan/Feb/Mar 2024) of budget data. */
export async function seedDriveData(page: Page) {
  await seedDrive(page, { store: multiMonth2024Store() })
}

/**
 * Seed an empty Drive — no budget-store, no tax-store. addInitScript still
 * clears localStorage and writes encryption-enabled=0 so the page loads
 * deterministically. The "Budget" top-level folder is always present in the
 * tree (it is built unconditionally in buildBudgetTree), so the user's
 * empty state is observed at /drive/budget rather than at /drive.
 */
export async function seedDriveEmpty(page: Page) {
  await seedDrive(page)
}

/** Seed tax data with owner metadata for the sort test. */
export async function seedDriveWithOwners(page: Page) {
  await seedDrive(page, { taxStore: sortTaxStore(), profile: SORT_PROFILE })
}
