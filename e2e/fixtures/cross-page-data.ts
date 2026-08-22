import type { Page } from '@playwright/test'
import { balanceEntriesToEntries, budgetCsvsToEntries, goalsToEntry, seedFileStore, taxStoreToEntries } from './seed-filestore'

/**
 * Shared seed for the cross-page integration suites (#151 + future
 * 62b/c/d → #152/#153/#154). Centralizes the "all 13 sensitive keys"
 * baseline so each spec can layer overrides on top without re-declaring
 * 100 lines of localStorage seeding. The feature-flags mock is handled
 * globally by the base fixture (`e2e/fixtures/base.ts`).
 */

export interface CrossPageSeed {
  accounts: unknown[]
  balances: unknown[]
  goals: unknown[]
  gwGoals: unknown[]
  profile: { name: string; birthday: string; avatarDataUrl: string }
  budgetSummary: { annualSavings: number; saveRate: number; monthsOfData: number } | null
  budgetStore: unknown
  budgetConfig: unknown
  allocationCustomRatios: unknown[]
  fiSimulations: unknown[]
  sgtOverrides: unknown
  taxStore: unknown
  taxTemplates: unknown[]
}

export const CROSS_PAGE_PROFILE = {
  name: 'Casey',
  birthday: '1990-06-15',
  avatarDataUrl: '',
}

export const CROSS_PAGE_ACCOUNTS = [
  {
    id: 1,
    name: '401k',
    type: 'retirement',
    owner: 'primary',
    status: 'active',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'us-stock',
  },
  {
    id: 2,
    name: 'Savings',
    type: 'liquid',
    owner: 'primary',
    status: 'active',
    goalType: 'gw',
    nature: 'asset',
    allocation: 'cash',
  },
]

export const CROSS_PAGE_BALANCES = [
  { id: 1, accountId: 1, month: '2025-03', balance: 250000 },
  { id: 2, accountId: 1, month: '2025-04', balance: 260000 },
  { id: 3, accountId: 2, month: '2025-03', balance: 50000 },
  { id: 4, accountId: 2, month: '2025-04', balance: 55000 },
]

export const CROSS_PAGE_GOAL = {
  id: 1,
  goalName: 'Early Retirement',
  fiGoal: 2_000_000,
  retirementAge: 55,
  goalCreatedIn: '2024-01-01',
  goalEndYear: '2060-01-01',
  expenseValue: 60_000,
  monthlyExpenseValue: 5_000,
  expenseValue2047: 96_000,
  monthlyExpense2047: 8_000,
  safeWithdrawalRate: 4,
  growth: 6,
  birthday: '',
}

export const CROSS_PAGE_BUDGET_SUMMARY = {
  annualSavings: 40_000,
  saveRate: 35,
  monthsOfData: 3,
}

/**
 * Minimal budget-store shape. GoalsPeek consumes `budget-summary` (read
 * by `getBudgetSaveRate`) — it does NOT re-parse the CSVs. The store
 * here exists so import/export round-trips and budget-page renders
 * don't crash. Three months of CSV-like entries satisfy the spec's
 * "at least 3 months" prereq without recomputing the summary on mount.
 */
export const CROSS_PAGE_BUDGET_STORE = {
  csvs: {
    '2024-10': {
      month: '2024-10',
      csv: 'Date,Category,Amount\n2024-10-01,Salary,8500\n2024-10-05,Rent,-2000',
      uploadedAt: '2024-10-15T00:00:00.000Z',
    },
    '2024-11': {
      month: '2024-11',
      csv: 'Date,Category,Amount\n2024-11-01,Salary,8500\n2024-11-05,Rent,-2000',
      uploadedAt: '2024-11-15T00:00:00.000Z',
    },
    '2024-12': {
      month: '2024-12',
      csv: 'Date,Category,Amount\n2024-12-01,Salary,8500\n2024-12-05,Rent,-2000',
      uploadedAt: '2024-12-15T00:00:00.000Z',
    },
  },
  configs: {},
  years: [2024],
  categoryGroups: [
    { id: 'others', name: 'Others', categories: [] },
    { id: 'removed', name: 'Remove from Budget', categories: [] },
  ],
}

