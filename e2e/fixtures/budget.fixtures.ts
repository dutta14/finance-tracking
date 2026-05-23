import { Page } from '@playwright/test'

/**
 * Seed data helpers for Budget Page E2E tests.
 *
 * When encryption is disabled (the default in these tests), appStorage reads
 * directly from localStorage. We seed plaintext JSON the same way demoMode.ts
 * does. The Budget page reads three keys:
 *   - budget-store   → { csvs, configs, years, categoryGroups? }
 *   - budget-config  → { version, years, categoryGroups }
 *   - budget-summary → { annualSavings, saveRate, monthsOfData }
 */

export const CURRENT_YEAR = new Date().getFullYear()

export interface MonthCSV {
  month: string
  csv: string
  uploadedAt: string
}

export interface CategoryGroup {
  id: string
  name: string
  categories: string[]
}

export interface BudgetStore {
  csvs: Record<string, MonthCSV>
  configs: Record<string, unknown>
  years: number[]
  categoryGroups?: CategoryGroup[]
}

export interface BudgetConfig {
  version: number
  years: number[]
  categoryGroups: CategoryGroup[]
}

export interface BudgetSummary {
  annualSavings: number
  saveRate: number
  monthsOfData: number
}

export const DEFAULT_GROUPS: CategoryGroup[] = [
  { id: 'others', name: 'Others', categories: [] },
  { id: 'removed', name: 'Remove from Budget', categories: [] },
]

export interface SeedOptions {
  store?: BudgetStore
  config?: BudgetConfig | null
  summary?: BudgetSummary | null
  darkMode?: boolean
}

