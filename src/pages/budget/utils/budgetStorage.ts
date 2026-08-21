import { BudgetStore, CategoryGroup, BudgetConfigData, MonthCSV } from '../types'
export type { BudgetStore }
import type { FileStore } from '../../../utils/fileStoreTypes'
import { parseCSV as parseCSVRows, serializeCSV } from '../../../utils/csvUtils'

const CATEGORIES_PATH = 'budget/categories.json'
const SUMMARY_PATH = 'budget/summary-cache.json'

export async function getBudgetSaveRate(fileStore: FileStore): Promise<{
  annualSavings: number
  saveRate: number
  monthsOfData: number
  totalIncome?: number
  totalExpense?: number
} | null> {
  return fileStore.readJSON<{
    annualSavings: number
    saveRate: number
    monthsOfData: number
    totalIncome?: number
    totalExpense?: number
  } | null>(SUMMARY_PATH, null)
}

export async function saveBudgetSummary(
  fileStore: FileStore,
  summary: {
    annualSavings: number
    saveRate: number
    monthsOfData: number
    totalIncome?: number
    totalExpense?: number
  },
): Promise<void> {
  await fileStore.writeJSON(SUMMARY_PATH, summary)
}

const DEFAULT_GROUPS: CategoryGroup[] = [
  { id: 'others', name: 'Others', categories: [] },
  { id: 'removed', name: 'Remove from Budget', categories: [] },
  { id: 'income-others', name: 'Others', categories: [], type: 'income' },
]

const EMPTY_STORE: BudgetStore = {
  csvs: {},
  configs: {},
  years: [],
  categoryGroups: DEFAULT_GROUPS,
}

const cloneGroup = (group: CategoryGroup): CategoryGroup => {
  const base = {
    id: group.id,
    name: group.name,
    categories: [...group.categories],
  }

  return group.type === 'income' || group.id === 'income-others' ? { ...base, type: 'income' } : base
}

const cloneGroups = (groups: CategoryGroup[]): CategoryGroup[] => groups.map(cloneGroup)

const ensureGroup = (groups: CategoryGroup[], group: CategoryGroup): CategoryGroup[] =>
  groups.some(current => current.id === group.id) ? groups : [...groups, cloneGroup(group)]

const deduplicateFallbackGroup = (groups: CategoryGroup[], fallbackGroupId: string): CategoryGroup[] => {
  const customCats = new Set<string>()
  groups.forEach(group => {
    if (group.id !== fallbackGroupId) group.categories.forEach(category => customCats.add(category))
  })

  return groups.map(group =>
    group.id === fallbackGroupId
      ? { ...group, categories: group.categories.filter(category => !customCats.has(category)) }
      : group,
  )
}

const normalizeGroups = (groups: CategoryGroup[]): CategoryGroup[] => {
  const normalized = cloneGroups(groups)
    .filter(group => group.id && group.name)
    .map(group => ({ ...group, categories: [...new Set(group.categories)] }))

  const withDefaults = ensureGroup(
    ensureGroup(ensureGroup(normalized, DEFAULT_GROUPS[0]), DEFAULT_GROUPS[1]),
    DEFAULT_GROUPS[2],
  )
  const incomeGroups = deduplicateFallbackGroup(getIncomeGroups(withDefaults), 'income-others')

  // Remove income categories from the expense "others" fallback
  const incomeCats = new Set(incomeGroups.flatMap(g => g.categories))
  const expenseGroups = deduplicateFallbackGroup(getExpenseGroups(withDefaults), 'others').map(g =>
    g.id === 'others' ? { ...g, categories: g.categories.filter(c => !incomeCats.has(c)) } : g,
  )

  return [...expenseGroups, ...incomeGroups]
}

const mergeGroupCollections = (collections: CategoryGroup[][]): CategoryGroup[] => {
  const merged = new Map<string, CategoryGroup>()

  collections.flat().forEach(group => {
    const normalized = cloneGroup(group)
    const existing = merged.get(normalized.id)
    if (existing) {
      merged.set(normalized.id, {
        ...existing,
        name: normalized.name || existing.name,
        type: normalized.type === 'income' ? 'income' : existing.type,
        categories: [...new Set([...existing.categories, ...normalized.categories])],
      })
      return
    }

    merged.set(normalized.id, normalized)
  })

  return [...merged.values()]
}

