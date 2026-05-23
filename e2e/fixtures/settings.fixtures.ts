import { Page } from '@playwright/test'

/**
 * Seed helpers for Settings E2E tests (#128).
 *
 * The whole settings suite runs with encryption disabled (the default), so
 * sensitive keys can be seeded as plaintext JSON in localStorage and the
 * app reads them through appStorage's pass-through mode.
 *
 * Profile shape mirrors src/hooks/useProfile.ts — partner data is stored
 * NESTED under `partner` inside the `user-profile` JSON value (NOT as
 * separate partner-name / partner-birthday keys).
 */

export interface ProfilePartner {
  name: string
  birthday: string
  avatarDataUrl: string
}

export interface ProfileShape {
  name: string
  birthday: string
  avatarDataUrl: string
  partner?: ProfilePartner | null
}

export interface SeedProfileOptions {
  name?: string
  birthday?: string
  partner?: ProfilePartner | null
}

// ── Profile seeders ────────────────────────────────────────────────

/**
 * Seed `user-profile` with the given fields (encryption disabled).
 * Pass `undefined` (or omit) to leave the key unwritten — equivalent to
 * a fresh install with no profile.
 */
export async function seedProfile(page: Page, options: SeedProfileOptions = {}) {
  const profile: ProfileShape = {
    name: options.name ?? '',
    birthday: options.birthday ?? '',
    avatarDataUrl: '',
    partner: options.partner ?? null,
  }
  await page.addInitScript(p => {
    // Guard so reloads triggered by the app (factory reset, import) don't
    // re-seed and clobber in-app changes the test just made.
    if (sessionStorage.getItem('__settings_e2e_seeded')) return
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '0')
    localStorage.setItem('onboarding-dismissed', '1')
    localStorage.setItem('user-profile', JSON.stringify(p))
    sessionStorage.setItem('__settings_e2e_seeded', '1')
  }, profile)
}

/**
 * Clear all app storage (no profile, no settings). Used by test 13
 * (empty profile graceful render) and as the generic "fresh app" seed.
 */
export async function seedEmpty(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__settings_e2e_seeded')) return
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '0')
    localStorage.setItem('onboarding-dismissed', '1')
    sessionStorage.setItem('__settings_e2e_seeded', '1')
  })
}

// ── All-data seed for export test 20 ───────────────────────────────

/**
 * Realistic content for every v2 export top-level key. Values are
 * minimal but non-empty so that the exported JSON's keys can be
 * compared structurally AND we can confirm no key is null/missing.
 *
 * The shape of each value mirrors what the app would persist after a
 * user has interacted with every feature (one goal, one account, one
 * balance, one budget month, one tax year, etc).
 */
export const ALL_DATA_PROFILE: ProfileShape = {
  name: 'Quinn',
  birthday: '1990-04-15',
  avatarDataUrl: '',
  partner: null,
}

export const ALL_DATA_GOAL = {
  id: 1,
  goalName: 'Retire',
  fiGoal: 2_000_000,
  goalCreatedIn: 2024,
  goalEndYear: 2050,
  currentAmount: 50_000,
  expenseValue2047: 80_000,
  safeWithdrawalRate: 4,
}

export const ALL_DATA_GW_GOAL = {
  id: 100,
  fiGoalId: 1,
  label: 'House Down Payment',
  amount: 100_000,
  targetYear: 2028,
}

export const ALL_DATA_ACCOUNT = { id: 1, name: 'Checking', type: 'checking' }
export const ALL_DATA_BALANCE = { id: 1, accountId: 1, month: '2024-01', balance: 12_345 }

export const ALL_DATA_BUDGET_STORE = {
  csvs: {
    '2024-01': {
      month: '2024-01',
      csv: 'Date,Category,Amount,Description\n2024-01-01,Salary,5000,Paycheck',
      uploadedAt: '2024-01-15T00:00:00.000Z',
    },
  },
  configs: {},
  years: [2024],
  categoryGroups: [{ id: 'g1', name: 'Income', categories: ['Salary'] }],
}

export const ALL_DATA_BUDGET_CONFIG = {
  years: [2024],
  categoryGroups: [{ id: 'g1', name: 'Income', categories: ['Salary'] }],
}

export const ALL_DATA_TAX_STORE = {
  years: {
    2024: {
      items: [
        { id: 'item-1', label: 'W-2', owner: 'primary', category: 'paystub', accountIds: [], files: [] },
      ],
    },
  },
}

export const ALL_DATA_TAX_TEMPLATE = {
  id: 'tpl-1',
  name: 'Default',
  items: [{ id: 'item-1', label: 'W-2', owner: 'primary', category: 'paystub' }],
}

export const ALL_DATA_FI_SIMULATIONS = [{ id: 1, label: 'Base case', value: 1.05 }]
export const ALL_DATA_SGT_OVERRIDES = { '2024-01': { Salary: 1 } }
export const ALL_DATA_ALLOCATION_RATIOS = [{ name: 'Stocks', ratio: 0.7 }]

/**
 * Seed every key that `handleExport` reads, plus the three non-sensitive
 * settings keys included in the exported `settings` block.
 */
