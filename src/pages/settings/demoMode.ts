/**
 * Demo Mode seed data.
 *
 * Demo mode swaps the disk-backed FileStore for an in-memory one seeded with
 * realistic sample data, so nothing on the user's disk is ever touched.
 */

import type { FinancialGoal, GwGoal } from '../../types'
import type { Account, BalanceEntry } from '../data/types'
import type { CategoryGroup } from '../budget/types'
import type { FileStore } from '../../utils/fileStoreTypes'

function demoProfile() {
  return {
    name: 'Alex',
    avatarDataUrl: '',
    birthday: '1992-03-15',
    partner: { name: 'Sam', avatarDataUrl: '', birthday: '1994-07-22' },
  }
}

function demoGoals(): { financialGoals: FinancialGoal[]; gwGoals: GwGoal[] } {
  const financialGoals: FinancialGoal[] = [
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
      expenseValueMar2026: 68000,
      expenseValue2047: 120000,
      monthlyExpenseRetirement: 10000,
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
      expenseValueMar2026: 53000,
      expenseValue2047: 95000,
      monthlyExpenseRetirement: 7917,
      safeWithdrawalRate: 4,
      growth: 7,
      retirement: '2047-03',
      fiGoal: 2375000,
      progress: 35,
    },
    {
      id: 3,
      goalName: "Partner's Plan",
      createdAt: '2022-01-10T00:00:00.000Z',
      birthday: '1994-07-22',
      goalCreatedIn: '2022-01',
      goalEndYear: '2054',
      resetExpenseMonth: false,
      retirementAge: 52,
      expenseMonth: 1,
      expenseValue: 45000,
      monthlyExpenseValue: 3750,
      expenseValueMar2026: 50000,
      expenseValue2047: 85000,
      monthlyExpenseRetirement: 7083,
      safeWithdrawalRate: 4,
      growth: 7,
      retirement: '2046-07',
      fiGoal: 2125000,
      progress: 28,
    },
  ]

  const gwGoals: GwGoal[] = [
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
      label: 'Kids College Fund',
      createdAt: '2022-01-01',
      disburseAge: 48,
      disburseAmount: 120000,
      growthRate: 6,
      currentSavings: 18000,
    },
    {
      id: 103,
      fiGoalId: 2,
      label: 'Sabbatical Fund',
      createdAt: '2023-01-01',
      disburseAge: 40,
      disburseAmount: 30000,
      growthRate: 4,
      currentSavings: 12000,
    },
    {
      id: 104,
      fiGoalId: 3,
      label: 'New Car',
      createdAt: '2023-06-01',
      disburseAge: 36,
      disburseAmount: 35000,
      growthRate: 3,
      currentSavings: 22000,
    },
  ]

  return { financialGoals, gwGoals }
}

function demoAccounts(): Account[] {
  return [
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
    {
      id: 5,
      name: 'Partner 401(k)',
      type: 'retirement',
      owner: 'partner',
      status: 'active',
      goalType: 'fi',
      nature: 'asset',
      allocation: 'bonds',
      institution: 'T. Rowe Price',
      group: 'Retirement',
    },
  ]
}