const getLegacyIncomeGroups = (value: unknown): CategoryGroup[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap(group => {
    if (!group || typeof group !== 'object') return []
    const current = group as Partial<CategoryGroup>
    if (typeof current.id !== 'string' || typeof current.name !== 'string' || !Array.isArray(current.categories)) {
      return []
    }

    return [{ id: current.id, name: current.name, categories: current.categories, type: 'income' as const }]
  })
}

function migrateToGlobalGroups(store: BudgetStore): BudgetStore {
  if (store.categoryGroups && store.categoryGroups.length > 0) return store

  const groupMap = new Map<string, CategoryGroup>()
  Object.values(store.configs).forEach(config => {
    config.categoryGroups.forEach(group => {
      const normalized = cloneGroup(group)
      const existing = groupMap.get(normalized.id)
      if (existing) {
        groupMap.set(normalized.id, {
          ...existing,
          categories: [...new Set([...existing.categories, ...normalized.categories])],
        })
        return
      }
      groupMap.set(normalized.id, normalized)
    })
  })

  if (groupMap.size === 0) return { ...store, categoryGroups: cloneGroups(DEFAULT_GROUPS) }

  if (!groupMap.has('others')) groupMap.set('others', { id: 'others', name: 'Others', categories: [] })
  if (!groupMap.has('removed')) groupMap.set('removed', { id: 'removed', name: 'Remove from Budget', categories: [] })

  const others = groupMap.get('others')!
  const removed = groupMap.get('removed')!
  groupMap.delete('others')
  groupMap.delete('removed')

  const customCats = new Set<string>()
  groupMap.forEach(group => group.categories.forEach(category => customCats.add(category)))
  others.categories = others.categories.filter(category => !customCats.has(category))

  const removedCats = new Set(removed.categories)
  others.categories = others.categories.filter(category => !removedCats.has(category))

  return { ...store, categoryGroups: [...groupMap.values(), others, removed, DEFAULT_GROUPS[2]] }
}

export async function loadBudgetConfig(fileStore: FileStore): Promise<BudgetConfigData> {
  const config = await fileStore.readJSON<(BudgetConfigData & { incomeCategoryGroups?: CategoryGroup[] }) | null>(
    CATEGORIES_PATH,
    null,
  )
  if (!config) {
    return { version: 1, years: [], categoryGroups: [] }
  }
  return {
    version: config.version || 1,
    years: config.years || [],
    categoryGroups: mergeGroupCollections([
      config.categoryGroups || [],
      getLegacyIncomeGroups(config.incomeCategoryGroups),
    ]),
  }
}

export async function saveBudgetConfig(fileStore: FileStore, config: BudgetConfigData): Promise<void> {
  await fileStore.writeJSON(CATEGORIES_PATH, {
    ...config,
    categoryGroups: normalizeGroups(config.categoryGroups || []),
  })
  window.dispatchEvent(new Event('budget-changed'))
}

export async function loadBudgetStore(fileStore: FileStore): Promise<BudgetStore> {
  try {
    const config = await loadBudgetConfig(fileStore)

    // Discover years from transactions folder + config
    const txFolders = await fileStore.listFiles('transactions')
    const discoveredYears = txFolders.filter(f => /^\d{4}$/.test(f)).map(Number)
    const allYears = [...new Set([...config.years, ...discoveredYears])].sort()

    // Enumerate CSVs by year
    const csvs: Record<string, MonthCSV> = {}
    for (const year of allYears) {
      const files = await fileStore.listFiles(`transactions/${year}`)
      for (const filename of files) {
        if (!filename.endsWith('.csv')) continue
        const monthKey = filename.replace('.csv', '')
        const path = `transactions/${year}/${filename}`
        const rows = await fileStore.readCSV(path)
        if (rows.length === 0) continue
        csvs[monthKey] = {
          month: monthKey,
          csv: serializeCSV(rows),
          uploadedAt: '',
        }
      }
    }

    const store: BudgetStore = {
      csvs,
      configs: {},
      years: allYears,
      categoryGroups: config.categoryGroups,
    }

    const migrated = migrateToGlobalGroups(store)
    migrated.categoryGroups = normalizeGroups(migrated.categoryGroups || [])
    return migrated
  } catch {
    return { ...EMPTY_STORE, categoryGroups: cloneGroups(DEFAULT_GROUPS) }
  }
}

