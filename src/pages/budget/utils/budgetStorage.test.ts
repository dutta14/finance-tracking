import { describe, it, expect, beforeEach } from 'vitest'
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
  getBudgetSaveRate,
  saveBudgetSummary,
} from './budgetStorage'
import type { BudgetStore, CategoryGroup } from '../types'

const DEFAULT_GROUPS: CategoryGroup[] = [
  { id: 'others', name: 'Others', categories: [] },
  { id: 'removed', name: 'Remove from Budget', categories: [] },
]

beforeEach(() => {
  localStorage.clear()
})

describe('loadBudgetStore', () => {
  it('returns empty store when nothing is stored', () => {
    const store = loadBudgetStore()
    expect(store.csvs).toEqual({})
    expect(store.years).toEqual([])
  })

  it('loads CSVs from store and config from separate key', () => {
    localStorage.setItem(
      'budget-store',
      JSON.stringify({
        csvs: { '2025-01': { month: '2025-01', csv: 'a,b,c', uploadedAt: '2025-01-15' } },
        configs: {},
        years: [],
      }),
    )
    localStorage.setItem(
      'budget-config',
      JSON.stringify({
        version: 1,
        years: [2025],
        categoryGroups: [
          { id: 'food', name: 'Food', categories: ['Groceries'] },
          { id: 'others', name: 'Others', categories: [] },
          { id: 'removed', name: 'Remove from Budget', categories: [] },
        ],
      }),
    )
    const store = loadBudgetStore()
    expect(store.csvs['2025-01'].csv).toBe('a,b,c')
    expect(store.years).toEqual([2025])
    expect(store.categoryGroups!.find(g => g.id === 'food')).toBeTruthy()
  })

  it('returns empty store on corrupt JSON', () => {
    localStorage.setItem('budget-store', '{bad')
    const store = loadBudgetStore()
    expect(store.csvs).toEqual({})
  })
})

describe('saveBudgetStore', () => {
  it('saves CSVs to main key and config to separate key', () => {
    const store: BudgetStore = {
      csvs: { '2025-03': { month: '2025-03', csv: 'x', uploadedAt: '2025-03-01' } },
      configs: {},
      years: [2025],
      categoryGroups: [
        { id: 'transport', name: 'Transport', categories: ['Gas'] },
        { id: 'others', name: 'Others', categories: [] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
      ],
    }
    saveBudgetStore(store)

    // Main store should only have CSVs
    const mainStore = JSON.parse(localStorage.getItem('budget-store')!)
    expect(mainStore.csvs['2025-03']).toBeTruthy()
    expect(mainStore.years).toEqual([]) // years go to config
    expect(mainStore.configs).toEqual({})

    // Config should have years and groups
    const config = JSON.parse(localStorage.getItem('budget-config')!)
    expect(config.years).toEqual([2025])
    expect(config.categoryGroups).toHaveLength(3)
  })
})

describe('loadBudgetConfig', () => {
  it('returns empty config when nothing stored', () => {
    const config = loadBudgetConfig()
    expect(config.version).toBe(1)
    expect(config.years).toEqual([])
    expect(config.categoryGroups).toEqual([])
  })

  it('loads saved config', () => {
    saveBudgetConfig({ version: 1, years: [2024, 2025], categoryGroups: [] })
    const config = loadBudgetConfig()
    expect(config.years).toEqual([2024, 2025])
  })

  it('returns empty config on corrupt JSON', () => {
    localStorage.setItem('budget-config', 'broken')
    const config = loadBudgetConfig()
    expect(config.years).toEqual([])
  })
})

describe('getBudgetConfigData', () => {
  it('extracts config data from a store', () => {
    const store: BudgetStore = {
      csvs: {},
      configs: {},
      years: [2024],
      categoryGroups: [{ id: 'others', name: 'Others', categories: ['Misc'] }],
    }
    const config = getBudgetConfigData(store)
    expect(config.version).toBe(1)
    expect(config.years).toEqual([2024])
    expect(config.categoryGroups[0].categories).toEqual(['Misc'])
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
    expect(groups).toEqual(DEFAULT_GROUPS)
  })
})

describe('updateGlobalCategoryGroups', () => {
  it('returns updated store with new groups', () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [], categoryGroups: DEFAULT_GROUPS }
    const newGroups = [{ id: 'rent', name: 'Rent', categories: ['Housing'] }]
    const updated = updateGlobalCategoryGroups(store, newGroups)
    expect(updated.categoryGroups).toBe(newGroups)
    expect(updated.csvs).toBe(store.csvs) // other fields unchanged
  })
})

describe('saveCSVForMonth', () => {
  it('adds csv to the store and tracks the year', () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [], categoryGroups: DEFAULT_GROUPS }
    const result = saveCSVForMonth(store, '2025-06', 'date,amount\n01/15,100')
    expect(result.csvs['2025-06'].csv).toBe('date,amount\n01/15,100')
    expect(result.csvs['2025-06'].uploadedAt).toBeTruthy()
    expect(result.years).toContain(2025)
  })

  it('does not duplicate year if already present', () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [2025], categoryGroups: DEFAULT_GROUPS }
    const result = saveCSVForMonth(store, '2025-07', 'csv data')
    expect(result.years.filter(y => y === 2025)).toHaveLength(1)
  })

  it('sorts years after adding', () => {
    const store: BudgetStore = { csvs: {}, configs: {}, years: [2026], categoryGroups: DEFAULT_GROUPS }
    const result = saveCSVForMonth(store, '2024-01', 'csv')
    expect(result.years).toEqual([2024, 2026])
  })
})

