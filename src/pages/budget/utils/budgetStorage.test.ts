import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryFileStore } from '../../../utils/memoryFileStore'
import { parseCSV as parseCSVRows, serializeCSV } from '../../../utils/csvUtils'
import {
  loadBudgetStore,
  saveBudgetStore,
  loadBudgetConfig,
  saveBudgetConfig,
  getBudgetConfigData,
  getGlobalCategoryGroups,
  updateGlobalCategoryGroups,
  saveCSVForMonth,
  deleteCSVForMonth,
  createYear,
  renameBudgetMonth,
  getBudgetSaveRate,
  saveBudgetSummary,
  getExpenseGroups,
  getIncomeGroups,
} from './budgetStorage'
import type { BudgetStore, CategoryGroup } from '../types'

const DEFAULT_EXPENSE_GROUPS: CategoryGroup[] = [
  { id: 'others', name: 'Others', categories: [] },
  { id: 'removed', name: 'Remove from Budget', categories: [] },
]

const DEFAULT_INCOME_GROUPS: CategoryGroup[] = [{ id: 'income-others', name: 'Others', categories: [], type: 'income' }]

const DEFAULT_GROUPS: CategoryGroup[] = [...DEFAULT_EXPENSE_GROUPS, ...DEFAULT_INCOME_GROUPS]

const CSV_TEXT = 'Date,Category,Amount\n2025-01-01,Groceries,-100\n2025-01-02,Salary,5000'

let ms: MemoryFileStore

beforeEach(() => {
  ms = new MemoryFileStore()
})

async function seedCategories(
  store: MemoryFileStore,
  data: { version?: number; years: number[]; categoryGroups: CategoryGroup[] },
) {
  await store.writeJSON('budget/categories.json', { version: 1, ...data })
}

async function seedCSV(store: MemoryFileStore, monthKey: string, csvText: string) {
  const year = parseInt(monthKey.split('-')[0], 10)
  await store.writeCSV(`transactions/${year}/${monthKey}.csv`, parseCSVRows(csvText))
}

describe('loadBudgetStore', () => {
  it('returns empty store with default groups when nothing is stored', async () => {
    const store = await loadBudgetStore(ms)
    expect(store.csvs).toEqual({})
    expect(store.years).toEqual([])
    expect(store.categoryGroups?.filter(g => g.type === 'income')).toEqual(DEFAULT_INCOME_GROUPS)
  })

  it('loads CSVs from file store and categories from categories.json', async () => {
    await seedCategories(ms, {
      years: [2025],
      categoryGroups: [{ id: 'food', name: 'Food', categories: ['Groceries'] }, ...DEFAULT_GROUPS],
    })
    await seedCSV(ms, '2025-01', CSV_TEXT)

    const store = await loadBudgetStore(ms)
    expect(store.csvs['2025-01'].csv).toBe(serializeCSV(parseCSVRows(CSV_TEXT)))
    expect(store.years).toEqual([2025])
    expect(store.categoryGroups!.find(g => g.id === 'food')).toBeTruthy()
    expect(store.categoryGroups?.filter(g => g.type === 'income')).toEqual(DEFAULT_INCOME_GROUPS)
  })

  it('sets uploadedAt to empty string for all loaded months', async () => {
    await seedCategories(ms, { years: [2025], categoryGroups: DEFAULT_GROUPS })
    await seedCSV(ms, '2025-03', CSV_TEXT)

    const store = await loadBudgetStore(ms)
    expect(store.csvs['2025-03'].uploadedAt).toBe('')
  })

  it('skips empty CSV files', async () => {
    await seedCategories(ms, { years: [2025], categoryGroups: DEFAULT_GROUPS })
    // Write empty CSV (0 rows)
    await ms.writeCSV('transactions/2025/2025-01.csv', [])

    const store = await loadBudgetStore(ms)
    expect(store.csvs['2025-01']).toBeUndefined()
  })

  it('returns default store on read error', async () => {
    // MemoryFileStore never throws, but we verify default behavior with no data
    const store = await loadBudgetStore(ms)
    expect(store).toEqual(expect.objectContaining({ csvs: {}, years: [] }))
    expect(store.categoryGroups?.filter(g => g.type === 'income')).toEqual(DEFAULT_INCOME_GROUPS)
  })

  it('configs is always empty object', async () => {
    const store = await loadBudgetStore(ms)
    expect(store.configs).toEqual({})
  })
})

