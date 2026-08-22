import { useMemo, useState, useEffect } from 'react'
import { loadBudgetStore, getGlobalCategoryGroups } from '../../budget/utils/budgetStorage'
import { parseCSV, buildMonthKey } from '../../budget/utils/csvParser'
import { useFileStore } from '../../../contexts/FileStoreContext'
import type { BudgetStore } from '../../budget/utils/budgetStorage'

const EMPTY_STORE: BudgetStore = { csvs: {}, categoryGroups: [], configs: {}, years: [] }

export function useYearMonthlySaving() {
  const currentYear = new Date().getFullYear()
  const [summaryYear, setSummaryYear] = useState(currentYear)
  const { fileStore } = useFileStore()
  const [store, setStore] = useState<BudgetStore>(EMPTY_STORE)

  useEffect(() => {
    let cancelled = false
    loadBudgetStore(fileStore)
      .then(s => {
        if (!cancelled) setStore(s)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [fileStore])

  const availableYears = useMemo(() => {
    return store.years.filter((y: number) => y >= 2024 && y <= currentYear).sort((a: number, b: number) => b - a)
  }, [store, currentYear])

  const yearMonthlySaving = useMemo(() => {
    const groups = getGlobalCategoryGroups(store)
    const removedCats = new Set(groups.find((g: { id: string }) => g.id === 'removed')?.categories || [])

    const categorySums: Record<string, number> = {}
    let monthsWithData = 0
    for (let m = 0; m < 12; m++) {
      const key = buildMonthKey(summaryYear, m)
      const csv = store.csvs[key]
      if (!csv) continue
      monthsWithData++
      try {
        const txs = parseCSV(csv.csv)
        txs.forEach((t: { category: string; amount: number }) => {
          if (removedCats.has(t.category)) return
          categorySums[t.category] = (categorySums[t.category] || 0) + t.amount
        })
      } catch {
        /* skip bad csv */
      }
    }

    if (monthsWithData === 0) return null

    const expenseCats = new Set<string>()
    const incomeCats = new Set<string>()
    Object.entries(categorySums).forEach(([cat, total]) => {
      if (total < 0) expenseCats.add(cat)
      else if (total > 0) incomeCats.add(cat)
    })

    let totalIncome = 0
    let totalExpense = 0
    Object.entries(categorySums).forEach(([cat, total]) => {
      if (incomeCats.has(cat)) totalIncome += total
      else if (expenseCats.has(cat)) totalExpense += Math.abs(total)
    })

    const annualSavings = (totalIncome - totalExpense) * (12 / monthsWithData)
    return annualSavings / 12
  }, [store, summaryYear])

  return { summaryYear, setSummaryYear, availableYears, yearMonthlySaving }
}
