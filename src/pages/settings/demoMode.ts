/**
 * Demo Mode — temporarily replaces all user data with realistic fake data.
 * No existing code is modified. On enter: backup → seed → reload.
 * On exit: restore → reload.
 */

import type { FinancialGoal, GwGoal } from '../../types'
import type { Account, BalanceEntry } from '../data/types'
import type { BudgetStore, CategoryGroup } from '../budget/types'

const BACKUP_KEY = '_demo-backup'

// Keys to backup & replace (user data)
const DATA_KEYS = [
  'user-profile',
  'financialGoals',
  'gw-goals',
  'data-accounts',
  'data-balances',
  'budget-store',
  'budget-config',
  'tax-store',
  'tax-templates',
  'allocation-custom-ratios',
  'fi-simulations',
  'sgt-overrides',
]

// Keys to never touch (settings, credentials)
// darkMode, accentTheme, allowCsvImport, github-sync-config, goal-view-mode, home-card-order, lab-pdf-to-csv

export const isDemoActive = (): boolean => localStorage.getItem(BACKUP_KEY) !== null

export function enterDemoMode(): void {
  if (isDemoActive()) return

  // 1. Backup all data keys
  const backup: Record<string, string | null> = {}
  for (const key of DATA_KEYS) {
    backup[key] = localStorage.getItem(key)
  }
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backup))

  // 2. Clear data keys
  for (const key of DATA_KEYS) {
    localStorage.removeItem(key)
  }

  // 3. Seed fake data
  seedProfile()
  seedGoals()
  seedAccounts()
  seedBalances()
  seedBudget()
  seedTaxes()
  seedAllocation()
  seedToolsData()

  // 4. Reload
  window.location.reload()
}

export function exitDemoMode(): void {
  if (!isDemoActive()) return

  const raw = localStorage.getItem(BACKUP_KEY)
  if (!raw) return

  // 1. Remove all demo data
  for (const key of DATA_KEYS) {
    localStorage.removeItem(key)
  }

  // 2. Restore original data
  try {
    const backup: Record<string, string | null> = JSON.parse(raw)
    for (const [key, value] of Object.entries(backup)) {
      if (value !== null) {
        localStorage.setItem(key, value)
      }
    }
  } catch { /* corrupt backup — just clear */ }

  // 3. Remove backup key
  localStorage.removeItem(BACKUP_KEY)

  // 4. Reload
  window.location.reload()
}

/* ─── Seed Functions ─────────────────────────────────────────── */

function seedProfile(): void {
  localStorage.setItem('user-profile', JSON.stringify({
    name: 'Alex',
    avatarDataUrl: '',
    birthday: '1992-03-15',
    partner: { name: 'Sam', avatarDataUrl: '', birthday: '1994-07-22' },
  }))
}

