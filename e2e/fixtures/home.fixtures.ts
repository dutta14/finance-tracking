import { Page } from '@playwright/test'

/**
 * Seed data helpers for Home Dashboard E2E tests.
 *
 * When encryption is disabled (the default), appStorage reads directly from
 * localStorage. We seed plaintext JSON the same way demoMode.ts does.
 */

export const MOBILE_VIEWPORT = { width: 375, height: 812 }

export interface SeedOptions {
  accounts?: boolean
  balances?: boolean
  goals?: boolean
  budget?: boolean
  profile?: boolean
  cardOrder?: number[]
  onboardingDismissed?: boolean
  darkMode?: boolean
  customBalances?: typeof BALANCES
}

export const ACCOUNTS = [
  {
    id: 1,
    name: '401(k)',
    type: 'retirement',
    owner: 'primary',
    status: 'active',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'us-stock',
    institution: 'Fidelity',
    group: 'Retirement',
  },
  {
    id: 2,
    name: 'Roth IRA',
    type: 'retirement',
    owner: 'primary',
    status: 'active',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'intl-stock',
    institution: 'Vanguard',
    group: 'Retirement',
  },
  {
    id: 3,
    name: 'Brokerage',
    type: 'non-retirement',
    owner: 'joint',
    status: 'active',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'us-stock',
    institution: 'Schwab',
    group: 'Taxable',
  },
  {
    id: 4,
    name: 'High-Yield Savings',
    type: 'liquid',
    owner: 'joint',
    status: 'active',
    goalType: 'gw',
    nature: 'asset',
    allocation: 'cash',
    institution: 'Marcus',
    group: 'Cash',
  },
]

export const BALANCES = [
  { id: 1, accountId: 1, month: '2025-05', balance: 180000 },
  { id: 2, accountId: 2, month: '2025-05', balance: 65000 },
  { id: 3, accountId: 3, month: '2025-05', balance: 95000 },
  { id: 4, accountId: 4, month: '2025-05', balance: 42000 },
  { id: 5, accountId: 1, month: '2025-04', balance: 175000 },
  { id: 6, accountId: 2, month: '2025-04', balance: 63000 },
  { id: 7, accountId: 3, month: '2025-04', balance: 92000 },
  { id: 8, accountId: 4, month: '2025-04', balance: 41000 },
]

export const GOALS = [
  {
    id: 1,
    goalName: 'Early Retirement',
    createdAt: '2020-01-15T00:00:00.000Z',
    birthday: '1992-03-15',
    goalCreatedIn: '2020-01',
    goalEndYear: '2050',
    resetExpenseMonth: false,
    retirementAge: 50,
    expenseMonth: 1,
    expenseValue: 60000,
    monthlyExpenseValue: 5000,
    expenseValueMar2026: 63600,
    expenseValue2047: 109272,
    monthlyExpense2047: 9106,
    inflationRate: 3,
    safeWithdrawalRate: 3.5,
    growth: 8,
    retirement: '2042-03',
    fiGoal: 3428571,
    progress: 42,
  },
  {
    id: 2,
    goalName: 'Coast FI',
    createdAt: '2021-06-01T00:00:00.000Z',
    birthday: '1992-03-15',
    goalCreatedIn: '2021-06',
    goalEndYear: '2055',
    resetExpenseMonth: false,
    retirementAge: 55,
    expenseMonth: 6,
    expenseValue: 48000,
    monthlyExpenseValue: 4000,
    expenseValueMar2026: 50880,
    expenseValue2047: 87418,
    monthlyExpense2047: 7285,
    inflationRate: 3,
    safeWithdrawalRate: 4,
    growth: 7,
    retirement: '2047-03',
    fiGoal: 2375000,
    progress: 35,
  },
]

export const GW_GOALS = [
  {
    id: 101,
    fiGoalId: 1,
    label: 'House Down Payment',
    createdAt: '2021-03-01',
    disburseAge: 35,
    disburseAmount: 80000,
    growthRate: 5,
    currentSavings: 45000,
  },
]

export const PROFILE = { name: 'Alex', avatarDataUrl: '', birthday: '1992-03-15' }

export const BUDGET_STORE = {
  csvs: {
    '2025-05': {
      month: '2025-05',
      csv: 'Date,Category,Amount\n2025-05-01,Salary,8500\n2025-05-01,Rent,-1800\n2025-05-05,Groceries,-400',
      uploadedAt: '2025-05-10T00:00:00.000Z',
    },
  },
  configs: {},
  years: [],
}

/**
 * Seeds localStorage with test data before navigating.
 * Call BEFORE page.goto() so the app reads seeded data on mount.
 */
export async function seedHomeData(page: Page, options: SeedOptions = {}) {
  const {
    accounts = true,
    balances = true,
    goals = true,
    budget = true,
    profile = true,
    cardOrder,
    onboardingDismissed,
    darkMode,
    customBalances,
  } = options

  await page.addInitScript(
    ({
      accounts,
      balances,
      goals,
      budget,
      profile,
      cardOrder,
      onboardingDismissed,
      darkMode,
      data,
    }) => {
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')

      if (accounts) localStorage.setItem('data-accounts', JSON.stringify(data.accounts))
      if (balances) localStorage.setItem('data-balances', JSON.stringify(data.balances))
      if (goals) {
        localStorage.setItem('financialGoals', JSON.stringify(data.goals))
        localStorage.setItem('gw-goals', JSON.stringify(data.gwGoals))
      }
      if (budget) localStorage.setItem('budget-store', JSON.stringify(data.budgetStore))
      if (profile) localStorage.setItem('user-profile', JSON.stringify(data.profile))
      if (cardOrder) localStorage.setItem('home-card-order', JSON.stringify(cardOrder))
      if (onboardingDismissed !== undefined) {
        localStorage.setItem('onboarding-dismissed', onboardingDismissed ? '1' : '0')
      }
      if (darkMode !== undefined) {
        localStorage.setItem('darkMode', darkMode ? '1' : '0')
      }
    },
    {
      accounts,
      balances,
      goals,
      budget,
      profile,
      cardOrder,
      onboardingDismissed,
      darkMode,
      data: {
        accounts: ACCOUNTS,
        balances: customBalances ?? BALANCES,
        goals: GOALS,
        gwGoals: GW_GOALS,
        budgetStore: BUDGET_STORE,
        profile: PROFILE,
      },
    },
  )
}

/**
 * Seeds empty state: no accounts, no balances, no goals, no budget.
 */
export async function seedEmptyState(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '0')
  })
}

/**
 * Seeds partial state for setup progress testing.
 * Delegates to seedHomeData with the specified data flags.
 */
export async function seedPartialState(
  page: Page,
  options: { accounts?: boolean; balances?: boolean; goals?: boolean; budget?: boolean },
) {
  await seedHomeData(page, {
    accounts: options.accounts ?? false,
    balances: options.balances ?? false,
    goals: options.goals ?? false,
    budget: options.budget ?? false,
    profile: false,
  })
}