export const CROSS_PAGE_BUDGET_CONFIG = {
  version: 1,
  years: [2024],
  categoryGroups: [
    { id: 'others', name: 'Others', categories: [] },
    { id: 'removed', name: 'Remove from Budget', categories: [] },
  ],
}

export const CROSS_PAGE_SEED: CrossPageSeed = {
  accounts: CROSS_PAGE_ACCOUNTS,
  balances: CROSS_PAGE_BALANCES,
  goals: [CROSS_PAGE_GOAL],
  gwGoals: [],
  profile: CROSS_PAGE_PROFILE,
  budgetSummary: CROSS_PAGE_BUDGET_SUMMARY,
  budgetStore: CROSS_PAGE_BUDGET_STORE,
  budgetConfig: CROSS_PAGE_BUDGET_CONFIG,
  allocationCustomRatios: [],
  fiSimulations: [],
  sgtOverrides: {},
  // #154: TaxStore must contain `years` (see src/pages/taxes/types.ts:33,
  // `EMPTY_STORE = { years: {} }`). A bare `{}` makes Taxes.tsx throw on
  // mount (`Cannot read properties of undefined (reading ...)`), which
  // is fine for suites that never navigate to /taxes, but #154 sweeps
  // all six pages after import. Seeding `{ years: {} }` matches the
  // production empty-state shape exactly.
  taxStore: { years: {} },
  taxTemplates: [],
}

/**
 * Per-key overrides. `null` for `budgetSummary` deletes the key (used
 * by the "missing budget" tests). Any field omitted falls back to the
 * default in `CROSS_PAGE_SEED`.
 */
export type SeedOverrides = Partial<{
  accounts: unknown[] | null
  balances: unknown[] | null
  goals: unknown[] | null
  gwGoals: unknown[] | null
  profile: typeof CROSS_PAGE_PROFILE | null
  budgetSummary: typeof CROSS_PAGE_BUDGET_SUMMARY | null
  budgetStore: unknown | null
  budgetConfig: unknown | null
  allocationCustomRatios: unknown[] | null
  fiSimulations: unknown[] | null
  sgtOverrides: unknown | null
  taxStore: unknown | null
  taxTemplates: unknown[] | null
}>

/**
 * Seed localStorage with the cross-page baseline.
 *
 * The feature-flags API mock is handled globally by the base fixture
 * (`e2e/fixtures/base.ts`).
 *
 * Pass `null` for any field to OMIT that key from localStorage
 * (e.g. `{ budgetSummary: null }` → no `budget-summary` key written).
 */
