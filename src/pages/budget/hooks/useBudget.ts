import { useState, useCallback, useMemo, useRef } from 'react'
import { BudgetStore, Transaction, CategoryGroup, BudgetViewMode, BudgetConfigData } from '../types'
import {
  loadBudgetStore, saveBudgetStore, saveCSVForMonth, deleteCSVForMonth,
  createYear, getGlobalCategoryGroups, updateGlobalCategoryGroups,
} from '../utils/budgetStorage'
import { parseCSV, buildMonthKey, parseCSVLine, getValidLineIndices } from '../utils/csvParser'

const OTHERS_GROUP_ID = 'others'
const REMOVED_GROUP_ID = 'removed'

export function useBudget() {
  const [store, setStore] = useState<BudgetStore>(loadBudgetStore)
  const storeRef = useRef(store)
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const s = loadBudgetStore()
    const currentYear = new Date().getFullYear()
    return s.years.includes(currentYear) ? currentYear : (s.years[s.years.length - 1] || currentYear)
  })
  const [viewMode, setViewMode] = useState<BudgetViewMode>('detailed')

  const persist = useCallback((next: BudgetStore) => {
    storeRef.current = next
    setStore(next)
    saveBudgetStore(next)
  }, [])

  const uploadCSV = useCallback((monthKey: string, csvText: string): { ok: boolean; error?: string; transactions?: Transaction[] } => {
    try {
      const transactions = parseCSV(csvText)
      if (transactions.length === 0) {
        return { ok: false, error: 'No valid transactions found. Check CSV format.' }
      }
      let next = saveCSVForMonth(storeRef.current, monthKey, csvText)

      // Discover new categories and add them to "Others" if not already grouped
      const currentGroups = getGlobalCategoryGroups(next)
      const allGroupedCategories = new Set(currentGroups.flatMap(g => g.categories))
      const newCategories = [...new Set(transactions.map(t => t.category))].filter(c => !allGroupedCategories.has(c))

      if (newCategories.length > 0) {
        const groups = currentGroups.map(g => {
          if (g.id === OTHERS_GROUP_ID) {
            return { ...g, categories: [...g.categories, ...newCategories] }
          }
          return g
        })
        if (!groups.find(g => g.id === OTHERS_GROUP_ID)) {
          groups.push({ id: OTHERS_GROUP_ID, name: 'Others', categories: newCategories })
        }
        next = updateGlobalCategoryGroups(next, groups)
      }

      persist(next)
      return { ok: true, transactions }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Failed to parse CSV' }
    }
  }, [persist])

  const removeCSV = useCallback((monthKey: string) => {
    persist(deleteCSVForMonth(storeRef.current, monthKey))
  }, [persist])

  const handleCreateYear = useCallback((year: number) => {
    persist(createYear(storeRef.current, year))
    setSelectedYear(year)
  }, [persist])

  const handleUpdateCategoryGroups = useCallback((groups: CategoryGroup[]) => {
    persist(updateGlobalCategoryGroups(storeRef.current, groups))
  }, [persist])

  /** Edit a single transaction's category in the raw CSV */
  const editCategory = useCallback((monthKey: string, transactionIdx: number, newCategory: string) => {
    const current = storeRef.current
    const csvData = current.csvs[monthKey]
    if (!csvData) return

    const lines = csvData.csv.split(/\r?\n/)
    if (lines.length < 2) return
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
    const catIdx = headers.findIndex(h => h === 'category')
    if (catIdx === -1) return

    // Map parsed-transaction index to actual CSV line number
    const lineIndices = getValidLineIndices(csvData.csv)
    if (transactionIdx < 0 || transactionIdx >= lineIndices.length) return
    const targetLineIdx = lineIndices[transactionIdx]

    const fields = parseCSVLine(lines[targetLineIdx])
    if (catIdx >= fields.length) return
    fields[catIdx] = newCategory
    // Rebuild line, quoting fields that contain commas or quotes
    lines[targetLineIdx] = fields.map(f =>
      f.includes(',') || f.includes('"') ? '"' + f.replace(/"/g, '""') + '"' : f
    ).join(',')

    const newCsv = lines.join('\n')
    let next: BudgetStore = {
      ...current,
      csvs: { ...current.csvs, [monthKey]: { ...csvData, csv: newCsv } },
    }

    // If new category isn't in any group, add it to "Others"
    const groups = getGlobalCategoryGroups(next)
    const allGrouped = new Set(groups.flatMap(g => g.categories))
    if (!allGrouped.has(newCategory)) {
      const updated = groups.map(g =>
        g.id === OTHERS_GROUP_ID ? { ...g, categories: [...g.categories, newCategory] } : g
      )
      next = updateGlobalCategoryGroups(next, updated)
    }

    persist(next)
  }, [persist])

  /** Merge multiple categories into one: rewrites all CSV data and updates groups */
  const mergeCategories = useCallback((sourceCategories: string[], targetName: string) => {
    const current = storeRef.current
    const sourceSet = new Set(sourceCategories.filter(c => c !== targetName))
    if (sourceSet.size === 0) return

    // Rewrite CSV texts: replace source category names with target
    const newCsvs = { ...current.csvs }
    Object.entries(newCsvs).forEach(([key, csvData]) => {
      const lines = csvData.csv.split(/\r?\n/)
      if (lines.length < 2) return
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
      const catIdx = headers.findIndex(h => h === 'category')
      if (catIdx === -1) return

      let changed = false
      const newLines = [lines[0]]
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (!line.trim()) { newLines.push(line); continue }
        // Simple CSV field replacement for the category column
        const parts = line.split(',')
        const cat = parts[catIdx]?.trim().replace(/^"|"$/g, '')
        if (cat && sourceSet.has(cat)) {
          parts[catIdx] = targetName
          changed = true
        }
        newLines.push(parts.join(','))
      }
      if (changed) {
        newCsvs[key] = { ...csvData, csv: newLines.join('\n') }
      }
    })

    // Update groups: replace source categories with target, deduplicate
    const currentGroups = getGlobalCategoryGroups(current)
    const newGroups = currentGroups.map(g => {
      const hasSources = g.categories.some(c => sourceSet.has(c))
      const hasTarget = g.categories.includes(targetName)
      if (!hasSources && !hasTarget) return g
      let cats = g.categories.filter(c => !sourceSet.has(c))
      // If this group had a source but doesn't have target, add target
      if (hasSources && !hasTarget) {
        cats = [...cats, targetName]
      }
      return { ...g, categories: [...new Set(cats)] }
    })

    persist({
      ...current,
      csvs: newCsvs,
      categoryGroups: newGroups,
    })
  }, [persist])

  /** Check if a category has any transactions across all years' CSVs */
  const categoryHasTransactions = useCallback((category: string): boolean => {
    const current = storeRef.current
    for (const csvData of Object.values(current.csvs)) {
      const lines = csvData.csv.split(/\r?\n/)
      if (lines.length < 2) continue
      const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
      const catIdx = headers.findIndex(h => h === 'category')
      if (catIdx === -1) continue
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue
        const fields = parseCSVLine(lines[i])
        if (fields[catIdx]?.trim() === category) return true
      }
    }
    return false
  }, [])

  /** Remove a category from all groups (only if it has no transactions) */
  const deleteCategory = useCallback((category: string) => {
    const current = storeRef.current
    const groups = getGlobalCategoryGroups(current)
    const updated = groups.map(g => ({
      ...g,
      categories: g.categories.filter(c => c !== category),
    }))
    persist(updateGlobalCategoryGroups(current, updated))
  }, [persist])

  // Parse all CSVs for the selected year into transactions
  const yearTransactions = useMemo((): Record<string, Transaction[]> => {
    const result: Record<string, Transaction[]> = {}
    for (let m = 0; m < 12; m++) {
      const key = buildMonthKey(selectedYear, m)
      const csv = store.csvs[key]
      if (csv) {
        try {
          result[key] = parseCSV(csv.csv)
        } catch {
          result[key] = []
        }
      }
    }
    return result
  }, [store.csvs, selectedYear])

  // All unique categories across the year
  const allCategories = useMemo((): Set<string> => {
    const cats = new Set<string>()
    Object.values(yearTransactions).forEach(txs => txs.forEach(t => cats.add(t.category)))
    return cats
  }, [yearTransactions])

  // Global category groups (shared across all years)
  const categoryGroups = useMemo((): CategoryGroup[] => {
    return getGlobalCategoryGroups(store)
  }, [store])

  // Categories in the "Remove from Budget" group
  const removedCategories = useMemo((): Set<string> => {
    const removedGroup = categoryGroups.find(g => g.id === REMOVED_GROUP_ID)
    return new Set(removedGroup?.categories || [])
  }, [categoryGroups])

  // Compute per-category per-month sums (excluding removed categories)
  const categorySums = useMemo((): Record<string, Record<string, number>> => {
    const sums: Record<string, Record<string, number>> = {}
    Object.entries(yearTransactions).forEach(([monthKey, txs]) => {
      txs.forEach(t => {
        if (removedCategories.has(t.category)) return
        if (!sums[t.category]) sums[t.category] = {}
        sums[t.category][monthKey] = (sums[t.category][monthKey] || 0) + t.amount
      })
    })
    return sums
  }, [yearTransactions, removedCategories])

  // Summary totals — use same per-category classification as tables:
  // A category with ANY negative month is "expense"; otherwise "income".
  const summary = useMemo(() => {
    // First determine which categories are expense vs income
    const expenseCategories = new Set<string>()
    const incomeCategories = new Set<string>()
    Object.keys(categorySums).forEach(cat => {
      const vals = Object.values(categorySums[cat] || {})
      const hasNegative = vals.some(v => v < 0)
      if (hasNegative) expenseCategories.add(cat)
      else if (vals.some(v => v > 0)) incomeCategories.add(cat)
    })

    let totalIncome = 0
    let totalExpense = 0
    Object.entries(categorySums).forEach(([cat, monthMap]) => {
      const total = Object.values(monthMap).reduce((s, v) => s + v, 0)
      if (incomeCategories.has(cat)) totalIncome += total
      else if (expenseCategories.has(cat)) totalExpense += Math.abs(total)
    })

    const saveRate = totalIncome > 0 ? 1 - totalExpense / totalIncome : 0
    return { totalIncome, totalExpense, saveRate }
  }, [categorySums])

  // Which months have data
  const monthsWithData = useMemo((): Set<string> => {
    const keys = new Set<string>()
    for (let m = 0; m < 12; m++) {
      const key = buildMonthKey(selectedYear, m)
      if (store.csvs[key]) keys.add(key)
    }
    return keys
  }, [store.csvs, selectedYear])

  /** Apply config pulled from GitHub (merges years and replaces groups) */
  const applyConfig = useCallback((config: BudgetConfigData) => {
    const current = storeRef.current
    const mergedYears = [...new Set([...current.years, ...config.years])].sort()
    persist({
      ...current,
      years: mergedYears,
      categoryGroups: config.categoryGroups,
    })
  }, [persist])

  const yearExists = store.years.includes(selectedYear)

  return {
    store,
    selectedYear,
    setSelectedYear,
    yearExists,
    viewMode,
    setViewMode,
    uploadCSV,
    removeCSV,
    createYear: handleCreateYear,
    updateCategoryGroups: handleUpdateCategoryGroups,
    mergeCategories,
    editCategory,
    categoryHasTransactions,
    deleteCategory,
    applyConfig,
    yearTransactions,
    allCategories,
    categoryGroups,
    categorySums,
    summary,
    monthsWithData,
  }
}
