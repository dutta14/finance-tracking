import { Page } from '@playwright/test'

/**
 * Shared seed for the cross-page integration suites (#151 + future
 * 62b/c/d → #152/#153/#154). Centralizes the "all 13 sensitive keys
 * + feature-flags mock" baseline so each spec can layer overrides on
 * top without re-declaring 100 lines of localStorage seeding.
 *
 * Encryption is intentionally disabled (`encryption-enabled: '0'`),
 * which makes `appStorage.getJSON` read plaintext JSON directly out
 * of localStorage — matching demoMode.ts and the existing nav-data /
 * home.fixtures patterns.
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
  inflationRate: 3,
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
  taxStore: {},
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
 * Seed localStorage with the cross-page baseline. Mock the
 * feature-flags fetch (same pattern as seedNav) to keep test logs
 * free of GitHub anonymous-rate-limit 403s.
 *
 * Pass `null` for any field to OMIT that key from localStorage
 * (e.g. `{ budgetSummary: null }` → no `budget-summary` key written).
 */
export async function seedCrossPage(page: Page, overrides: SeedOverrides = {}): Promise<void> {
  await page.route(
    'https://api.github.com/repos/dutta14/finance-tracking/contents/feature-flags.json',
    async route => {
      const content = Buffer.from(JSON.stringify({ flags: {} })).toString('base64')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content, encoding: 'base64' }),
      })
    },
  )

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
      'allocationCustomRatios' in overrides
        ? overrides.allocationCustomRatios
        : CROSS_PAGE_SEED.allocationCustomRatios,
    fiSimulations: 'fiSimulations' in overrides ? overrides.fiSimulations : CROSS_PAGE_SEED.fiSimulations,
    sgtOverrides: 'sgtOverrides' in overrides ? overrides.sgtOverrides : CROSS_PAGE_SEED.sgtOverrides,
    taxStore: 'taxStore' in overrides ? overrides.taxStore : CROSS_PAGE_SEED.taxStore,
    taxTemplates: 'taxTemplates' in overrides ? overrides.taxTemplates : CROSS_PAGE_SEED.taxTemplates,
  }

  await page.addInitScript(data => {
    // One-shot sentinel: addInitScript runs on EVERY navigation/reload,
    // but tests that mutate or delete keys mid-session and then trigger
    // a route change (or rely on the in-app reload after import) must
    // not have their changes overwritten. The sentinel lets the first
    // navigation seed the baseline and every subsequent navigation skip.
    if (localStorage.getItem('__cross_page_seeded') === '1') return
    localStorage.clear()
    localStorage.setItem('__cross_page_seeded', '1')
    localStorage.setItem('encryption-enabled', '0')
    localStorage.setItem('onboarding-dismissed', '1')
    localStorage.setItem('darkMode', '0')

    const writeIf = (key: string, value: unknown) => {
      if (value === null || value === undefined) return
      localStorage.setItem(key, JSON.stringify(value))
    }
    writeIf('user-profile', data.profile)
    writeIf('data-accounts', data.accounts)
    writeIf('data-balances', data.balances)
    writeIf('financialGoals', data.goals)
    writeIf('gw-goals', data.gwGoals)
    writeIf('budget-summary', data.budgetSummary)
    writeIf('budget-store', data.budgetStore)
    writeIf('budget-config', data.budgetConfig)
    writeIf('allocation-custom-ratios', data.allocationCustomRatios)
    writeIf('fi-simulations', data.fiSimulations)
    writeIf('sgt-overrides', data.sgtOverrides)
    writeIf('tax-store', data.taxStore)
    writeIf('tax-templates', data.taxTemplates)
  }, resolved)
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
    ({ accountId, month, newBalance }) => {
      const raw = localStorage.getItem('data-balances') || '[]'
      const list = JSON.parse(raw) as { id: number; accountId: number; month: string; balance: number }[]
      const idx = list.findIndex(b => b.accountId === accountId && b.month === month)
      if (idx >= 0) {
        list[idx] = { ...list[idx], balance: newBalance }
      } else {
        const nextId = list.reduce((m, b) => Math.max(m, b.id), 0) + 1
        list.push({ id: nextId, accountId, month, balance: newBalance })
      }
      localStorage.setItem('data-balances', JSON.stringify(list))
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
    taxStore: overrides.taxStore ?? {},
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
  netWorth: '/finance-tracking/#/net-worth',
  allocation: '/finance-tracking/#/net-worth/allocation',
  budget: '/finance-tracking/#/budget',
} as const