export async function seedAllData(page: Page) {
  await page.addInitScript(
    payload => {
      if (sessionStorage.getItem('__settings_e2e_seeded')) return
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')
      localStorage.setItem('onboarding-dismissed', '1')

      // Settings (non-sensitive)
      localStorage.setItem('darkMode', '1')
      localStorage.setItem('accentTheme', 'blue')
      localStorage.setItem('allowCsvImport', '1')
      localStorage.setItem('goal-view-mode', 'grid')
      localStorage.setItem('home-card-order', JSON.stringify([2, 0, 1, 3]))

      // Sensitive: plaintext (encryption disabled)
      localStorage.setItem('user-profile', JSON.stringify(payload.profile))
      localStorage.setItem('financialGoals', JSON.stringify([payload.goal]))
      localStorage.setItem('gw-goals', JSON.stringify([payload.gwGoal]))
      localStorage.setItem('data-accounts', JSON.stringify([payload.account]))
      localStorage.setItem('data-balances', JSON.stringify([payload.balance]))
      localStorage.setItem('budget-store', JSON.stringify(payload.budgetStore))
      localStorage.setItem('budget-config', JSON.stringify(payload.budgetConfig))
      localStorage.setItem('fi-simulations', JSON.stringify(payload.fiSims))
      localStorage.setItem('sgt-overrides', JSON.stringify(payload.sgt))
      localStorage.setItem('allocation-custom-ratios', JSON.stringify(payload.ratios))
      localStorage.setItem('tax-store', JSON.stringify(payload.taxStore))
      localStorage.setItem('tax-templates', JSON.stringify([payload.taxTemplate]))
      sessionStorage.setItem('__settings_e2e_seeded', '1')
    },
    {
      profile: ALL_DATA_PROFILE,
      goal: ALL_DATA_GOAL,
      gwGoal: ALL_DATA_GW_GOAL,
      account: ALL_DATA_ACCOUNT,
      balance: ALL_DATA_BALANCE,
      budgetStore: ALL_DATA_BUDGET_STORE,
      budgetConfig: ALL_DATA_BUDGET_CONFIG,
      fiSims: ALL_DATA_FI_SIMULATIONS,
      sgt: ALL_DATA_SGT_OVERRIDES,
      ratios: ALL_DATA_ALLOCATION_RATIOS,
      taxStore: ALL_DATA_TAX_STORE,
      taxTemplate: ALL_DATA_TAX_TEMPLATE,
    },
  )
}

// ── Import payload builders ────────────────────────────────────────

/**
 * Build a v1 (legacy) import payload — a bare JSON array of goals (no
 * version field, no wrapping object). The importValidator accepts this
 * shape via the `Array.isArray(parsed)` branch in goalsSource.
 *
 * Goal fields adapted to importValidator's requirements: numeric `id`
 * and non-empty `goalName` (the spec's literal `{ id: 'g1', name: '...' }`
 * shape would be rejected by validateGoal; tests in this suite assert
 * the imported goal IS visible afterward, so it must pass validation).
 */
export function buildV1Import(): { name: string; content: string } {
  const legacyGoal = {
    id: 1,
    goalName: 'FI Goal',
    fiGoal: 2_000_000,
    goalCreatedIn: 2024,
    goalEndYear: 2050,
    currentAmount: 0,
    expenseValue2047: 80_000,
    safeWithdrawalRate: 4,
  }
  return {
    name: 'v1-import.json',
    content: JSON.stringify([legacyGoal]),
  }
}

/**
 * Build a v2 import payload that includes two unknown top-level keys
 * (`unknownField` and `futureFeature`) that the validator must silently
 * drop — neither should appear in localStorage after import.
 */
export function buildV2ImportWithUnknown(): { name: string; content: string } {
  const known = {
    version: 2,
    goals: [
      {
        id: 42,
        goalName: 'V2 Imported Goal',
        fiGoal: 1_500_000,
        goalCreatedIn: 2024,
        goalEndYear: 2050,
        currentAmount: 100,
        expenseValue2047: 60_000,
        safeWithdrawalRate: 4,
      },
    ],
    unknownField: 'xyz',
    futureFeature: { nested: true, value: 42 },
  }
  return {
    name: 'v2-with-unknown.json',
    content: JSON.stringify(known),
  }
}

// ── Reference data for assertions ──────────────────────────────────

/**
 * The 15 top-level keys that `handleExport` writes into the v2 export
 * JSON. Sourced verbatim from src/contexts/ImportExportContext.tsx so
 * the export test fails loudly if a key is added or removed there
 * without a corresponding test update.
 */
export const V2_EXPORT_KEYS = [
  'version',
  'exportedAt',
  'goals',
  'gwGoals',
  'profile',
  'settings',
  'dataAccounts',
  'dataBalances',
  'budgetCsvs',
  'budgetConfig',
  'fiSimulations',
  'sgtOverrides',
  'allocationCustomRatios',
  'taxStore',
  'taxTemplates',
] as const

/**
 * The 13 sensitive keys defined in src/utils/encryptedStorage.ts. Every
 * one must be cleared by Factory Reset (test 8).
 */
export const SENSITIVE_KEYS = [
  'user-profile',
  'data-accounts',
  'data-balances',
  'budget-store',
  'budget-summary',
  'budget-config',
  'tax-store',
  'tax-templates',
  'financialGoals',
  'gw-goals',
  'fi-simulations',
  'allocation-custom-ratios',
  'sgt-overrides',
] as const