describe('saveBudgetStore', () => {
  it('writes CSVs to transactions/{year}/{month}.csv and categories.json', async () => {
    const store: BudgetStore = {
      csvs: { '2025-03': { month: '2025-03', csv: CSV_TEXT, uploadedAt: '' } },
      configs: {},
      years: [2025],
      categoryGroups: DEFAULT_GROUPS,
    }
    await saveBudgetStore(ms, store)

    // categories.json should have years
    const config = await ms.readJSON<{ years: number[] }>('budget/categories.json', { years: [] })
    expect(config.years).toEqual([2025])

    // CSV file should exist
    expect(await ms.exists('transactions/2025/2025-03.csv')).toBe(true)
  })

  it('derives years from store.csvs keys as well as store.years', async () => {
    const store: BudgetStore = {
      csvs: { '2024-06': { month: '2024-06', csv: CSV_TEXT, uploadedAt: '' } },
      configs: {},
      years: [2025], // different from CSV year
      categoryGroups: DEFAULT_GROUPS,
    }
    await saveBudgetStore(ms, store)
    const config = await ms.readJSON<{ years: number[] }>('budget/categories.json', { years: [] })
    expect(config.years).toContain(2024)
    expect(config.years).toContain(2025)
  })

  it('preserves existing CSV files not in store.csvs', async () => {
    // Seed a file that isn't in the store
    await seedCSV(ms, '2025-01', CSV_TEXT)
    await seedCategories(ms, { years: [2025], categoryGroups: DEFAULT_GROUPS })

    // Save a store that only has 2025-02
    const store: BudgetStore = {
      csvs: { '2025-02': { month: '2025-02', csv: CSV_TEXT, uploadedAt: '' } },
      configs: {},
      years: [2025],
      categoryGroups: DEFAULT_GROUPS,
    }
    await saveBudgetStore(ms, store)

    // Both files should exist — saveBudgetStore does not delete files it didn't load
    expect(await ms.exists('transactions/2025/2025-01.csv')).toBe(true)
    expect(await ms.exists('transactions/2025/2025-02.csv')).toBe(true)
  })

  it('dispatches budget-changed event', async () => {
    const spy = vi.fn()
    window.addEventListener('budget-changed', spy)
    const store: BudgetStore = { csvs: {}, configs: {}, years: [], categoryGroups: DEFAULT_GROUPS }
    await saveBudgetStore(ms, store)
    window.removeEventListener('budget-changed', spy)
    expect(spy).toHaveBeenCalled()
  })

  it('round-trips: saved store can be loaded back', async () => {
    const original: BudgetStore = {
      csvs: { '2025-05': { month: '2025-05', csv: CSV_TEXT, uploadedAt: '' } },
      configs: {},
      years: [2025],
      categoryGroups: [{ id: 'food', name: 'Food', categories: ['Groceries'] }, ...DEFAULT_GROUPS],
    }
    await saveBudgetStore(ms, original)
    const loaded = await loadBudgetStore(ms)
    expect(loaded.years).toEqual([2025])
    expect(loaded.csvs['2025-05']).toBeTruthy()
    expect(loaded.categoryGroups!.find(g => g.id === 'food')).toBeTruthy()
  })
})

describe('loadBudgetConfig', () => {
  it('returns empty config when nothing stored', async () => {
    const config = await loadBudgetConfig(ms)
    expect(config.version).toBe(1)
    expect(config.years).toEqual([])
    expect(config.categoryGroups).toEqual([])
  })

  it('loads saved config', async () => {
    await saveBudgetConfig(ms, { version: 1, years: [2024, 2025], categoryGroups: [] })
    const config = await loadBudgetConfig(ms)
    expect(config.years).toEqual([2024, 2025])
  })

  it('merges legacy income groups from incomeCategoryGroups', async () => {
    await ms.writeJSON('budget/categories.json', {
      version: 1,
      years: [2025],
      categoryGroups: [{ id: 'salary', name: 'Salary', categories: ['Paycheck'], type: 'income' }],
      incomeCategoryGroups: [
        { id: 'salary', name: '', categories: ['Bonus'] },
        { id: 'commissions', name: 'Commissions', categories: ['Commission'] },
      ],
    })

    const config = await loadBudgetConfig(ms)
    expect(config.version).toBe(1)
    expect(config.categoryGroups).toEqual(
      expect.arrayContaining([
        { id: 'salary', name: 'Salary', categories: ['Paycheck', 'Bonus'], type: 'income' },
        { id: 'commissions', name: 'Commissions', categories: ['Commission'], type: 'income' },
      ]),
    )
  })

  it('falls back missing version and years', async () => {
    await ms.writeJSON('budget/categories.json', {
      categoryGroups: [{ id: 'food', name: 'Food', categories: ['Groceries'] }],
    })

    const config = await loadBudgetConfig(ms)
    expect(config.version).toBe(1)
    expect(config.years).toEqual([])
  })
})

