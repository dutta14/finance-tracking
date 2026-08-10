import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { BudgetStore, Transaction, CategoryGroup, BudgetViewMode, BudgetConfigData, SpreadsheetMode } from '../types'
import {
  loadBudgetStore,
  saveBudgetStore,
  saveCSVForMonth,
  deleteCSVForMonth,
  createYear,
  getGlobalCategoryGroups,
  getExpenseGroups,
  getIncomeGroups,
  updateGlobalCategoryGroups,
  saveBudgetSummary,
} from '../utils/budgetStorage'
import { parseCSV, buildMonthKey, parseCSVLine, getValidLineIndices } from '../utils/csvParser'

const OTHERS_GROUP_ID = 'others'
const REMOVED_GROUP_ID = 'removed'
const INCOME_OTHERS_GROUP_ID = 'income-others'

const addCategoriesToGroup = (groups: CategoryGroup[], groupId: string, categories: string[]): CategoryGroup[] => {
  if (categories.length === 0) return groups

  const dedupedCategories = [...new Set(categories)]
  const targetGroup = groups.find(g => g.id === groupId)
  if (targetGroup) {
    return groups.map(g => (g.id === groupId ? { ...g, categories: [...g.categories, ...dedupedCategories] } : g))
  }

  return [
    ...groups,
    {
      id: groupId,
      name: 'Others',
      categories: dedupedCategories,
      ...(groupId === INCOME_OTHERS_GROUP_ID ? { type: 'income' } : {}),
    },
  ]
}

const mergeGroupsByType = (
  storeGroups: CategoryGroup[],
  nextGroups: CategoryGroup[],
  type: 'expense' | 'income',
): CategoryGroup[] => {
  const otherGroups = storeGroups.filter(group =>
    type === 'income' ? group.type !== 'income' : group.type === 'income',
  )
  return type === 'income'
    ? [...getExpenseGroups(otherGroups), ...nextGroups]
    : [...nextGroups, ...getIncomeGroups(otherGroups)]
}

const updateMergedGroups = (groups: CategoryGroup[], sourceSet: Set<string>, targetName: string): CategoryGroup[] => {
  const targetGroupId = groups.find(g => g.categories.includes(targetName))?.id

  return groups.map(g => {
    const hasSources = g.categories.some(c => sourceSet.has(c))
    const hasTarget = g.categories.includes(targetName)
    if (!hasSources && !hasTarget) return g

    let categories = g.categories.filter(c => !sourceSet.has(c))
    if (hasSources && !hasTarget && !targetGroupId) {
      categories = [...categories, targetName]
    }

    return { ...g, categories: [...new Set(categories)] }
  })
}