describe('deleteCSVForMonth', () => {
  it('removes the specified month csv', () => {
    const store: BudgetStore = {
      csvs: {
        '2025-01': { month: '2025-01', csv: 'a', uploadedAt: 't' },
        '2025-02': { month: '2025-02', csv: 'b', uploadedAt: 't' },
      },
      configs: {},
      years: [2025],
      categoryGroups: DEFAULT_GROUPS,
    }
    const result = deleteCSVForMonth(store, '2025-01')
    expect(result.csvs['2025-01']).toBeUndefined()
    expect(result.csvs['2025-02']).toBeTruthy()
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

describe('migrateToGlobalGroups (via loadBudgetStore)', () => {
  it('merges per-year category groups into global groups', () => {
    localStorage.setItem(
      'budget-store',
      JSON.stringify({
        csvs: {},
        configs: {
          2024: {
            year: 2024,
            categoryGroups: [
              { id: 'food', name: 'Food', categories: ['Groceries', 'Restaurants'] },
              { id: 'others', name: 'Others', categories: ['Misc'] },
              { id: 'removed', name: 'Remove from Budget', categories: [] },
            ],
          },
          2025: {
            year: 2025,
            categoryGroups: [
              { id: 'food', name: 'Food', categories: ['Groceries', 'Coffee'] },
              { id: 'transport', name: 'Transport', categories: ['Gas'] },
              { id: 'others', name: 'Others', categories: ['Misc', 'ATM'] },
              { id: 'removed', name: 'Remove from Budget', categories: [] },
            ],
          },
        },
        years: [2024, 2025],
      }),
    )
    // No config key → migration will trigger
    const store = loadBudgetStore()
    const groups = store.categoryGroups!
    // food should have merged categories
    const food = groups.find(g => g.id === 'food')
    expect(food).toBeTruthy()
    expect(food!.categories).toContain('Groceries')
    expect(food!.categories).toContain('Restaurants')
    expect(food!.categories).toContain('Coffee')
    // transport should exist
    expect(groups.find(g => g.id === 'transport')).toBeTruthy()
    // others + removed should be last
    const ids = groups.map(g => g.id)
    expect(ids[ids.length - 1]).toBe('removed')
    expect(ids[ids.length - 2]).toBe('others')
  })

  it('deduplicates categories in Others that exist in custom groups', () => {
    localStorage.setItem(
      'budget-store',
      JSON.stringify({
        csvs: {},
        configs: {
          2024: {
            year: 2024,
            categoryGroups: [
              { id: 'food', name: 'Food', categories: ['Groceries'] },
              { id: 'others', name: 'Others', categories: ['Groceries', 'Misc'] },
              { id: 'removed', name: 'Remove from Budget', categories: [] },
            ],
          },
        },
        years: [2024],
      }),
    )
    const store = loadBudgetStore()
    const others = store.categoryGroups!.find(g => g.id === 'others')!
    // Groceries is in the food group, so it should be removed from Others
    expect(others.categories).not.toContain('Groceries')
    expect(others.categories).toContain('Misc')
  })
})

describe('getBudgetSaveRate', () => {
  it('returns null when no budget-summary is stored', () => {
    expect(getBudgetSaveRate()).toBeNull()
  })

  it('returns parsed summary when valid JSON is stored', () => {
    const summary = { annualSavings: 60000, saveRate: 40, monthsOfData: 12 }
    localStorage.setItem('budget-summary', JSON.stringify(summary))
    const result = getBudgetSaveRate()
    expect(result).toEqual(summary)
  })

  it('returns null when budget-summary contains corrupt JSON', () => {
    localStorage.setItem('budget-summary', '{broken json!!!')
    expect(getBudgetSaveRate()).toBeNull()
  })

  it('returns summary with zero savings rate', () => {
    const summary = { annualSavings: 0, saveRate: 0, monthsOfData: 6 }
    localStorage.setItem('budget-summary', JSON.stringify(summary))
    expect(getBudgetSaveRate()).toEqual(summary)
  })

  it('returns summary with negative savings', () => {
    const summary = { annualSavings: -5000, saveRate: -10, monthsOfData: 3 }
    localStorage.setItem('budget-summary', JSON.stringify(summary))
    expect(getBudgetSaveRate()).toEqual(summary)
  })
})

describe('saveBudgetSummary', () => {
  it('persists summary to localStorage under budget-summary key', () => {
    const summary = { annualSavings: 48000, saveRate: 35, monthsOfData: 8 }
    saveBudgetSummary(summary)
    const stored = JSON.parse(localStorage.getItem('budget-summary')!)
    expect(stored).toEqual(summary)
  })

  it('overwrites previously saved summary', () => {
    saveBudgetSummary({ annualSavings: 10000, saveRate: 10, monthsOfData: 1 })
    saveBudgetSummary({ annualSavings: 20000, saveRate: 20, monthsOfData: 2 })
    const stored = JSON.parse(localStorage.getItem('budget-summary')!)
    expect(stored.annualSavings).toBe(20000)
    expect(stored.monthsOfData).toBe(2)
  })

  it('round-trips correctly with getBudgetSaveRate', () => {
    const summary = { annualSavings: 72000, saveRate: 50, monthsOfData: 24 }
    saveBudgetSummary(summary)
    expect(getBudgetSaveRate()).toEqual(summary)
  })
})