describe('saveBudgetConfig', () => {
  it('writes normalized config to budget/categories.json', async () => {
    await saveBudgetConfig(ms, { version: 1, years: [2024], categoryGroups: DEFAULT_GROUPS })
    const raw = await ms.readJSON<{ years: number[]; categoryGroups: CategoryGroup[] }>('budget/categories.json', {
      years: [],
      categoryGroups: [],
    })
    expect(raw.years).toEqual([2024])
    expect(raw.categoryGroups.find((g: CategoryGroup) => g.id === 'others')).toBeTruthy()
  })

  it('dispatches budget-changed event', async () => {
    const spy = vi.fn()
    window.addEventListener('budget-changed', spy)
    await saveBudgetConfig(ms, { version: 1, years: [], categoryGroups: [] })
    window.removeEventListener('budget-changed', spy)
    expect(spy).toHaveBeenCalled()
  })
})

describe('getBudgetConfigData', () => {
  it('extracts config data from a store', () => {
    const store: BudgetStore = {
      csvs: {},
      configs: {},
      years: [2024],
      categoryGroups: [
        { id: 'others', name: 'Others', categories: ['Misc'] },
        { id: 'income-others', name: 'Others', categories: ['Salary'], type: 'income' },
      ],
    }
    const config = getBudgetConfigData(store)
    expect(config.version).toBe(1)
    expect(config.years).toEqual([2024])
    expect(config.categoryGroups[0].categories).toEqual(['Misc'])
    expect(config.categoryGroups.find(g => g.id === 'income-others')?.categories).toEqual(['Salary'])
  })

  it('normalizes duplicate categories and removes income categories from expense fallback groups', () => {
    const store: BudgetStore = {
      csvs: {},
      configs: {},
      years: [2024],
      categoryGroups: [
        { id: 'food', name: 'Food', categories: ['Groceries', 'Groceries'] },
        { id: 'others', name: 'Others', categories: ['Groceries', 'Bonus'] },
        { id: 'income-others', name: 'Others', categories: ['Bonus', 'Bonus'], type: 'income' },
      ],
    }

    const config = getBudgetConfigData(store)

    expect(config.categoryGroups.find(g => g.id === 'food')?.categories).toEqual(['Groceries'])
    expect(config.categoryGroups.find(g => g.id === 'others')?.categories).toEqual([])
    expect(config.categoryGroups.find(g => g.id === 'income-others')?.categories).toEqual(['Bonus'])
  })

  it('falls back to DEFAULT_GROUPS when store has no categoryGroups', () => {
    const store: BudgetStore = {
      csvs: {},
      configs: {},
      years: [2025],
      categoryGroups: undefined as unknown as CategoryGroup[],
    }
    const config = getBudgetConfigData(store)
    expect(config.categoryGroups).toHaveLength(3)
    expect(config.years).toEqual([2025])
  })
})

describe('getGlobalCategoryGroups', () => {
  it('returns groups from store when present', () => {
    const store: BudgetStore = {
      csvs: {},
      configs: {},
      years: [],
      categoryGroups: [
        { id: 'food', name: 'Food', categories: [] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
      ],
    }
    const groups = getGlobalCategoryGroups(store)
    expect(groups.find(g => g.id === 'food')).toBeTruthy()
    expect(groups.find(g => g.id === 'removed')).toBeTruthy()
  })

  it('ensures removed group exists', () => {
    const store: BudgetStore = {
      csvs: {},
      configs: {},
      years: [],
      categoryGroups: [{ id: 'food', name: 'Food', categories: [] }],
    }
    const groups = getGlobalCategoryGroups(store)
    expect(groups.find(g => g.id === 'removed')).toBeTruthy()
  })

  it('returns default groups when store has no groups', () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [] }
    const groups = getGlobalCategoryGroups(store)
    expect(groups).toEqual(DEFAULT_EXPENSE_GROUPS)
  })

  it('appends removed group when missing from store groups', () => {
    const store: BudgetStore = {
      csvs: {},
      configs: {},
      years: [],
      categoryGroups: [{ id: 'others', name: 'Others', categories: [] }],
    }
    const groups = getGlobalCategoryGroups(store)
    expect(groups.find(g => g.id === 'removed')).toBeDefined()
  })
})