function seedGoals(): void {
  const now = new Date()
  const goals: FinancialGoal[] = [
    {
      id: 1, goalName: 'Early Retirement', createdAt: '2020-01-15T00:00:00.000Z',
      birthday: '1992-03-15', goalCreatedIn: '2020-01', goalEndYear: '2050',
      resetExpenseMonth: false, retirementAge: 50,
      expenseMonth: 1, expenseValue: 60000, monthlyExpenseValue: 5000,
      expenseValueMar2026: 68000, expenseValue2047: 120000, monthlyExpense2047: 10000,
      inflationRate: 3, safeWithdrawalRate: 3.5, growth: 8,
      retirement: '2042-03', fiGoal: 3428571, progress: 42,
    },
    {
      id: 2, goalName: 'Coast FI', createdAt: '2021-06-01T00:00:00.000Z',
      birthday: '1992-03-15', goalCreatedIn: '2021-06', goalEndYear: '2055',
      resetExpenseMonth: false, retirementAge: 55,
      expenseMonth: 6, expenseValue: 48000, monthlyExpenseValue: 4000,
      expenseValueMar2026: 53000, expenseValue2047: 95000, monthlyExpense2047: 7917,
      inflationRate: 3, safeWithdrawalRate: 4, growth: 7,
      retirement: '2047-03', fiGoal: 2375000, progress: 35,
    },
    {
      id: 3, goalName: 'Partner\'s Plan', createdAt: '2022-01-10T00:00:00.000Z',
      birthday: '1994-07-22', goalCreatedIn: '2022-01', goalEndYear: '2054',
      resetExpenseMonth: false, retirementAge: 52,
      expenseMonth: 1, expenseValue: 45000, monthlyExpenseValue: 3750,
      expenseValueMar2026: 50000, expenseValue2047: 85000, monthlyExpense2047: 7083,
      inflationRate: 3, safeWithdrawalRate: 4, growth: 7,
      retirement: '2046-07', fiGoal: 2125000, progress: 28,
    },
  ]
  localStorage.setItem('financialGoals', JSON.stringify(goals))

  const gwGoals: GwGoal[] = [
    { id: 101, fiGoalId: 1, label: 'House Down Payment', createdAt: '2021-03-01', disburseAge: 35, disburseAmount: 80000, growthRate: 5, currentSavings: 45000 },
    { id: 102, fiGoalId: 1, label: 'Kids College Fund', createdAt: '2022-01-01', disburseAge: 48, disburseAmount: 120000, growthRate: 6, currentSavings: 18000 },
    { id: 103, fiGoalId: 2, label: 'Sabbatical Fund', createdAt: '2023-01-01', disburseAge: 40, disburseAmount: 30000, growthRate: 4, currentSavings: 12000 },
    { id: 104, fiGoalId: 3, label: 'New Car', createdAt: '2023-06-01', disburseAge: 36, disburseAmount: 35000, growthRate: 3, currentSavings: 22000 },
  ]
  localStorage.setItem('gw-goals', JSON.stringify(gwGoals))
}

function seedAccounts(): void {
  const accounts: Account[] = [
    { id: 1, name: '401(k)', type: 'retirement', owner: 'primary', status: 'active', goalType: 'fi', nature: 'asset', allocation: 'us-stock', institution: 'Fidelity', group: 'Retirement' },
    { id: 2, name: 'Roth IRA', type: 'retirement', owner: 'primary', status: 'active', goalType: 'fi', nature: 'asset', allocation: 'intl-stock', institution: 'Vanguard', group: 'Retirement' },
    { id: 3, name: 'Brokerage', type: 'non-retirement', owner: 'joint', status: 'active', goalType: 'fi', nature: 'asset', allocation: 'us-stock', institution: 'Schwab', group: 'Taxable' },
    { id: 4, name: 'High-Yield Savings', type: 'liquid', owner: 'joint', status: 'active', goalType: 'gw', nature: 'asset', allocation: 'cash', institution: 'Marcus', group: 'Cash' },
    { id: 5, name: 'Partner 401(k)', type: 'retirement', owner: 'partner', status: 'active', goalType: 'fi', nature: 'asset', allocation: 'bonds', institution: 'T. Rowe Price', group: 'Retirement' },
  ]
  localStorage.setItem('data-accounts', JSON.stringify(accounts))
}

function seedBalances(): void {
  const balances: BalanceEntry[] = []
  let nextId = 1

  // Generate ~10 years of monthly data (Jan 2016 → current month)
  const startYear = 2016
  const now = new Date()
  const endYear = now.getFullYear()
  const endMonth = now.getMonth() + 1

  // Account growth profiles: [startBalance, monthlyContribution, annualGrowthPct, volatility]
  const profiles: Record<number, [number, number, number, number]> = {
    1: [25000, 1800, 9, 0.03],    // 401k — aggressive growth
    2: [8000, 500, 8, 0.025],     // Roth IRA
    3: [15000, 1000, 7.5, 0.035], // Brokerage
    4: [10000, 800, 4.5, 0.005],  // HYSA — low volatility
    5: [12000, 1200, 8.5, 0.03],  // Partner 401k
  }

  for (const [accountId, [startBal, monthlyAdd, annualGrowth, vol]] of Object.entries(profiles)) {
    let balance = startBal
    const monthlyGrowth = annualGrowth / 100 / 12

    for (let y = startYear; y <= endYear; y++) {
      const maxMonth = y === endYear ? endMonth : 12
      for (let m = 1; m <= maxMonth; m++) {
        // Simulate: contribution + growth + noise
        balance += monthlyAdd
        balance *= (1 + monthlyGrowth)
        // Add some realistic noise
        const noise = 1 + (Math.random() - 0.5) * vol * 2
        balance *= noise
        balance = Math.round(balance)

        balances.push({
          id: nextId++,
          accountId: Number(accountId),
          month: `${y}-${String(m).padStart(2, '0')}`,
          balance,
        })
      }
    }
  }

  localStorage.setItem('data-balances', JSON.stringify(balances))
}

