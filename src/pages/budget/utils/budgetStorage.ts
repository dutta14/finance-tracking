import { BudgetStore, BudgetConfig, MonthCSV, CategoryGroup, BudgetConfigData } from '../types'

const STORAGE_KEY = 'budget-store'
const CONFIG_KEY = 'budget-config'

const DEFAULT_GROUPS: CategoryGroup[] = [
  { id: 'others', name: 'Others', categories: [] },
  { id: 'removed', name: 'Remove from Budget', categories: [] },
]

const EMPTY_STORE: BudgetStore = {
  csvs: {},
  configs: {},
  years: [],
  categoryGroups: DEFAULT_GROUPS,
}

/** Migrate per-year configs to global categoryGroups.
 *  Merges all per-year groups into one global list, deduplicating categories. */
function migrateToGlobalGroups(store: BudgetStore): BudgetStore {
  if (store.categoryGroups && store.categoryGroups.length > 0) return store

  // Collect all groups across years, merging categories
  const groupMap = new Map<string, CategoryGroup>()
  Object.values(store.configs).forEach(cfg => {
    cfg.categoryGroups.forEach(g => {
      const existing = groupMap.get(g.id)
      if (existing) {
        const merged = new Set([...existing.categories, ...g.categories])
        groupMap.set(g.id, { ...existing, categories: [...merged] })
      } else {
        groupMap.set(g.id, { ...g })
      }
    })
  })

  if (groupMap.size === 0) return { ...store, categoryGroups: DEFAULT_GROUPS }

  // Ensure "others" and "removed" exist
  if (!groupMap.has('others')) groupMap.set('others', { id: 'others', name: 'Others', categories: [] })
  if (!groupMap.has('removed')) groupMap.set('removed', { id: 'removed', name: 'Remove from Budget', categories: [] })

  // Build ordered list: custom groups first, then others, then removed
  const others = groupMap.get('others')!
  const removed = groupMap.get('removed')!
  groupMap.delete('others')
  groupMap.delete('removed')

  // Remove from "Others" any category that already exists in a custom group
  const customCats = new Set<string>()
  groupMap.forEach(g => g.categories.forEach(c => customCats.add(c)))
  others.categories = others.categories.filter(c => !customCats.has(c))

  // Also remove from "Others" anything in "removed"
  const removedCats = new Set(removed.categories)
  others.categories = others.categories.filter(c => !removedCats.has(c))

  const groups = [...groupMap.values(), others, removed]

  return { ...store, categoryGroups: groups }
}

/** Remove duplicate categories from "Others": any cat already in a custom/removed group */
function deduplicateOthers(groups: CategoryGroup[]): CategoryGroup[] {
  const customCats = new Set<string>()
  groups.forEach(g => {
    if (g.id !== 'others') g.categories.forEach(c => customCats.add(c))
  })
  return groups.map(g =>
    g.id === 'others'
      ? { ...g, categories: g.categories.filter(c => !customCats.has(c)) }
      : g
  )
}

export function loadBudgetStore(): BudgetStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY_STORE }
    const parsed = JSON.parse(raw) as BudgetStore

    // Load config from separate key (or migrate from old format)
    const config = loadBudgetConfig()

    const store: BudgetStore = {
      csvs: parsed.csvs || {},
      configs: parsed.configs || {},
      years: config.years.length > 0 ? config.years : (parsed.years || []),
      categoryGroups: config.categoryGroups,
    }

    // If old store had categoryGroups but config didn't, migrate
    if ((!config.categoryGroups || config.categoryGroups.length === 0) && parsed.categoryGroups && parsed.categoryGroups.length > 0) {
      store.categoryGroups = parsed.categoryGroups
    }

    const migrated = migrateToGlobalGroups(store)
    // Always clean up duplicates in "Others"
    if (migrated.categoryGroups) {
      migrated.categoryGroups = deduplicateOthers(migrated.categoryGroups)
    }

    // Persist config separately (migration step — strips config from CSV store)
    saveBudgetConfig({
      version: 1,
      years: migrated.years,
      categoryGroups: migrated.categoryGroups || DEFAULT_GROUPS,
    })

    return migrated
  } catch {
    return { ...EMPTY_STORE }
  }
}

export function saveBudgetStore(store: BudgetStore): void {
  // Save CSVs only to the main store key (no config data)
  const csvOnly = {
    csvs: store.csvs,
    configs: {},
    years: [],
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(csvOnly))

  // Save config separately
  saveBudgetConfig({
    version: 1,
    years: store.years,
    categoryGroups: store.categoryGroups || DEFAULT_GROUPS,
  })
}

export function loadBudgetConfig(): BudgetConfigData {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { version: 1, years: [], categoryGroups: [] }
    return JSON.parse(raw) as BudgetConfigData
  } catch {
    return { version: 1, years: [], categoryGroups: [] }
  }
}

export function saveBudgetConfig(config: BudgetConfigData): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

/** Build a BudgetConfigData from the current store */
export function getBudgetConfigData(store: BudgetStore): BudgetConfigData {
  return {
    version: 1,
    years: store.years,
    categoryGroups: store.categoryGroups || DEFAULT_GROUPS,
  }
}

export function getGlobalCategoryGroups(store: BudgetStore): CategoryGroup[] {
  const groups = store.categoryGroups
  if (groups && groups.length > 0) {
    // Ensure "removed" exists
    if (!groups.find(g => g.id === 'removed')) {
      return [...groups, { id: 'removed', name: 'Remove from Budget', categories: [] }]
    }
    return groups
  }
  return DEFAULT_GROUPS
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
  // Ensure year is tracked
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

export function createYear(store: BudgetStore, year: number): BudgetStore {
  if (store.years.includes(year)) return store
  return {
    ...store,
    years: [...store.years, year].sort(),
  }
}
