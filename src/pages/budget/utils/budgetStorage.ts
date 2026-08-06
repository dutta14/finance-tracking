import { BudgetStore, CategoryGroup, BudgetConfigData } from '../types'
import { appStorage } from '../../../utils/appStorage'

export function getBudgetSaveRate(): { annualSavings: number; saveRate: number; monthsOfData: number } | null {
  return appStorage.getJSON<{ annualSavings: number; saveRate: number; monthsOfData: number } | null>(
    'budget-summary',
    null,
  )
}

export function saveBudgetSummary(summary: { annualSavings: number; saveRate: number; monthsOfData: number }): void {
  appStorage.setJSON('budget-summary', summary)
}

const STORAGE_KEY = 'budget-store'
const CONFIG_KEY = 'budget-config'

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

export function loadBudgetStore(): BudgetStore {
  try {
    const parsed = appStorage.getJSON<(BudgetStore & { incomeCategoryGroups?: CategoryGroup[] }) | null>(
      STORAGE_KEY,
      null,
    )
    if (!parsed) return { ...EMPTY_STORE, categoryGroups: cloneGroups(DEFAULT_GROUPS) }

    const config = loadBudgetConfig()
    const mergedGroups = mergeGroupCollections([
      config.categoryGroups || [],
      parsed.categoryGroups || [],
      getLegacyIncomeGroups(parsed.incomeCategoryGroups),
    ])

    const store: BudgetStore = {
      csvs: parsed.csvs || {},
      configs: parsed.configs || {},
      years: config.years.length > 0 ? config.years : parsed.years || [],
      categoryGroups: mergedGroups,
    }

    const migrated = migrateToGlobalGroups(store)
    migrated.categoryGroups = normalizeGroups(migrated.categoryGroups || [])

    saveBudgetConfig(getBudgetConfigData(migrated))

    return migrated
  } catch {
    return { ...EMPTY_STORE, categoryGroups: cloneGroups(DEFAULT_GROUPS) }
  }
}

export function saveBudgetStore(store: BudgetStore): void {
  appStorage.setJSON(STORAGE_KEY, {
    csvs: store.csvs,
    configs: {},
    years: [],
  })
  window.dispatchEvent(new Event('budget-changed'))
  saveBudgetConfig(getBudgetConfigData(store))
}

export function loadBudgetConfig(): BudgetConfigData {
  const config = appStorage.getJSON<(BudgetConfigData & { incomeCategoryGroups?: CategoryGroup[] }) | null>(
    CONFIG_KEY,
    null,
  )
  if (!config) {
    return {
      version: 1,
      years: [],
      categoryGroups: [],
    }
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

export function saveBudgetConfig(config: BudgetConfigData): void {
  appStorage.setJSON(CONFIG_KEY, {
    ...config,
    categoryGroups: normalizeGroups(config.categoryGroups || []),
  })
  window.dispatchEvent(new Event('budget-changed'))
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

export function saveCSVForMonth(store: BudgetStore, monthKey: string, csvText: string): BudgetStore {
  const updated = { ...store }
  updated.csvs = {
    ...updated.csvs,
    [monthKey]: {
      month: monthKey,
      csv: csvText,
      uploadedAt: new Date().toISOString(),
    },
  }
  const year = parseInt(monthKey.split('-')[0], 10)
  if (!updated.years.includes(year)) {
    updated.years = [...updated.years, year].sort()
  }
  return updated
}

export function deleteCSVForMonth(store: BudgetStore, monthKey: string): BudgetStore {
  const updated = { ...store }
  const { [monthKey]: _, ...rest } = updated.csvs
  updated.csvs = rest
  return updated
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