export function useBudget() {
  const [store, setStore] = useState<BudgetStore>(loadBudgetStore)
  const storeRef = useRef(store)
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
  const [viewMode, setViewMode] = useState<BudgetViewMode>('spreadsheet')
  const [spreadsheetMode, setSpreadsheetMode] = useState<SpreadsheetMode>('detailed')

  const persist = useCallback((next: BudgetStore) => {
    storeRef.current = next
    setStore(next)
    saveBudgetStore(next)
  }, [])

  useEffect(() => {
    if (!store.years.includes(selectedYear)) {
      persist(createYear(storeRef.current, selectedYear))
    }
  }, [selectedYear, store.years, persist])

  const uploadCSV = useCallback(
    (
      monthKey: string,
      csvText: string,
    ): { ok: boolean; error?: string; transactions?: Transaction[]; newCategories?: string[] } => {
      try {
        const transactions = parseCSV(csvText)
        if (transactions.length === 0) {
          return { ok: false, error: 'No valid transactions found. Check CSV format.' }
        }
        let next = saveCSVForMonth(storeRef.current, monthKey, csvText)

        // Discover new categories and add them to the right "Others" group if not already grouped
        const currentGroups = getExpenseGroups(next.categoryGroups || [])
        const currentIncomeGroups = getIncomeGroups(next.categoryGroups || [])
        const allGroupedCategories = new Set((next.categoryGroups || []).flatMap(group => group.categories))
        const newCategoryTypes = new Map<string, 'expense' | 'income'>()

        transactions.forEach(transaction => {
          if (allGroupedCategories.has(transaction.category)) return
          if (transaction.amount < 0) {
            newCategoryTypes.set(transaction.category, 'expense')
            return
          }
          if (transaction.amount > 0 && !newCategoryTypes.has(transaction.category)) {
            newCategoryTypes.set(transaction.category, 'income')
          }
        })

        const newExpenseCategories = [...newCategoryTypes.entries()]
          .filter(([, type]) => type === 'expense')
          .map(([category]) => category)
        const newIncomeCategories = [...newCategoryTypes.entries()]
          .filter(([, type]) => type === 'income')
          .map(([category]) => category)
        const newCategories = [...newExpenseCategories, ...newIncomeCategories]

        if (newExpenseCategories.length > 0) {
          const expenseGroups = addCategoriesToGroup(currentGroups, OTHERS_GROUP_ID, newExpenseCategories)
          next = updateGlobalCategoryGroups(
            next,
            mergeGroupsByType(next.categoryGroups || [], expenseGroups, 'expense'),
          )
        }
        if (newIncomeCategories.length > 0) {
          const incomeGroups = addCategoriesToGroup(
            currentIncomeGroups,
            INCOME_OTHERS_GROUP_ID,
            newIncomeCategories,
          ).map(group => ({ ...group, type: 'income' as const }))
          next = updateGlobalCategoryGroups(next, mergeGroupsByType(next.categoryGroups || [], incomeGroups, 'income'))
        }

        persist(next)
        return { ok: true, transactions, newCategories }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Failed to parse CSV' }
      }
    },
    [persist],
  )

  const addTransaction = useCallback(
    (monthKey: string, csvLine: string) => {
      const current = storeRef.current
      const existing = current.csvs[monthKey]
      let updatedCsv: string
      if (existing) {
        const base = existing.csv.endsWith('\n') ? existing.csv : existing.csv + '\n'
        updatedCsv = base + csvLine
      } else {
        updatedCsv = 'Date,Category,Amount,Description\n' + csvLine
      }
      return uploadCSV(monthKey, updatedCsv)
    },
    [uploadCSV],
  )

  const removeCSV = useCallback(
    (monthKey: string) => {
      persist(deleteCSVForMonth(storeRef.current, monthKey))
    },
    [persist],
  )

  const handleCreateYear = useCallback(
    (year: number) => {
      persist(createYear(storeRef.current, year))
      setSelectedYear(year)
    },
    [persist],
  )

  const handleUpdateCategoryGroups = useCallback(
    (groups: CategoryGroup[]) => {
      persist(
        updateGlobalCategoryGroups(
          storeRef.current,
          mergeGroupsByType(storeRef.current.categoryGroups || [], groups, 'expense'),
        ),
      )
    },
    [persist],
  )

  const handleUpdateIncomeCategoryGroups = useCallback(
    (groups: CategoryGroup[]) => {
      persist(
        updateGlobalCategoryGroups(
          storeRef.current,
          mergeGroupsByType(
            storeRef.current.categoryGroups || [],
            groups.map(group => ({ ...group, type: 'income' as const })),
            'income',
          ),
        ),
      )
    },
    [persist],
  )

  /** Edit a single transaction's category in the raw CSV */
  const editCategory = useCallback(
    (monthKey: string, transactionIdx: number, newCategory: string) => {
      const current = storeRef.current
      const csvData = current.csvs[monthKey]
      if (!csvData) return

      const lines = csvData.csv.split(/\r?\n/)
      if (lines.length < 2) return
      const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
      const catIdx = headers.findIndex(h => h === 'category')
      const amountIdx = headers.findIndex(h => h === 'amount')
      if (catIdx === -1) return

      // Map parsed-transaction index to actual CSV line number
      const lineIndices = getValidLineIndices(csvData.csv)
      if (transactionIdx < 0 || transactionIdx >= lineIndices.length) return
      const targetLineIdx = lineIndices[transactionIdx]

      const fields = parseCSVLine(lines[targetLineIdx])
      if (catIdx >= fields.length) return
      fields[catIdx] = newCategory
      // Rebuild line, quoting fields that contain commas or quotes
      lines[targetLineIdx] = fields
        .map(f => (f.includes(',') || f.includes('"') ? '"' + f.replace(/"/g, '""') + '"' : f))
        .join(',')

      const newCsv = lines.join('\n')
      let next: BudgetStore = {
        ...current,
        csvs: { ...current.csvs, [monthKey]: { ...csvData, csv: newCsv } },
      }

      // If new category isn't in any group, add it to "Others"
      const groups = getExpenseGroups(next.categoryGroups || [])
      const incomeGroups = getIncomeGroups(next.categoryGroups || [])
      const allGrouped = new Set((next.categoryGroups || []).flatMap(group => group.categories))
      if (!allGrouped.has(newCategory)) {
        const amount = amountIdx >= 0 ? Number.parseFloat(fields[amountIdx]) : 0
        if (amount < 0) {
          next = updateGlobalCategoryGroups(
            next,
            mergeGroupsByType(
              next.categoryGroups || [],
              addCategoriesToGroup(groups, OTHERS_GROUP_ID, [newCategory]),
              'expense',
            ),
          )
        } else if (amount > 0) {
          next = updateGlobalCategoryGroups(
            next,
            mergeGroupsByType(
              next.categoryGroups || [],
              addCategoriesToGroup(incomeGroups, INCOME_OTHERS_GROUP_ID, [newCategory]).map(group => ({
                ...group,
                type: 'income' as const,
              })),
              'income',
            ),
          )
        }
      }

      persist(next)
    },
    [persist],
  )

  /** Merge multiple categories into one: rewrites all CSV data and updates groups */
  const mergeCategories = useCallback(
    (sourceCategories: string[], targetName: string) => {
      const current = storeRef.current
      const sourceSet = new Set(sourceCategories.filter(c => c !== targetName))
      if (sourceSet.size === 0) return

      // Rewrite CSV texts: replace source category names with target
      const newCsvs = { ...current.csvs }
      Object.entries(newCsvs).forEach(([key, csvData]) => {
        const lines = csvData.csv.split(/\r?\n/)
        if (lines.length < 2) return
        const headers = lines[0]
          .toLowerCase()
          .split(',')
          .map(h => h.trim())
        const catIdx = headers.findIndex(h => h === 'category')
        if (catIdx === -1) return

        let changed = false
        const newLines = [lines[0]]
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]
          if (!line.trim()) {
            newLines.push(line)
            continue
          }
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

      // Update groups in both sections: remove source categories; target stays in its original group only
      const expenseGroups = getExpenseGroups(current.categoryGroups || [])
      const incomeGroups = getIncomeGroups(current.categoryGroups || [])

      persist({
        ...current,
        csvs: newCsvs,
        categoryGroups: [
          ...updateMergedGroups(expenseGroups, sourceSet, targetName),
          ...updateMergedGroups(incomeGroups, sourceSet, targetName).map(group => ({
            ...group,
            type: 'income' as const,
          })),
        ],
      })
    },
    [persist],
  )

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
  const deleteCategory = useCallback(
    (category: string) => {
      const current = storeRef.current
      const groups = getExpenseGroups(current.categoryGroups || [])
      const incomeGroups = getIncomeGroups(current.categoryGroups || [])
      const updated = groups.map(g => ({
        ...g,
        categories: g.categories.filter(c => c !== category),
      }))
      const updatedIncomeGroups = incomeGroups.map(g => ({
        ...g,
        categories: g.categories.filter(c => c !== category),
      }))
      persist({
        ...updateGlobalCategoryGroups(current, [
          ...updated,
          ...updatedIncomeGroups.map(group => ({ ...group, type: 'income' as const })),
        ]),
      })
    },
    [persist],
  )

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

  const incomeCategoryGroups = useMemo((): CategoryGroup[] => {
    return getIncomeGroups(store.categoryGroups || [])
  }, [store])

  // Migrate: seed existing income categories into income-others if not already grouped
  useEffect(() => {
    // Classify: any month with negative value = expense, purely positive = income
    const catHasNegative = new Map<string, boolean>()
    const catHasPositive = new Map<string, boolean>()
    Object.values(yearTransactions).forEach(txs =>
      txs.forEach(t => {
        if (t.amount < 0) catHasNegative.set(t.category, true)
        if (t.amount > 0) catHasPositive.set(t.category, true)
      }),
    )
    const allIncomeCats = new Set<string>()
    catHasPositive.forEach((_, cat) => {
      if (!catHasNegative.get(cat)) allIncomeCats.add(cat)
    })

    const alreadyGrouped = new Set(incomeCategoryGroups.flatMap(g => g.categories))
    const missing = [...allIncomeCats].filter(c => !alreadyGrouped.has(c))

    if (missing.length > 0) {
      const updatedIncomeGroups = incomeCategoryGroups.map(g =>
        g.id === INCOME_OTHERS_GROUP_ID
          ? { ...g, categories: [...g.categories, ...missing], type: 'income' as const }
          : g,
      )
      persist(
        updateGlobalCategoryGroups(
          storeRef.current,
          mergeGroupsByType(storeRef.current.categoryGroups || [], updatedIncomeGroups, 'income'),
        ),
      )
    }
    // Only run when yearTransactions changes (on year switch or CSV upload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearTransactions])

  // Categories in the "Remove from Budget" group
  const removedCategories = useMemo((): Set<string> => {
    const removedGroup = categoryGroups.find(g => g.id === REMOVED_GROUP_ID)
    return new Set(removedGroup?.categories || [])
  }, [categoryGroups])

  const incomeRemovedCategories = useMemo((): Set<string> => {
    const removedGroup = incomeCategoryGroups.find(g => g.id === REMOVED_GROUP_ID)
    return new Set(removedGroup?.categories || [])
  }, [incomeCategoryGroups])

  const allRemovedCategories = useMemo(
    () => new Set([...removedCategories, ...incomeRemovedCategories]),
    [removedCategories, incomeRemovedCategories],
  )

  // Compute per-category per-month sums (excluding removed categories)
  const categorySums = useMemo((): Record<string, Record<string, number>> => {
    const sums: Record<string, Record<string, number>> = {}
    Object.entries(yearTransactions).forEach(([monthKey, txs]) => {
      txs.forEach(t => {
        if (allRemovedCategories.has(t.category)) return
        if (!sums[t.category]) sums[t.category] = {}
        sums[t.category][monthKey] = (sums[t.category][monthKey] || 0) + t.amount
      })
    })
    return sums
  }, [yearTransactions, allRemovedCategories])

  // Summary totals — use income group membership as source of truth.
  // If a category is explicitly in an income group, it's income regardless of amount sign.
  const incomeCatSet = useMemo(
    () => new Set(incomeCategoryGroups.flatMap(g => (g.id !== REMOVED_GROUP_ID ? g.categories : []))),
    [incomeCategoryGroups],
  )

  const summary = useMemo(() => {
    let totalIncome = 0
    let totalExpense = 0
    Object.entries(categorySums).forEach(([cat, monthMap]) => {
      const total = Object.values(monthMap).reduce((s, v) => s + v, 0)
      if (incomeCatSet.has(cat)) totalIncome += total
      else totalExpense += total // negative amounts = spending, positive = reimbursements
    })

    // totalExpense is typically negative (spending); flip sign for display
    const absExpense = Math.abs(totalExpense)
    const saveRate = totalIncome > 0 ? 1 - absExpense / totalIncome : 0
    return { totalIncome, totalExpense: absExpense, saveRate }
  }, [categorySums, incomeCatSet])

  // Which months have data
  const monthsWithData = useMemo((): Set<string> => {
    const keys = new Set<string>()
    for (let m = 0; m < 12; m++) {
      const key = buildMonthKey(selectedYear, m)
      if (store.csvs[key]) keys.add(key)
    }
    return keys
  }, [store.csvs, selectedYear])

  // Persist summary so other pages (Goals) can read savings data without this hook
  useEffect(() => {
    const annualSavings =
      monthsWithData.size > 0 ? (summary.totalIncome - summary.totalExpense) * (12 / monthsWithData.size) : 0
    saveBudgetSummary({ annualSavings, saveRate: summary.saveRate, monthsOfData: monthsWithData.size })
  }, [summary, monthsWithData])

  const years = store.years

  /** Apply config pulled from GitHub (merges years and replaces groups) */
  const applyConfig = useCallback(
    (config: BudgetConfigData) => {
      const current = storeRef.current
      const mergedYears = [...new Set([...current.years, ...config.years])].sort()
      persist({
        ...current,
        years: mergedYears,
        categoryGroups: config.categoryGroups,
      })
    },
    [persist],
  )

  return {
    store,
    years,
    selectedYear,
    setSelectedYear,
    viewMode,
    setViewMode,
    spreadsheetMode,
    setSpreadsheetMode,
    uploadCSV,
    removeCSV,
    addTransaction,
    createYear: handleCreateYear,
    updateCategoryGroups: handleUpdateCategoryGroups,
    updateIncomeCategoryGroups: handleUpdateIncomeCategoryGroups,
    mergeCategories,
    editCategory,
    categoryHasTransactions,
    deleteCategory,
    applyConfig,
    yearTransactions,
    allCategories,
    categoryGroups,
    incomeCategoryGroups,
    removedCategories,
    incomeRemovedCategories,
    incomeCatSet,
    categorySums,
    summary,
    monthsWithData,
  }
}
