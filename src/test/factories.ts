import type { FinancialGoal, GwGoal } from '../types'
import type { Account, BalanceEntry } from '../pages/data/types'
import type { Profile } from '../hooks/useProfile'
import type { BudgetStore, Transaction, CategoryGroup } from '../pages/budget/types'
import type { TaxStore, TaxChecklistItem } from '../pages/taxes/types'

export const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 1,
  name: 'Checking',
  type: 'liquid',
  owner: 'primary',
  status: 'active',
  goalType: 'gw',
  nature: 'asset',
  allocation: 'cash',
  ...overrides,
})

export const makeBalanceEntry = (overrides: Partial<BalanceEntry> = {}): BalanceEntry => ({
  id: 1,
  accountId: 1,
  month: '2024-01',
  balance: 1000,
  ...overrides,
})

export const makeGoal = (overrides: Partial<FinancialGoal> = {}): FinancialGoal => ({
  id: 1,
  goalName: 'Early Retirement',
  createdAt: '2024-01-01',
  birthday: '1990-01-15',
  goalCreatedIn: '2024',
  goalEndYear: '2050',
  resetExpenseMonth: false,
  retirementAge: 45,
  expenseMonth: 3,
  expenseValue: 60000,
  monthlyExpenseValue: 5000,
  expenseValueMar2026: 65000,
  expenseValue2047: 120000,
  monthlyExpense2047: 10000,
  inflationRate: 3,
  safeWithdrawalRate: 4,
  growth: 7,
  retirement: '2035-01-15',
  fiGoal: 1500000,
  progress: 40,
  ...overrides,
})

export const makeGwGoal = (overrides: Partial<GwGoal> = {}): GwGoal => ({
  id: 1,
  fiGoalId: 1,
  label: 'College Fund',
  createdAt: '2024-01-01',
  disburseAge: 50,
  disburseAmount: 100000,
  growthRate: 6,
  currentSavings: 25000,
  ...overrides,
})

export const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  name: 'Test User',
  avatarDataUrl: '',
  birthday: '1990-01-15',
  partner: null,
  ...overrides,
})

export const makeBudgetStore = (overrides: Partial<BudgetStore> = {}): BudgetStore => ({
  csvs: {},
  configs: {},
  years: [],
  categoryGroups: [],
  ...overrides,
})

export const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  date: '2024-01-15',
  category: 'Groceries',
  amount: -150,
  description: 'Weekly groceries',
  ...overrides,
})

export const makeCategoryGroup = (overrides: Partial<CategoryGroup> = {}): CategoryGroup => ({
  id: 'essentials',
  name: 'Essentials',
  categories: ['Groceries', 'Rent', 'Utilities'],
  ...overrides,
})

export const makeTaxItem = (overrides: Partial<TaxChecklistItem> = {}): TaxChecklistItem => ({
  id: 'w2-primary',
  label: 'W-2',
  owner: 'primary',
  category: 'paystub',
  accountIds: [],
  files: [],
  ...overrides,
})

export const makeTaxStore = (overrides: Partial<TaxStore> = {}): TaxStore => ({
  years: {},
  ...overrides,
})