function demoBalances(): BalanceEntry[] {
  const balances: BalanceEntry[] = []
  let nextId = 1

  const startYear = 2016
  const now = new Date()
  const endYear = now.getFullYear()
  const endMonth = now.getMonth() + 1

  // [startBalance, monthlyContribution, annualGrowthPct, volatility]
  const profiles: Record<number, [number, number, number, number]> = {
    1: [25000, 1800, 9, 0.03],
    2: [8000, 500, 8, 0.025],
    3: [15000, 1000, 7.5, 0.035],
    4: [10000, 800, 4.5, 0.005],
    5: [12000, 1200, 8.5, 0.03],
  }

  for (const [accountId, [startBal, monthlyAdd, annualGrowth, vol]] of Object.entries(profiles)) {
    let balance = startBal
    const monthlyGrowth = annualGrowth / 100 / 12

    for (let y = startYear; y <= endYear; y++) {
      const maxMonth = y === endYear ? endMonth : 12
      for (let m = 1; m <= maxMonth; m++) {
        balance += monthlyAdd
        balance *= 1 + monthlyGrowth
        balance *= 1 + (Math.random() - 0.5) * vol * 2
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

  return balances
}

function demoBudget(): { groups: CategoryGroup[]; years: number[]; csvs: Record<string, string> } {
  const categories = {
    income: ['Salary', 'Side Income', 'Interest'],
    housing: ['Rent', 'Utilities', 'Internet'],
    food: ['Groceries', 'Restaurants', 'Coffee'],
    transport: ['Gas', 'Car Insurance', 'Maintenance'],
    personal: ['Shopping', 'Subscriptions', 'Gym'],
  }

  const groups: CategoryGroup[] = [
    { id: 'income', name: 'Income', categories: categories.income, type: 'income' },
    { id: 'housing', name: 'Housing', categories: categories.housing },
    { id: 'food', name: 'Food', categories: categories.food },
    { id: 'transport', name: 'Transport', categories: categories.transport },
    { id: 'personal', name: 'Personal', categories: categories.personal },
    { id: 'others', name: 'Others', categories: [] },
    { id: 'removed', name: 'Remove from Budget', categories: [] },
  ]

  const csvs: Record<string, string> = {}
  const years: number[] = []
  const now = new Date()

  for (let y = now.getFullYear() - 2; y <= now.getFullYear(); y++) {
    years.push(y)
    const maxMonth = y === now.getFullYear() ? now.getMonth() + 1 : 12

    for (let m = 1; m <= maxMonth; m++) {
      const mm = String(m).padStart(2, '0')
      const monthKey = `${y}-${mm}`
      const lines = ['Date,Category,Amount']

      lines.push(`${y}-${mm}-01,Salary,${8500 + Math.round(Math.random() * 500)}`)
      if (Math.random() > 0.6) lines.push(`${y}-${mm}-15,Side Income,${300 + Math.round(Math.random() * 700)}`)
      lines.push(`${y}-${mm}-28,Interest,${20 + Math.round(Math.random() * 30)}`)

      lines.push(`${y}-${mm}-01,Rent,${-(1800 + Math.round(Math.random() * 200))}`)
      lines.push(`${y}-${mm}-05,Utilities,${-(120 + Math.round(Math.random() * 80))}`)
      lines.push(`${y}-${mm}-05,Internet,-79`)

      for (let w = 0; w < 4; w++) {
        const day = String(3 + w * 7).padStart(2, '0')
        lines.push(`${y}-${mm}-${day},Groceries,${-(80 + Math.round(Math.random() * 60))}`)
      }
      if (Math.random() > 0.3) lines.push(`${y}-${mm}-12,Restaurants,${-(40 + Math.round(Math.random() * 80))}`)
      if (Math.random() > 0.5) lines.push(`${y}-${mm}-20,Coffee,${-(15 + Math.round(Math.random() * 25))}`)

      lines.push(`${y}-${mm}-10,Gas,${-(45 + Math.round(Math.random() * 35))}`)
      if (m % 6 === 1) lines.push(`${y}-${mm}-15,Car Insurance,-650`)
      if (Math.random() > 0.85) lines.push(`${y}-${mm}-18,Maintenance,${-(100 + Math.round(Math.random() * 400))}`)

      if (Math.random() > 0.4) lines.push(`${y}-${mm}-08,Shopping,${-(30 + Math.round(Math.random() * 120))}`)
      lines.push(`${y}-${mm}-01,Subscriptions,-45`)
      lines.push(`${y}-${mm}-01,Gym,-50`)

      csvs[monthKey] = lines.join('\n')
    }
  }

  return { groups, years, csvs }
}

function demoTaxYears(): Record<number, { items: unknown[] }> {
  const currentYear = new Date().getFullYear()
  return {
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
  }
}

function demoTaxTemplates() {
  return [
    {
      id: 'tpl-1',
      name: 'Standard Filing',
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
}

function demoAllocationRatios() {
  return [
    {
      id: 'demo-1',
      name: 'Stock vs Bond',
      scope: 'fi',
      groups: [
        { label: 'Stocks', classes: ['us-stock', 'intl-stock'] },
        { label: 'Bonds', classes: ['bonds'] },
      ],
    },
    {
      id: 'demo-2',
      name: 'US vs International',
      scope: 'total',
      groups: [
        { label: 'US Stock', classes: ['us-stock'] },
        { label: 'Intl Stock', classes: ['intl-stock'] },
      ],
    },
  ]
}

/** Writes the full demo dataset into the given (in-memory) store. */
export async function seedDemoData(store: FileStore): Promise<void> {
  await store.writeJSON('profile.json', demoProfile())
  await store.writeJSON('goals.json', demoGoals())
  await store.writeJSON('accounts.json', demoAccounts())

  const byYear = new Map<string, BalanceEntry[]>()
  for (const entry of demoBalances()) {
    const year = entry.month.slice(0, 4)
    const list = byYear.get(year)
    if (list) list.push(entry)
    else byYear.set(year, [entry])
  }
  for (const [year, entries] of byYear) {
    await store.writeCSV(`balances/${year}.csv`, [
      ['month', 'accountId', 'balance'],
      ...entries.map(e => [e.month, String(e.accountId), String(e.balance)]),
    ])
  }

  const budget = demoBudget()
  await store.writeJSON('budget/categories.json', {
    version: 1,
    years: budget.years,
    categoryGroups: budget.groups,
  })
  for (const [monthKey, csv] of Object.entries(budget.csvs)) {
    const year = monthKey.slice(0, 4)
    await store.writeCSV(
      `transactions/${year}/${monthKey}.csv`,
      csv.split('\n').map(line => line.split(',')),
    )
  }

  for (const [year, data] of Object.entries(demoTaxYears())) {
    await store.writeJSON(`taxes/${year}.json`, data)
  }
  await store.writeJSON('taxes/templates.json', demoTaxTemplates())

  await store.writeJSON('allocation.json', demoAllocationRatios())
  await store.writeJSON('fi-simulations.json', [
    {
      name: 'Base Case',
      annualExpense: 60000,
      growthRate: 8,
      lastYear: new Date().getFullYear() - 1,
      retireYear: 2042,
      primary401kYear: 2052,
      partner401kYear: 2054,
      includeGwLiquid: false,
    },
  ])
  await store.writeJSON('savings-tracker-overrides.json', {})
}