export async function seedCrossPage(page: Page, overrides: SeedOverrides = {}): Promise<void> {
  const resolved = {
    accounts: 'accounts' in overrides ? overrides.accounts : CROSS_PAGE_SEED.accounts,
    balances: 'balances' in overrides ? overrides.balances : CROSS_PAGE_SEED.balances,
    goals: 'goals' in overrides ? overrides.goals : CROSS_PAGE_SEED.goals,
    gwGoals: 'gwGoals' in overrides ? overrides.gwGoals : CROSS_PAGE_SEED.gwGoals,
    profile: 'profile' in overrides ? overrides.profile : CROSS_PAGE_SEED.profile,
    budgetSummary: 'budgetSummary' in overrides ? overrides.budgetSummary : CROSS_PAGE_SEED.budgetSummary,
    budgetStore: 'budgetStore' in overrides ? overrides.budgetStore : CROSS_PAGE_SEED.budgetStore,
    budgetConfig: 'budgetConfig' in overrides ? overrides.budgetConfig : CROSS_PAGE_SEED.budgetConfig,
    allocationCustomRatios:
      'allocationCustomRatios' in overrides ? overrides.allocationCustomRatios : CROSS_PAGE_SEED.allocationCustomRatios,
    fiSimulations: 'fiSimulations' in overrides ? overrides.fiSimulations : CROSS_PAGE_SEED.fiSimulations,
    sgtOverrides: 'sgtOverrides' in overrides ? overrides.sgtOverrides : CROSS_PAGE_SEED.sgtOverrides,
    taxStore: 'taxStore' in overrides ? overrides.taxStore : CROSS_PAGE_SEED.taxStore,
    taxTemplates: 'taxTemplates' in overrides ? overrides.taxTemplates : CROSS_PAGE_SEED.taxTemplates,
  }

  const entries = [] as Array<{ path: string; data: unknown; type: 'json' | 'csv' }>

  if (resolved.profile !== null && resolved.profile !== undefined) {
    entries.push({ path: 'profile.json', data: resolved.profile, type: 'json' })
  }
  if (resolved.accounts !== null && resolved.accounts !== undefined) {
    entries.push({ path: 'accounts.json', data: resolved.accounts, type: 'json' })
  }
  if (resolved.balances !== null && resolved.balances !== undefined) {
    entries.push(...balanceEntriesToEntries(resolved.balances as Array<{ month: string; accountId: number; balance: number }>))
  }
  if (resolved.goals !== null || resolved.gwGoals !== null) {
    entries.push(
      goalsToEntry(
        Array.isArray(resolved.goals) ? resolved.goals : [],
        Array.isArray(resolved.gwGoals) ? resolved.gwGoals : [],
      ),
    )
  }
  if (resolved.budgetSummary !== null && resolved.budgetSummary !== undefined) {
    entries.push({ path: 'budget/summary-cache.json', data: resolved.budgetSummary, type: 'json' })
  }
  if (resolved.budgetStore && typeof resolved.budgetStore === 'object') {
    const budgetStore = resolved.budgetStore as {
      csvs?: Record<string, { csv: string }>
      years?: number[]
      categoryGroups?: unknown[]
    }
    if (budgetStore.csvs) entries.push(...budgetCsvsToEntries(budgetStore.csvs))
    const categoriesData =
      resolved.budgetConfig && typeof resolved.budgetConfig === 'object'
        ? resolved.budgetConfig
        : {
            version: 1,
            years: budgetStore.years ?? [],
            categoryGroups: budgetStore.categoryGroups ?? [],
          }
    entries.push({ path: 'budget/categories.json', data: categoriesData, type: 'json' })
  } else if (resolved.budgetConfig && typeof resolved.budgetConfig === 'object') {
    entries.push({ path: 'budget/categories.json', data: resolved.budgetConfig, type: 'json' })
  }
  if (resolved.allocationCustomRatios !== null && resolved.allocationCustomRatios !== undefined) {
    entries.push({ path: 'allocation.json', data: resolved.allocationCustomRatios, type: 'json' })
  }
  if (resolved.fiSimulations !== null && resolved.fiSimulations !== undefined) {
    entries.push({ path: 'fi-simulations.json', data: resolved.fiSimulations, type: 'json' })
  }
  if (resolved.sgtOverrides !== null && resolved.sgtOverrides !== undefined) {
    entries.push({ path: 'savings-tracker-overrides.json', data: resolved.sgtOverrides, type: 'json' })
  }
  if (resolved.taxStore && typeof resolved.taxStore === 'object') {
    entries.push(...taxStoreToEntries(resolved.taxStore as Record<string, unknown>))
  }
  if (resolved.taxTemplates !== null && resolved.taxTemplates !== undefined) {
    entries.push({ path: 'taxes/templates.json', data: resolved.taxTemplates, type: 'json' })
  }

  await seedFileStore(page, entries, { onceKey: '__cross_page_filestore_seeded' })
  await page.addInitScript(() => {
    // One-shot sentinel: addInitScript runs on EVERY navigation/reload,
    // but tests that mutate or delete keys mid-session and then trigger
    // a route change (or rely on the in-app reload after import) must
    // not have their changes overwritten. The sentinel lets the first
    // navigation seed the baseline and every subsequent navigation skip.
    if (localStorage.getItem('__cross_page_seeded') === '1') return
    localStorage.clear()
    localStorage.setItem('_e2eMode', '1')
    localStorage.setItem('__cross_page_seeded', '1')
    localStorage.setItem('onboarding-dismissed', '1')
    localStorage.setItem('darkMode', '0')
  })
}

