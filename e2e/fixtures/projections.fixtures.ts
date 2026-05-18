import { Page } from '@playwright/test'

export const MOBILE_VIEWPORT = { width: 375, height: 812 }

export const FI_ACCOUNTS = [
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
]

export const NON_FI_ACCOUNT = {
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
}

export const BALANCES = [
  { id: 1, accountId: 1, month: '2025-05', balance: 180000 },
  { id: 2, accountId: 2, month: '2025-05', balance: 65000 },
  { id: 3, accountId: 3, month: '2025-05', balance: 95000 },
  { id: 4, accountId: 1, month: '2025-04', balance: 175000 },
  { id: 5, accountId: 2, month: '2025-04', balance: 63000 },
  { id: 6, accountId: 3, month: '2025-04', balance: 92000 },
]

// FI balance = 180000 + 65000 + 95000 = 340000
export const FI_BALANCE = 340000

export const BALANCES_EXCEEDS_TARGET = [
  { id: 1, accountId: 1, month: '2025-05', balance: 600000 },
  { id: 2, accountId: 2, month: '2025-05', balance: 300000 },
  { id: 3, accountId: 3, month: '2025-05', balance: 200000 },
]

// FI balance = 600000 + 300000 + 200000 = 1100000 (exceeds 1M target)

export const PROFILE = { name: 'Alex', avatarDataUrl: '', birthday: '1992-03-15' }

export const FI_GOAL = {
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
  fiGoal: 1000000,
  progress: 34,
}

export const FI_GOAL_ZERO_TARGET = {
  ...FI_GOAL,
  id: 10,
  goalName: 'Zero Target',
  fiGoal: 0,
}

export const FI_GOAL_HUGE_TARGET = {
  ...FI_GOAL,
  id: 11,
  goalName: 'Huge Target',
  fiGoal: 999999999,
}

export const FI_GOAL_PAST_RETIREMENT = {
  ...FI_GOAL,
  id: 12,
  goalName: 'Past Retirement',
  retirementAge: 30,
  goalEndYear: '2022',
  retirement: '2022-03',
}

export const BUDGET_SUMMARY = {
  annualSavings: 12000,
  saveRate: 15,
  monthsOfData: 12,
}

export const BUDGET_SUMMARY_HIGH_SAVINGS = {
  annualSavings: 96000,
  saveRate: 60,
  monthsOfData: 12,
}

export const BUDGET_SUMMARY_ZERO_SAVINGS = {
  annualSavings: 0,
  saveRate: 0,
  monthsOfData: 6,
}

export const BUDGET_SUMMARY_TINY_SAVINGS = {
  annualSavings: 100,
  saveRate: 1,
  monthsOfData: 6,
}

export const BUDGET_SUMMARY_NEGATIVE_GROWTH = {
  annualSavings: 48000,
  saveRate: 40,
  monthsOfData: 12,
}

export interface ProjectionSeedOptions {
  goals?: typeof FI_GOAL[]
  accounts?: typeof FI_ACCOUNTS
  balances?: typeof BALANCES
  budgetSummary?: typeof BUDGET_SUMMARY | null
  profile?: typeof PROFILE | null
  darkMode?: boolean
}

export async function seedProjectionData(page: Page, options: ProjectionSeedOptions = {}) {
  const {
    goals = [FI_GOAL],
    accounts = FI_ACCOUNTS,
    balances = BALANCES,
    budgetSummary = BUDGET_SUMMARY,
    profile = PROFILE,
    darkMode,
  } = options

  await page.addInitScript(
    ({ goals, accounts, balances, budgetSummary, profile, darkMode }) => {
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')
      localStorage.setItem('onboarding-dismissed', '1')

      localStorage.setItem('financialGoals', JSON.stringify(goals))
      localStorage.setItem('data-accounts', JSON.stringify(accounts))
      localStorage.setItem('data-balances', JSON.stringify(balances))

      if (budgetSummary) {
        localStorage.setItem('budget-summary', JSON.stringify(budgetSummary))
      }
      if (profile) {
        localStorage.setItem('user-profile', JSON.stringify(profile))
      }
      if (darkMode !== undefined) {
        localStorage.setItem('darkMode', darkMode ? '1' : '0')
      }
    },
    { goals, accounts, balances, budgetSummary, profile, darkMode },
  )
}

export async function seedGoalReachedState(page: Page) {
  await seedProjectionData(page, {
    balances: BALANCES_EXCEEDS_TARGET,
  })
}

export async function seedNoBudgetState(page: Page) {
  await seedProjectionData(page, {
    budgetSummary: null,
  })
}

export async function seedNotReachableState(page: Page) {
  await seedProjectionData(page, {
    budgetSummary: BUDGET_SUMMARY_ZERO_SAVINGS,
  })
}

export async function seedNotReachableTinySavings(page: Page) {
  await seedProjectionData(page, {
    goals: [FI_GOAL_HUGE_TARGET],
    budgetSummary: BUDGET_SUMMARY_TINY_SAVINGS,
  })
}

export async function seedHighGrowthRate(page: Page) {
  const highGrowthGoal = { ...FI_GOAL, growth: 95 }
  await seedProjectionData(page, {
    goals: [highGrowthGoal],
  })
}

export async function seedNegativeGrowthRate(page: Page) {
  const negativeGrowthGoal = { ...FI_GOAL, growth: -5 }
  await seedProjectionData(page, {
    goals: [negativeGrowthGoal],
    budgetSummary: BUDGET_SUMMARY_NEGATIVE_GROWTH,
  })
}

export async function seedNoAccountsState(page: Page) {
  await seedProjectionData(page, {
    accounts: [],
    balances: [],
  })
}