/** Builds a single-month CSV with the standard 4-column format. */
export function buildCSV(rows: Array<{ date: string; category: string; amount: number; description?: string }>): string {
  const header = 'Date,Category,Amount,Description'
  const body = rows
    .map(r => {
      const desc = r.description ?? ''
      const safeDesc = /[,"\n]/.test(desc) ? `"${desc.replace(/"/g, '""')}"` : desc
      return `${r.date},${r.category},${r.amount},${safeDesc}`
    })
    .join('\n')
  return `${header}\n${body}`
}

/** Build a MonthCSV entry. */
export function monthCSV(monthKey: string, csv: string): MonthCSV {
  return { month: monthKey, csv, uploadedAt: `${monthKey}-15T00:00:00.000Z` }
}

/**
 * Known dataset: income $10,000, expenses $7,000, save rate 30%.
 * Single month (CURRENT_YEAR-05). Categories: Salary, Groceries, Rent.
 */
export function knownBudgetStore(year = CURRENT_YEAR): BudgetStore {
  const month = `${year}-05`
  const csv = buildCSV([
    { date: `${year}-05-01`, category: 'Salary', amount: 10000, description: 'Monthly paycheck' },
    { date: `${year}-05-02`, category: 'Groceries', amount: -2000, description: 'Whole Foods' },
    { date: `${year}-05-03`, category: 'Rent', amount: -5000, description: 'Apartment' },
  ])
  return {
    csvs: { [month]: monthCSV(month, csv) },
    configs: {},
    years: [year],
    categoryGroups: [
      { id: 'fixed', name: 'Fixed', categories: ['Rent'] },
      { id: 'food', name: 'Food', categories: ['Groceries'] },
      { id: 'others', name: 'Others', categories: ['Salary'] },
      { id: 'removed', name: 'Remove from Budget', categories: [] },
    ],
  }
}

/** Multi-month store for January, February, March of CURRENT_YEAR. */
export function multiMonthStore(year = CURRENT_YEAR): BudgetStore {
  const jan = `${year}-01`
  const feb = `${year}-02`
  const mar = `${year}-03`
  return {
    csvs: {
      [jan]: monthCSV(
        jan,
        buildCSV([
          { date: `${year}-01-01`, category: 'Salary', amount: 8000 },
          { date: `${year}-01-05`, category: 'Groceries', amount: -300 },
          { date: `${year}-01-15`, category: 'Utilities', amount: -150 },
        ]),
      ),
      [feb]: monthCSV(
        feb,
        buildCSV([
          { date: `${year}-02-01`, category: 'Salary', amount: 8000 },
          { date: `${year}-02-05`, category: 'Groceries', amount: -350 },
          { date: `${year}-02-15`, category: 'Utilities', amount: -160 },
        ]),
      ),
      [mar]: monthCSV(
        mar,
        buildCSV([
          { date: `${year}-03-01`, category: 'Salary', amount: 8000 },
          { date: `${year}-03-05`, category: 'Groceries', amount: -400 },
          { date: `${year}-03-15`, category: 'Utilities', amount: -170 },
        ]),
      ),
    },
    configs: {},
    years: [year],
    categoryGroups: [
      { id: 'household', name: 'Household', categories: ['Utilities', 'Groceries'] },
      { id: 'others', name: 'Others', categories: ['Salary'] },
      { id: 'removed', name: 'Remove from Budget', categories: [] },
    ],
  }
}

/** Multi-year store: data for two years (year-1 and year). */
export function multiYearStore(year = CURRENT_YEAR): BudgetStore {
  const lastYear = year - 1
  const lastMonth = `${lastYear}-06`
  const thisMonth = `${year}-06`
  return {
    csvs: {
      [lastMonth]: monthCSV(
        lastMonth,
        buildCSV([
          { date: `${lastYear}-06-01`, category: 'Salary', amount: 7500 },
          { date: `${lastYear}-06-10`, category: 'Rent', amount: -2000 },
        ]),
      ),
      [thisMonth]: monthCSV(
        thisMonth,
        buildCSV([
          { date: `${year}-06-01`, category: 'Salary', amount: 8500 },
          { date: `${year}-06-10`, category: 'Rent', amount: -2100 },
        ]),
      ),
    },
    configs: {},
    years: [lastYear, year],
    categoryGroups: [
      { id: 'fixed', name: 'Fixed', categories: ['Rent'] },
      { id: 'others', name: 'Others', categories: ['Salary'] },
      { id: 'removed', name: 'Remove from Budget', categories: [] },
    ],
  }
}

/** Twelve-month store: every month of CURRENT_YEAR has data. */
export function fullYearStore(year = CURRENT_YEAR): BudgetStore {
  const csvs: Record<string, MonthCSV> = {}
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')
    const key = `${year}-${mm}`
    csvs[key] = monthCSV(
      key,
      buildCSV([
        { date: `${year}-${mm}-01`, category: 'Salary', amount: 8000 },
        { date: `${year}-${mm}-05`, category: 'Groceries', amount: -300 },
        { date: `${year}-${mm}-15`, category: 'Rent', amount: -2000 },
      ]),
    )
  }
  return {
    csvs,
    configs: {},
    years: [year],
    categoryGroups: [
      { id: 'fixed', name: 'Fixed', categories: ['Rent'] },
      { id: 'food', name: 'Food', categories: ['Groceries'] },
      { id: 'others', name: 'Others', categories: ['Salary'] },
      { id: 'removed', name: 'Remove from Budget', categories: [] },
    ],
  }
}

/** Store with $0 income and some expenses, to test save-rate edge case. */
export function zeroIncomeStore(year = CURRENT_YEAR): BudgetStore {
  const month = `${year}-05`
  return {
    csvs: {
      [month]: monthCSV(
        month,
        buildCSV([
          { date: `${year}-05-02`, category: 'Groceries', amount: -200 },
          { date: `${year}-05-03`, category: 'Rent', amount: -1000 },
        ]),
      ),
    },
    configs: {},
    years: [year],
    categoryGroups: [
      { id: 'others', name: 'Others', categories: ['Groceries', 'Rent'] },
      { id: 'removed', name: 'Remove from Budget', categories: [] },
    ],
  }
}

/** Build a config matching a store. */
export function configFromStore(store: BudgetStore): BudgetConfig {
  return {
    version: 1,
    years: store.years,
    categoryGroups: store.categoryGroups ?? DEFAULT_GROUPS,
  }
}

/**
 * Seeds localStorage with budget test data. Persists across reloads because
 * addInitScript re-runs on every navigation.
 */
export async function seedBudget(page: Page, options: SeedOptions = {}) {
  const { store, config, summary, darkMode } = options

  await page.addInitScript(
    ({ store, config, summary, darkMode }) => {
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')

      if (store) localStorage.setItem('budget-store', JSON.stringify(store))
      if (config) localStorage.setItem('budget-config', JSON.stringify(config))
      if (summary) localStorage.setItem('budget-summary', JSON.stringify(summary))
      if (darkMode !== undefined) {
        localStorage.setItem('darkMode', darkMode ? '1' : '0')
      }
    },
    { store, config, summary, darkMode },
  )
}

/** Seed empty state. */
export async function seedEmptyBudget(page: Page) {
  await seedBudget(page)
}

/** Seed the known $10K/$7K dataset including matching config and summary. */
export async function seedKnownBudget(page: Page, year = CURRENT_YEAR) {
  const store = knownBudgetStore(year)
  await seedBudget(page, {
    store,
    config: configFromStore(store),
    summary: { annualSavings: 36000, saveRate: 0.3, monthsOfData: 1 },
  })
}

/** Seed three months of data (Jan, Feb, Mar) for the current year. */
export async function seedMultiMonthBudget(page: Page, year = CURRENT_YEAR) {
  const store = multiMonthStore(year)
  await seedBudget(page, { store, config: configFromStore(store) })
}

/** Seed two years of data. */
export async function seedMultiYearBudget(page: Page, year = CURRENT_YEAR) {
  const store = multiYearStore(year)
  await seedBudget(page, { store, config: configFromStore(store) })
}

/** Seed twelve months for time-period aggregation tests. */
export async function seedFullYearBudget(page: Page, year = CURRENT_YEAR) {
  const store = fullYearStore(year)
  await seedBudget(page, { store, config: configFromStore(store) })
}

/** Seed zero-income expense-only data. */
export async function seedZeroIncomeBudget(page: Page, year = CURRENT_YEAR) {
  const store = zeroIncomeStore(year)
  await seedBudget(page, { store, config: configFromStore(store) })
}

/** Helper to build a CSV file payload for Playwright's setInputFiles. */
export function csvFile(name: string, csv: string) {
  return { name, mimeType: 'text/csv', buffer: Buffer.from(csv) }
}

/** Build a large CSV with N rows (for performance testing). */
export function largeCSV(rowCount: number, monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const rows: Array<{ date: string; category: string; amount: number; description?: string }> = []
  const cats = ['Groceries', 'Gas', 'Dining', 'Shopping', 'Utilities']
  for (let i = 0; i < rowCount; i++) {
    const day = String((i % 28) + 1).padStart(2, '0')
    const cat = cats[i % cats.length]
    rows.push({
      date: `${year}-${month}-${day}`,
      category: cat,
      amount: -((i % 100) + 1),
      description: `Row ${i + 1}`,
    })
  }
  rows.unshift({ date: `${year}-${month}-01`, category: 'Salary', amount: 10000, description: 'Paycheck' })
  return buildCSV(rows)
}
