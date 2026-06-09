import { Page } from '@playwright/test'
import { ACCOUNTS, BALANCES, PROFILE } from './home.fixtures'

export { ACCOUNTS, BALANCES, PROFILE }

export const MOBILE_VIEWPORT = { width: 375, height: 812 }

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
    safeWithdrawalRate: 4,
    growth: 7,
    retirement: '2047-03',
    fiGoal: 2375000,
    progress: 35,
  },
  {
    id: 3,
    goalName: 'Lean FI',
    createdAt: '2022-09-10T00:00:00.000Z',
    birthday: '1992-03-15',
    goalCreatedIn: '2022-09',
    goalEndYear: '2045',
    resetExpenseMonth: false,
    retirementAge: 45,
    expenseMonth: 9,
    expenseValue: 36000,
    monthlyExpenseValue: 3000,
    expenseValueMar2026: 38160,
    expenseValue2047: 65563,
    monthlyExpense2047: 5464,
    safeWithdrawalRate: 4,
    growth: 7,
    retirement: '2037-03',
    fiGoal: 1800000,
    progress: 55,
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
  {
    id: 102,
    fiGoalId: 1,
    label: 'Car Fund',
    createdAt: '2022-01-15',
    disburseAge: 38,
    disburseAmount: 40000,
    growthRate: 4,
    currentSavings: 12000,
  },
]

export interface GoalsSeedOptions {
  goals?: boolean
  gwGoals?: boolean
  accounts?: boolean
  balances?: boolean
  profile?: boolean
  viewMode?: 'grid' | 'list'
  customGoals?: typeof GOALS
  customGwGoals?: typeof GW_GOALS
}

export async function seedGoalsData(page: Page, options: GoalsSeedOptions = {}) {
  const {
    goals = true,
    gwGoals = true,
    accounts = true,
    balances = true,
    profile = true,
    viewMode,
    customGoals,
    customGwGoals,
  } = options

  await page.addInitScript(
    ({ goals, gwGoals, accounts, balances, profile, viewMode, data }) => {
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')
      localStorage.setItem('onboarding-dismissed', '1')

      if (accounts) localStorage.setItem('data-accounts', JSON.stringify(data.accounts))
      if (balances) localStorage.setItem('data-balances', JSON.stringify(data.balances))
      if (goals) localStorage.setItem('financialGoals', JSON.stringify(data.goals))
      if (gwGoals) localStorage.setItem('gw-goals', JSON.stringify(data.gwGoals))
      if (profile) localStorage.setItem('user-profile', JSON.stringify(data.profile))
      if (viewMode) localStorage.setItem('goal-view-mode', viewMode)
    },
    {
      goals,
      gwGoals,
      accounts,
      balances,
      profile,
      viewMode,
      data: {
        accounts: ACCOUNTS,
        balances: BALANCES,
        goals: customGoals ?? GOALS,
        gwGoals: customGwGoals ?? GW_GOALS,
        profile: PROFILE,
      },
    },
  )
}

export async function seedEmptyGoals(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '0')
    localStorage.setItem('onboarding-dismissed', '1')
  })
}

export async function seedCorruptedGoals(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '0')
    localStorage.setItem('onboarding-dismissed', '1')
    localStorage.setItem('financialGoals', 'not-valid-json{{{')
  })
}

export async function seedMalformedGoal(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '0')
    localStorage.setItem('onboarding-dismissed', '1')
    localStorage.setItem(
      'financialGoals',
      JSON.stringify([{ id: 99, createdAt: '2020-01-01T00:00:00.000Z', birthday: '1992-03-15' }]),
    )
  })
}