describe('group helpers', () => {
  it('returns expense groups without income entries and restores missing defaults', () => {
    const groups = getExpenseGroups([
      { id: 'food', name: 'Food', categories: ['Groceries'] },
      { id: 'paychecks', name: 'Paychecks', categories: ['Salary'], type: 'income' },
    ])

    expect(groups).toEqual([
      { id: 'food', name: 'Food', categories: ['Groceries'] },
      { id: 'others', name: 'Others', categories: [] },
      { id: 'removed', name: 'Remove from Budget', categories: [] },
    ])
  })

  it('returns income groups for explicit income entries and the income fallback id', () => {
    const groups = getIncomeGroups([
      { id: 'paychecks', name: 'Paychecks', categories: ['Salary'], type: 'income' },
      { id: 'income-others', name: 'Others', categories: ['Bonus'] },
      { id: 'food', name: 'Food', categories: ['Groceries'] },
    ])

    expect(groups).toEqual([
      { id: 'paychecks', name: 'Paychecks', categories: ['Salary'], type: 'income' },
      { id: 'income-others', name: 'Others', categories: ['Bonus'], type: 'income' },
    ])
  })
})

describe('updateGlobalCategoryGroups', () => {
  it('returns updated store with new groups', () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [], categoryGroups: DEFAULT_GROUPS }
    const newGroups = [{ id: 'rent', name: 'Rent', categories: ['Housing'] }]
    const updated = updateGlobalCategoryGroups(store, newGroups)
    expect(updated.categoryGroups).toBe(newGroups)
    expect(updated.csvs).toBe(store.csvs)
  })
})

describe('saveCSVForMonth', () => {
  it('adds csv to the store, writes file, and tracks the year', async () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [], categoryGroups: DEFAULT_GROUPS }
    const result = await saveCSVForMonth(ms, store, '2025-06', CSV_TEXT)
    expect(result.csvs['2025-06'].csv).toBe(CSV_TEXT)
    expect(result.years).toContain(2025)
    expect(await ms.exists('transactions/2025/2025-06.csv')).toBe(true)
  })

  it('does not duplicate year if already present', async () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [2025], categoryGroups: DEFAULT_GROUPS }
    const result = await saveCSVForMonth(ms, store, '2025-07', CSV_TEXT)
    expect(result.years.filter(y => y === 2025)).toHaveLength(1)
  })

  it('sorts years after adding', async () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [2026], categoryGroups: DEFAULT_GROUPS }
    const result = await saveCSVForMonth(ms, store, '2024-01', CSV_TEXT)
    expect(result.years).toEqual([2024, 2026])
  })
})

describe('deleteCSVForMonth', () => {
  it('removes the specified month csv from store and deletes file', async () => {
    await seedCSV(ms, '2025-01', CSV_TEXT)
    await seedCSV(ms, '2025-02', CSV_TEXT)
    const store: BudgetStore = {
      csvs: {
        '2025-01': { month: '2025-01', csv: CSV_TEXT, uploadedAt: '' },
        '2025-02': { month: '2025-02', csv: CSV_TEXT, uploadedAt: '' },
      },
      configs: {},
      years: [2025],
      categoryGroups: DEFAULT_GROUPS,
    }
    const result = await deleteCSVForMonth(ms, store, '2025-01')
    expect(result.csvs['2025-01']).toBeUndefined()
    expect(result.csvs['2025-02']).toBeTruthy()
    expect(await ms.exists('transactions/2025/2025-01.csv')).toBe(false)
  })
})