/**
 * Mutate a single balance row in-place via `page.evaluate`, then fire
 * `data-changed` so DataContext (which subscribes via
 * `window.addEventListener('data-changed', ...)`, see
 * DataContext.tsx:57) reloads accounts/balances without a page reload.
 *
 * If no row matches (accountId, month) a new row is appended with a
 * fresh id = max(existing) + 1.
 */
export async function mutateAccountBalance(
  page: Page,
  accountId: number,
  month: string,
  newBalance: number,
): Promise<void> {
  await page.evaluate(
    async ({ accountId, month, newBalance }) => {
      const e2eStore = (window as Window & typeof globalThis & { __e2eFileStore?: any }).__e2eFileStore
      if (!e2eStore) return
      const year = month.slice(0, 4)
      const path = `balances/${year}.csv`
      const rows = await e2eStore.readCSV(path)
      const nextRows = rows.length > 0 ? [...rows] : [['month', 'accountId', 'balance']]
      const idx = nextRows.findIndex((row: string[], index: number) => index > 0 && row[0] === month && row[1] === String(accountId))
      const nextRow = [month, String(accountId), String(newBalance)]
      if (idx >= 0) nextRows[idx] = nextRow
      else nextRows.push(nextRow)
      await e2eStore.writeCSV(path, nextRows)
      window.dispatchEvent(new Event('data-changed'))
    },
    { accountId, month, newBalance },
  )
}

/**
 * Build a minimal v2 export JSON (matching the 15 top-level keys
 * written by `handleExport` in src/contexts/ImportExportContext.tsx).
 * Used by the import-event test to exercise the full
 * file-pick → FileReader → data-changed → reload pipeline.
 */
export function buildV2Export(
  overrides: Partial<{
    goals: unknown[]
    gwGoals: unknown[]
    profile: typeof CROSS_PAGE_PROFILE
    dataAccounts: unknown[]
    dataBalances: unknown[]
    budgetCsvs: unknown
    budgetConfig: unknown
    allocationCustomRatios: unknown[]
    taxStore: unknown
    taxTemplates: unknown[]
    fiSimulations: unknown[]
    sgtOverrides: unknown
    settings: Record<string, unknown>
  }> = {},
): { name: string; content: string } {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    goals: overrides.goals ?? [CROSS_PAGE_GOAL],
    gwGoals: overrides.gwGoals ?? [],
    profile: overrides.profile ?? CROSS_PAGE_PROFILE,
    settings: overrides.settings ?? {
      accentTheme: 'teal',
      darkMode: false,
      allowCsvImport: true,
      goalViewMode: '',
      homeCardOrder: JSON.stringify([0, 1, 2, 3]),
    },
    dataAccounts: overrides.dataAccounts ?? CROSS_PAGE_ACCOUNTS,
    dataBalances: overrides.dataBalances ?? CROSS_PAGE_BALANCES,
    budgetCsvs: overrides.budgetCsvs ?? CROSS_PAGE_BUDGET_STORE.csvs,
    budgetConfig: overrides.budgetConfig ?? {
      years: CROSS_PAGE_BUDGET_STORE.years,
      categoryGroups: CROSS_PAGE_BUDGET_STORE.categoryGroups,
    },
    fiSimulations: overrides.fiSimulations ?? [],
    sgtOverrides: overrides.sgtOverrides ?? {},
    allocationCustomRatios: overrides.allocationCustomRatios ?? [],
    taxStore: overrides.taxStore ?? { years: {} },
    taxTemplates: overrides.taxTemplates ?? [],
  }
  return { name: 'v2-cross-page.json', content: JSON.stringify(payload) }
}

