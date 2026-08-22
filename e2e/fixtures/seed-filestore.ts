import type { Page } from '@playwright/test'
import { parseCSV, serializeCSV } from '../../src/utils/csvUtils'

export interface SeedEntry {
  path: string
  data: unknown
  type: 'json' | 'csv'
}

interface SeedFileStoreOptions {
  onceKey?: string
}

/**
 * Seeds data into the E2E MemoryFileStore via window.__e2eSeedData.
 * Must be called BEFORE page navigation (uses addInitScript).
 */
export async function seedFileStore(
  page: Page,
  entries: SeedEntry[],
  options: SeedFileStoreOptions = {},
): Promise<void> {
  const seedMap: Record<string, string> = {}
  for (const entry of entries) {
    if (entry.type === 'csv') {
      seedMap[entry.path] = serializeCSV(entry.data as string[][])
    } else {
      seedMap[entry.path] = JSON.stringify(entry.data)
    }
  }

  await page.addInitScript(
    ({ data, onceKey }) => {
      if (onceKey && sessionStorage.getItem(onceKey) === '1') return
      const win = window as Window & typeof globalThis & { __e2eSeedData?: Record<string, string> }
      win.__e2eSeedData = { ...(win.__e2eSeedData ?? {}), ...data }
      if (onceKey) sessionStorage.setItem(onceKey, '1')
    },
    { data: seedMap, onceKey: options.onceKey ?? null },
  )
}

/** Convert flat balance rows to balances/{year}.csv entries. */
export function balanceEntriesToEntries(
  balances: Array<{ month: string; accountId: number | string; balance: number | string }>,
): SeedEntry[] {
  const balanceMap: Record<string, Record<string, number>> = {}
  for (const entry of balances) {
    const month = String(entry.month)
    if (!balanceMap[month]) balanceMap[month] = {}
    balanceMap[month][String(entry.accountId)] = Number(entry.balance)
  }
  return balancesToEntries(balanceMap)
}

/** Convert old balance map { "2024-01": { "1": 5000, "2": 3000 } } to CSV entries. */
export function balancesToEntries(balanceMap: Record<string, Record<string, number>>): SeedEntry[] {
  const byYear = new Map<string, string[][]>()
  for (const [month, accounts] of Object.entries(balanceMap)) {
    const year = month.slice(0, 4)
    if (!byYear.has(year)) byYear.set(year, [['month', 'accountId', 'balance']])
    const rows = byYear.get(year)!
    for (const [accountId, balance] of Object.entries(accounts)) {
      rows.push([month, accountId, String(balance)])
    }
  }

  return [...byYear.entries()].map(([year, rows]) => ({
    path: `balances/${year}.csv`,
    data: rows,
    type: 'csv' as const,
  }))
}

/** Convert financialGoals + gw-goals to goals.json. */
export function goalsToEntry(financialGoals: unknown[] = [], gwGoals: unknown[] = []): SeedEntry {
  return {
    path: 'goals.json',
    data: { financialGoals, gwGoals },
    type: 'json' as const,
  }
}

/** Convert old budget store csvs to transaction file entries. */
export function budgetCsvsToEntries(csvs: Record<string, { csv: string }>): SeedEntry[] {
  const entries: SeedEntry[] = []
  for (const [monthKey, { csv }] of Object.entries(csvs)) {
    const year = monthKey.split('-')[0]
    entries.push({ path: `transactions/${year}/${monthKey}.csv`, data: parseCSV(csv), type: 'csv' })
  }
  return entries
}

/** Convert old tax-store data to per-year JSON entries. */
export function taxStoreToEntries(store: Record<string, unknown>): SeedEntry[] {
  const years =
    'years' in store && store.years && typeof store.years === 'object'
      ? (store.years as Record<string, unknown>)
      : store

  return Object.entries(years).map(([year, data]) => ({
    path: `taxes/${year}.json`,
    data,
    type: 'json' as const,
  }))
}