function seedBudget(): void {
  const categories = {
    income: ['Salary', 'Side Income', 'Interest'],
    housing: ['Rent', 'Utilities', 'Internet'],
    food: ['Groceries', 'Restaurants', 'Coffee'],
    transport: ['Gas', 'Car Insurance', 'Maintenance'],
    personal: ['Shopping', 'Subscriptions', 'Gym'],
  }

  const groups: CategoryGroup[] = [
    { id: 'income', name: 'Income', categories: categories.income },
    { id: 'housing', name: 'Housing', categories: categories.housing },
    { id: 'food', name: 'Food', categories: categories.food },
    { id: 'transport', name: 'Transport', categories: categories.transport },
    { id: 'personal', name: 'Personal', categories: categories.personal },
    { id: 'others', name: 'Others', categories: [] },
    { id: 'removed', name: 'Remove from Budget', categories: [] },
  ]

  const csvs: Record<string, { month: string; csv: string; uploadedAt: string }> = {}
  const years: number[] = []
  const now = new Date()

  // Generate 3 years of budget data
  for (let y = now.getFullYear() - 2; y <= now.getFullYear(); y++) {
    years.push(y)
    const maxMonth = y === now.getFullYear() ? now.getMonth() + 1 : 12

    for (let m = 1; m <= maxMonth; m++) {
      const monthKey = `${y}-${String(m).padStart(2, '0')}`
      const lines = ['Date,Category,Amount']

      // Income
      lines.push(`${y}-${String(m).padStart(2, '0')}-01,Salary,${8500 + Math.round(Math.random() * 500)}`)
      if (Math.random() > 0.6) lines.push(`${y}-${String(m).padStart(2, '0')}-15,Side Income,${300 + Math.round(Math.random() * 700)}`)
      lines.push(`${y}-${String(m).padStart(2, '0')}-28,Interest,${20 + Math.round(Math.random() * 30)}`)

      // Expenses (negative amounts)
      lines.push(`${y}-${String(m).padStart(2, '0')}-01,Rent,${-(1800 + Math.round(Math.random() * 200))}`)
      lines.push(`${y}-${String(m).padStart(2, '0')}-05,Utilities,${-(120 + Math.round(Math.random() * 80))}`)
      lines.push(`${y}-${String(m).padStart(2, '0')}-05,Internet,-79`)

      // Food — multiple entries per month
      for (let w = 0; w < 4; w++) {
        const day = String(3 + w * 7).padStart(2, '0')
        lines.push(`${y}-${String(m).padStart(2, '0')}-${day},Groceries,${-(80 + Math.round(Math.random() * 60))}`)
      }
      if (Math.random() > 0.3) lines.push(`${y}-${String(m).padStart(2, '0')}-12,Restaurants,${-(40 + Math.round(Math.random() * 80))}`)
      if (Math.random() > 0.5) lines.push(`${y}-${String(m).padStart(2, '0')}-20,Coffee,${-(15 + Math.round(Math.random() * 25))}`)

      // Transport
      lines.push(`${y}-${String(m).padStart(2, '0')}-10,Gas,${-(45 + Math.round(Math.random() * 35))}`)
      if (m % 6 === 1) lines.push(`${y}-${String(m).padStart(2, '0')}-15,Car Insurance,-650`)
      if (Math.random() > 0.85) lines.push(`${y}-${String(m).padStart(2, '0')}-18,Maintenance,${-(100 + Math.round(Math.random() * 400))}`)

      // Personal
      if (Math.random() > 0.4) lines.push(`${y}-${String(m).padStart(2, '0')}-08,Shopping,${-(30 + Math.round(Math.random() * 120))}`)
      lines.push(`${y}-${String(m).padStart(2, '0')}-01,Subscriptions,-45`)
      lines.push(`${y}-${String(m).padStart(2, '0')}-01,Gym,-50`)

      csvs[monthKey] = { month: monthKey, csv: lines.join('\n'), uploadedAt: new Date().toISOString() }
    }
  }

  localStorage.setItem('budget-store', JSON.stringify({ csvs, configs: {}, years: [] }))
  localStorage.setItem('budget-config', JSON.stringify({ version: 1, years, categoryGroups: groups }))
}