/** Convenience URLs under the Vite dev base + HashRouter. */
export const URLS = {
  base: '/finance-tracking/',
  home: '/finance-tracking/#/',
  goal: '/finance-tracking/#/goal',
  goalDetail: (id: number | string) => `/finance-tracking/#/goal/${id}`,
  goalCalculator: '/finance-tracking/#/goal/calculator',
  netWorth: '/finance-tracking/#/net-worth',
  netWorthGrowth: '/finance-tracking/#/net-worth/growth',
  allocation: '/finance-tracking/#/net-worth/allocation',
  budget: '/finance-tracking/#/budget',
} as const

/**
 * Overwrite `user-profile` in-place and add (or remove) a partner with
 * the given birthday. Mirrors what ProfilePane does on save EXCEPT it
 * does NOT fire any event — there is no `profile-changed` channel in
 * the app (useProfile only re-renders via cross-tab `storage` events
 * or component remount). Callers MUST `await page.reload()` to see the
 * update on Goals / GoalsPeek / FI Calculator.
 */
export async function mutateProfile(
  page: Page,
  patch: { birthday?: string; partner?: { birthday: string } | null },
): Promise<void> {
  await page.evaluate(async patch => {
    const e2eStore = (window as Window & typeof globalThis & { __e2eFileStore?: any }).__e2eFileStore
    if (!e2eStore) return
    const cur = await e2eStore.readJSON('profile.json', { name: '', birthday: '', avatarDataUrl: '' })
    if (patch.birthday !== undefined) cur.birthday = patch.birthday
    if (patch.partner === null) {
      delete cur.partner
    } else if (patch.partner) {
      cur.partner = {
        name: cur.partner?.name ?? 'Partner',
        avatarDataUrl: cur.partner?.avatarDataUrl ?? '',
        birthday: patch.partner.birthday,
      }
    }
    await e2eStore.writeJSON('profile.json', cur)
  }, patch)
}

/**
 * Build a `budget-store` shape with 12 monthly CSVs for a given year.
 * Each CSV has one income row (`Salary`, positive) and one expense row
 * (`Rent`, negative). The classification rule used by SavingsGrowthTracker
 * and FICalculator (category is "expense" if any monthly sum < 0) means
 * Salary aggregates to `monthlyIncome * 12` of income and Rent aggregates
 * to `monthlyExpense * 12` of expense.
 *
 * `extraYears` lets a single call seed multiple years at once.
 */
export function seedBudgetCsvsForYear(
  year: number,
  monthlyIncome: number,
  monthlyExpense: number,
  extraYears: { year: number; monthlyIncome: number; monthlyExpense: number }[] = [],
): typeof CROSS_PAGE_BUDGET_STORE {
  const csvs: Record<string, { month: string; csv: string; uploadedAt: string }> = {}
  const years = [{ year, monthlyIncome, monthlyExpense }, ...extraYears]
  const yearList: number[] = []
  for (const y of years) {
    yearList.push(y.year)
    for (let m = 1; m <= 12; m++) {
      const key = `${y.year}-${String(m).padStart(2, '0')}`
      const day = `${key}-15`
      csvs[key] = {
        month: key,
        csv: `Date,Category,Amount\n${day},Salary,${y.monthlyIncome}\n${day},Rent,-${y.monthlyExpense}`,
        uploadedAt: `${key}-15T00:00:00.000Z`,
      }
    }
  }
  return {
    csvs,
    configs: {},
    years: yearList,
    categoryGroups: [
      { id: 'others', name: 'Others', categories: [] },
      { id: 'removed', name: 'Remove from Budget', categories: [] },
    ],
  }
}