export async function saveBudgetStore(fileStore: FileStore, store: BudgetStore): Promise<void> {
  // Compute all years from store.years + keys in store.csvs
  const csvYears = Object.keys(store.csvs).map(k => parseInt(k.split('-')[0], 10))
  const allYears = [...new Set([...store.years, ...csvYears])].sort((a, b) => a - b)

  // Write all CSVs
  for (const [monthKey, monthCSV] of Object.entries(store.csvs)) {
    const year = parseInt(monthKey.split('-')[0], 10)
    const path = `transactions/${year}/${monthKey}.csv`
    await fileStore.writeCSV(path, parseCSVRows(monthCSV.csv))
  }

  // Write categories.json
  await fileStore.writeJSON(CATEGORIES_PATH, {
    version: 1,
    years: allYears,
    categoryGroups: normalizeGroups(store.categoryGroups || []),
  })

  window.dispatchEvent(new Event('budget-changed'))
}

export async function saveCSVForMonth(
  fileStore: FileStore,
  store: BudgetStore,
  monthKey: string,
  csvText: string,
): Promise<BudgetStore> {
  const year = parseInt(monthKey.split('-')[0], 10)
  const path = `transactions/${year}/${monthKey}.csv`
  await fileStore.writeCSV(path, parseCSVRows(csvText))

  const updated: BudgetStore = {
    ...store,
    csvs: {
      ...store.csvs,
      [monthKey]: { month: monthKey, csv: csvText, uploadedAt: '' },
    },
    years: store.years.includes(year) ? store.years : [...store.years, year].sort((a, b) => a - b),
  }
  return updated
}

export async function deleteCSVForMonth(
  fileStore: FileStore,
  store: BudgetStore,
  monthKey: string,
): Promise<BudgetStore> {
  const year = parseInt(monthKey.split('-')[0], 10)
  const path = `transactions/${year}/${monthKey}.csv`
  await fileStore.delete(path)

  const { [monthKey]: _, ...rest } = store.csvs
  return { ...store, csvs: rest }
}

export function getBudgetConfigData(store: BudgetStore): BudgetConfigData {
  return {
    version: 1,
    years: store.years,
    categoryGroups: normalizeGroups(store.categoryGroups || []),
  }
}

export function getExpenseGroups(groups: CategoryGroup[]): CategoryGroup[] {
  const expenseGroups = cloneGroups(groups.filter(group => group.type !== 'income'))
  return ensureGroup(ensureGroup(expenseGroups, DEFAULT_GROUPS[0]), DEFAULT_GROUPS[1])
}

export function getIncomeGroups(groups: CategoryGroup[]): CategoryGroup[] {
  const incomeGroups = cloneGroups(groups.filter(group => group.type === 'income' || group.id === 'income-others'))
  return ensureGroup(incomeGroups, DEFAULT_GROUPS[2])
}

export function getGlobalCategoryGroups(store: BudgetStore): CategoryGroup[] {
  const groups = store.categoryGroups
  if (groups && groups.length > 0) return getExpenseGroups(groups)
  return getExpenseGroups(DEFAULT_GROUPS)
}

export function updateGlobalCategoryGroups(store: BudgetStore, groups: CategoryGroup[]): BudgetStore {
  return { ...store, categoryGroups: groups }
}

export function renameBudgetMonth(store: BudgetStore, oldKey: string, newKey: string): BudgetStore {
  if (oldKey === newKey) return store
  const csv = store.csvs[oldKey]
  if (!csv) return store
  const updated = { ...store, csvs: { ...store.csvs } }
  delete updated.csvs[oldKey]
  updated.csvs[newKey] = { ...csv, month: newKey }
  const newYear = parseInt(newKey.split('-')[0], 10)
  if (!updated.years.includes(newYear)) {
    updated.years = [...updated.years, newYear].sort()
  }
  return updated
}

export function createYear(store: BudgetStore, year: number): BudgetStore {
  if (store.years.includes(year)) return store
  return {
    ...store,
    years: [...store.years, year].sort(),
  }
}