function seedTaxes(): void {
  const currentYear = new Date().getFullYear()
  const store = {
    years: {
      [currentYear - 1]: {
        items: [
          { id: '1', label: 'W-2 (Alex)', owner: 'primary', category: 'paystub', accountIds: [], files: [] },
          { id: '2', label: 'W-2 (Sam)', owner: 'partner', category: 'paystub', accountIds: [], files: [] },
          { id: '3', label: '1099-INT', owner: 'joint', category: 'account', accountIds: [4], files: [] },
          { id: '4', label: '1099-DIV', owner: 'primary', category: 'account', accountIds: [3], files: [] },
          { id: '5', label: 'Tax Return (Federal)', owner: 'joint', category: 'tax-return', accountIds: [], files: [] },
          { id: '6', label: 'Tax Return (State)', owner: 'joint', category: 'tax-return', accountIds: [], files: [] },
        ],
      },
      [currentYear]: {
        items: [
          { id: '7', label: 'W-2 (Alex)', owner: 'primary', category: 'paystub', accountIds: [], files: [] },
          { id: '8', label: 'W-2 (Sam)', owner: 'partner', category: 'paystub', accountIds: [], files: [] },
          { id: '9', label: '1099-INT', owner: 'joint', category: 'account', accountIds: [4], files: [] },
          { id: '10', label: '1099-DIV', owner: 'primary', category: 'account', accountIds: [3], files: [] },
        ],
      },
    },
  }
  localStorage.setItem('tax-store', JSON.stringify(store))

  const templates = [
    {
      id: 'tpl-1', name: 'Standard Filing',
      items: [
        { label: 'W-2 (Primary)', owner: 'primary', category: 'paystub' },
        { label: 'W-2 (Partner)', owner: 'partner', category: 'paystub' },
        { label: '1099-INT', owner: 'joint', category: 'account' },
        { label: '1099-DIV', owner: 'primary', category: 'account' },
        { label: 'Tax Return (Federal)', owner: 'joint', category: 'tax-return' },
        { label: 'Tax Return (State)', owner: 'joint', category: 'tax-return' },
      ],
    },
  ]
  localStorage.setItem('tax-templates', JSON.stringify(templates))
}

function seedAllocation(): void {
  const ratios = [
    {
      id: 'demo-1', name: 'Stock vs Bond', scope: 'fi',
      groups: [
        { label: 'Stocks', classes: ['us-stock', 'intl-stock'] },
        { label: 'Bonds', classes: ['bonds'] },
      ],
    },
    {
      id: 'demo-2', name: 'US vs International', scope: 'total',
      groups: [
        { label: 'US Stock', classes: ['us-stock'] },
        { label: 'Intl Stock', classes: ['intl-stock'] },
      ],
    },
  ]
  localStorage.setItem('allocation-custom-ratios', JSON.stringify(ratios))
}

function seedToolsData(): void {
  const sims = [
    {
      name: 'Base Case',
      annualExpense: 60000,
      inflationRate: 3,
      growthRate: 8,
      lastYear: new Date().getFullYear() - 1,
      retireYear: 2042,
      primary401kYear: 2052,
      partner401kYear: 2054,
      includeGwLiquid: false,
    },
  ]
  localStorage.setItem('fi-simulations', JSON.stringify(sims))
  localStorage.setItem('sgt-overrides', '{}')
}
