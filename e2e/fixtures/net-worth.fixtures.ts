import type { Page } from '@playwright/test'
import { balanceEntriesToEntries, seedFileStore } from './seed-filestore'

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

export const INACTIVE_ACCOUNT = {
  id: 5,
  name: 'Old Savings',
  type: 'liquid' as const,
  owner: 'primary' as const,
  status: 'inactive' as const,
  goalType: 'gw' as const,
  nature: 'asset' as const,
  allocation: 'cash' as const,
  institution: 'Wells Fargo',
  group: '',
}

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

export function createLargeDataset(accountCount: number, monthCount: number) {
  const accounts = Array.from({ length: accountCount }, (_, i) => ({
    id: i + 1,
    name: `Account ${i + 1}`,
    type: 'non-retirement' as const,
    owner: 'primary' as const,
    status: 'active' as const,
    goalType: 'fi' as const,
    nature: 'asset' as const,
    allocation: 'us-stock' as const,
    institution: `Bank ${i + 1}`,
    group: `Group ${Math.floor(i / 5) + 1}`,
  }))

  const balances: Array<{ id: number; accountId: number; month: string; balance: number }> = []
  let id = 1
  for (let m = 0; m < monthCount; m++) {
    const year = 2025 - Math.floor(m / 12)
    const month = 12 - (m % 12)
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    for (let a = 0; a < accountCount; a++) {
      balances.push({ id: id++, accountId: a + 1, month: monthStr, balance: Math.round(Math.random() * 100000) })
    }
  }

  return { accounts, balances }
}

export async function seedNetWorthData(
  page: Page,
  options: {
    accounts?: typeof ACCOUNTS
    balances?: typeof BALANCES
    allowCsvImport?: boolean
  } = {},
) {
  const { accounts = ACCOUNTS, balances = BALANCES, allowCsvImport } = options

  await seedFileStore(page, [
    { path: 'accounts.json', data: accounts, type: 'json' },
    ...balanceEntriesToEntries(balances),
  ])
  await page.addInitScript(({ allowCsvImport }) => {
    localStorage.clear()
    localStorage.setItem('_e2eMode', '1')
    localStorage.setItem('encryption-enabled', '0')
    if (allowCsvImport) localStorage.setItem('allowCsvImport', '1')
  }, { allowCsvImport: allowCsvImport ?? true })
}

export async function seedEmptyState(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('_e2eMode', '1')
    localStorage.setItem('encryption-enabled', '0')
  })
}

export async function seedCorruptedData(page: Page, variant: 'malformed-json' | 'corrupted-balances' | 'missing-keys') {
  const entries = [] as Array<{ path: string; data: unknown; type: 'json' | 'csv' }>

  if (variant === 'corrupted-balances') {
    entries.push({
      path: 'accounts.json',
      data: [
        {
          id: 1,
          name: 'Test Account',
          type: 'retirement',
          owner: 'primary',
          status: 'active',
          goalType: 'fi',
          nature: 'asset',
          allocation: 'us-stock',
        },
      ],
      type: 'json',
    })
    entries.push({
      path: 'balances/2025.csv',
      data: [
        ['month', 'accountId', 'balance'],
        ['2025-01', '999', 'not-a-number'],
      ],
      type: 'csv',
    })
  } else if (variant === 'missing-keys') {
    entries.push({ path: 'accounts.json', data: [{ id: 1, name: 'Partial Account' }], type: 'json' })
  }

  await seedFileStore(page, entries)
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('_e2eMode', '1')
    localStorage.setItem('encryption-enabled', '0')
  })
}