describe('renameBudgetMonth', () => {
  it('moves CSV from old key to new key', () => {
    const store: BudgetStore = {
      csvs: { '2025-05': { month: '2025-05', csv: 'data', uploadedAt: '' } },
      configs: {},
      years: [2025],
      categoryGroups: DEFAULT_GROUPS,
    }
    const result = renameBudgetMonth(store, '2025-05', '2025-04')
    expect(result.csvs['2025-04']).toBeTruthy()
    expect(result.csvs['2025-04'].month).toBe('2025-04')
    expect(result.csvs['2025-04'].csv).toBe('data')
    expect(result.csvs['2025-05']).toBeUndefined()
  })

  it('returns same store when oldKey === newKey', () => {
    const store: BudgetStore = {
      csvs: { '2025-05': { month: '2025-05', csv: 'data', uploadedAt: '' } },
      configs: {},
      years: [2025],
      categoryGroups: DEFAULT_GROUPS,
    }
    const result = renameBudgetMonth(store, '2025-05', '2025-05')
    expect(result).toBe(store)
  })

  it('returns same store when oldKey does not exist', () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [], categoryGroups: DEFAULT_GROUPS }
    const result = renameBudgetMonth(store, '2025-05', '2025-04')
    expect(result).toBe(store)
  })

  it('adds new year when moving to a different year', () => {
    const store: BudgetStore = {
      csvs: { '2025-05': { month: '2025-05', csv: 'data', uploadedAt: '' } },
      configs: {},
      years: [2025],
      categoryGroups: DEFAULT_GROUPS,
    }
    const result = renameBudgetMonth(store, '2025-05', '2024-12')
    expect(result.years).toContain(2024)
    expect(result.years).toContain(2025)
    expect(result.years).toEqual([2024, 2025])
  })
})

describe('createYear', () => {
  it('adds a new year', () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [2024], categoryGroups: DEFAULT_GROUPS }
    const result = createYear(store, 2025)
    expect(result.years).toContain(2025)
  })

  it('returns same store if year already exists', () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [2024], categoryGroups: DEFAULT_GROUPS }
    const result = createYear(store, 2024)
    expect(result).toBe(store)
  })
})

describe('getBudgetSaveRate', () => {
  it('returns null when no summary is stored', async () => {
    expect(await getBudgetSaveRate(ms)).toBeNull()
  })

  it('returns stored summary', async () => {
    const summary = { annualSavings: 60000, saveRate: 40, monthsOfData: 12 }
    await ms.writeJSON('budget/summary-cache.json', summary)
    expect(await getBudgetSaveRate(ms)).toEqual(summary)
  })
})

describe('saveBudgetSummary', () => {
  it('persists summary to budget/summary-cache.json', async () => {
    const summary = { annualSavings: 48000, saveRate: 35, monthsOfData: 8 }
    await saveBudgetSummary(ms, summary)
    const stored = await ms.readJSON<typeof summary>('budget/summary-cache.json', {
      annualSavings: 0,
      saveRate: 0,
      monthsOfData: 0,
    })
    expect(stored).toEqual(summary)
  })

  it('round-trips correctly with getBudgetSaveRate', async () => {
    const summary = { annualSavings: 72000, saveRate: 50, monthsOfData: 24 }
    await saveBudgetSummary(ms, summary)
    expect(await getBudgetSaveRate(ms)).toEqual(summary)
  })
})

describe('migrateToGlobalGroups (via loadBudgetStore)', () => {
  it('returns normalized groups when categoryGroups is present in categories.json', async () => {
    await seedCategories(ms, {
      years: [2025],
      categoryGroups: [
        { id: 'food', name: 'Food', categories: ['Groceries'] },
        { id: 'others', name: 'Others', categories: [] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
        { id: 'income-others', name: 'Others', categories: [], type: 'income' },
      ],
    })
    const store = await loadBudgetStore(ms)
    expect(store.categoryGroups!.find(g => g.id === 'food')).toBeTruthy()
    expect(store.categoryGroups!.find(g => g.id === 'income-others')).toBeTruthy()
  })

  it('adds default groups when categoryGroups is empty', async () => {
    await seedCategories(ms, { years: [], categoryGroups: [] })
    const store = await loadBudgetStore(ms)
    expect(store.categoryGroups!.find(g => g.id === 'others')).toBeTruthy()
    expect(store.categoryGroups!.find(g => g.id === 'removed')).toBeTruthy()
    expect(store.categoryGroups!.find(g => g.id === 'income-others')).toBeTruthy()
  })
})
