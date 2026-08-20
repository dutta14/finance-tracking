import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadBudgetStore, saveBudgetStore, saveCSVForMonth } from '../budget/utils/budgetStorage'
import { parseCSV } from '../budget/utils/csvParser'
import type { Transaction } from '../budget/types'
import type { BudgetStore } from '../budget/types'
import { useFileStore } from '../../contexts/FileStoreContext'
import '../../styles/Transactions.css'

import type { FileStore } from '../../utils/fileStoreTypes'

type LoadedTransaction = Transaction & { monthKey: string; isRemoved: boolean }
type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'category-asc' | 'category-desc'
type TransactionGroup = {
  date: string
  total: number
  transactions: LoadedTransaction[]
}
type CategoryFilterGroup = {
  id: string
  name: string
  categories: string[]
  type: 'expense' | 'income'
}
type EditingCategoryState = {
  key: string
}
type EditingDateState = {
  key: string
  value: string
}

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Highest amount' },
  { value: 'amount-asc', label: 'Lowest amount' },
  { value: 'category-asc', label: 'Category A–Z' },
  { value: 'category-desc', label: 'Category Z–A' },
]

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: 'base' })

const formatCurrency = (amount: number): string => currencyFormatter.format(amount)

const formatSignedCurrency = (amount: number): string => `${amount > 0 ? '+' : ''}${currencyFormatter.format(amount)}`

const formatDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

const escapeCsvValue = (value: string): string => `"${value.replace(/"/g, '""')}"`

const buildCsv = (transactions: Transaction[]): string => {
  const rows = transactions.map(transaction =>
    [
      escapeCsvValue(transaction.date),
      escapeCsvValue(transaction.category),
      escapeCsvValue(transaction.amount.toString()),
      escapeCsvValue(transaction.description ?? ''),
    ].join(','),
  )

  return ['Date,Category,Amount,Description', ...rows].join('\n')
}

const getTransactionDescription = (description?: string): string => description?.trim() ?? ''

const buildCategoryGroups = (
  budgetGroups: BudgetGroupData[],
  categories: string[],
  includeAllBudgetCategories: boolean,
): CategoryFilterGroup[] => {
  const availableCategories = new Set(categories)
  const assignedCategories = new Set<string>()
  const groups: CategoryFilterGroup[] = []

  budgetGroups.forEach(group => {
    const groupCategories = Array.from(new Set(group.categories))
      .filter(category => includeAllBudgetCategories || availableCategories.has(category))
      .filter(category => !assignedCategories.has(category))
      .sort(compareText)

    if (groupCategories.length === 0) return

    groupCategories.forEach(category => assignedCategories.add(category))
    groups.push({
      id: group.id,
      name: group.id === 'removed' ? 'Removed from Budget' : group.name,
      categories: groupCategories,
      type: group.type === 'income' ? 'income' : 'expense',
    })
  })

  const otherCategories = categories.filter(category => !assignedCategories.has(category))
  if (otherCategories.length > 0) {
    groups.push({
      id: '__other__',
      name: 'Other',
      categories: otherCategories,
      type: 'expense',
    })
  }

  return groups
}

type BudgetGroupData = { id: string; name: string; categories: string[]; type?: 'expense' | 'income' }

type LoadResult = {
  transactions: LoadedTransaction[]
  budgetGroups: BudgetGroupData[]
}

// Cache parsed transactions — only re-parse when CSV data actually changes
let cachedFingerprint = ''
let cachedResult: (LoadResult & { store: BudgetStore }) | null = null

const computeFingerprint = (store: {
  csvs: Record<string, { csv: string }>
  categoryGroups?: Array<{ id: string; categories: string[] }>
}): string => {
  const csvParts = Object.entries(store.csvs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.csv.length}:${v.csv.slice(0, 64)}`)
  const groupIds = (store.categoryGroups || []).map(g => `${g.id}:${g.categories.length}`)
  return csvParts.join('|') + '||' + groupIds.join('|')
}

/** @internal Reset cache — used by tests */
export const resetTransactionCache = (): void => {
  cachedFingerprint = ''
  cachedResult = null
}

const loadTransactionsAndGroups = async (fileStore: FileStore): Promise<LoadResult & { store: BudgetStore }> => {
  const store = await loadBudgetStore(fileStore)
  const fingerprint = computeFingerprint(store)

  if (cachedResult && fingerprint === cachedFingerprint) {
    return cachedResult
  }

  const groups = store.categoryGroups || []
  const removedCategories = new Set(groups.find(g => g.id === 'removed')?.categories || [])
  const allTransactions: LoadedTransaction[] = []

  Object.entries(store.csvs).forEach(([monthKey, csv]) => {
    try {
      const transactions = parseCSV(csv.csv)
      transactions.forEach(transaction => {
        allTransactions.push({
          ...transaction,
          monthKey,
          isRemoved: removedCategories.has(transaction.category),
        })
      })
    } catch {}
  })

  const budgetGroups: BudgetGroupData[] = groups.map(group => ({
    id: group.id,
    name: group.name,
    categories: group.categories,
    type: group.type,
  }))

  const result = { transactions: allTransactions, budgetGroups, store }
  cachedFingerprint = fingerprint
  cachedResult = result
  return result
}

const getEmptySummary = () => ({
  totalTransactions: 0,
  largestIncome: null as number | null,
  largestExpense: null as number | null,
  averageTransaction: null as number | null,
  totalIncome: 0,
  totalSpending: 0,
  firstTransaction: null as string | null,
  lastTransaction: null as string | null,
})

// --- DatePickerFlyout ---

type DatePickerFlyoutProps = {
  value: string
  onSelect: (date: string) => void
  onCancel: () => void
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DatePickerFlyout: FC<DatePickerFlyoutProps> = ({ value, onSelect, onCancel }) => {
  const initialDate = new Date(`${value}T00:00:00`)
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())

  const selectedDay = initialDate.getDate()
  const selectedYear = initialDate.getFullYear()
  const selectedMonth = initialDate.getMonth()

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1)
      setViewMonth(11)
    } else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1)
      setViewMonth(0)
    } else setViewMonth(m => m + 1)
  }

  const handleDayClick = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onSelect(`${viewYear}-${mm}-${dd}`)
  }

  return (
    <div
      className="txn-date-flyout"
      role="dialog"
      aria-label="Pick a date"
      onKeyDown={e => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <div className="txn-date-flyout-header">
        <button type="button" className="txn-date-flyout-nav" onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <span className="txn-date-flyout-title">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button" className="txn-date-flyout-nav" onClick={nextMonth} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="txn-date-flyout-grid">
        {DAYS_OF_WEEK.map(d => (
          <span key={d} className="txn-date-flyout-dow">
            {d}
          </span>
        ))}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const isSelected = day === selectedDay && viewMonth === selectedMonth && viewYear === selectedYear
          return (
            <button
              key={day}
              type="button"
              className={`txn-date-flyout-day${isSelected ? ' txn-date-flyout-day--selected' : ''}`}
              onClick={() => handleDayClick(day)}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const Transactions: FC = () => {
  const [searchParams] = useSearchParams()
  const paramFrom = searchParams.get('from') ?? ''
  const paramTo = searchParams.get('to') ?? ''
  const { fileStore } = useFileStore()
  const budgetStoreRef = useRef<BudgetStore>({ csvs: {}, configs: {}, years: [], categoryGroups: [] })

  const [allTransactions, setAllTransactions] = useState<LoadedTransaction[]>([])
  const [budgetGroups, setBudgetGroups] = useState<BudgetGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [draftSearchQuery, setDraftSearchQuery] = useState('')
  const [fromDate, setFromDate] = useState(paramFrom)
  const [toDate, setToDate] = useState(paramTo)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [editingCategory, setEditingCategory] = useState<EditingCategoryState | null>(null)
  const [editingDate, setEditingDate] = useState<EditingDateState | null>(null)
  const [categoryEditSearch, setCategoryEditSearch] = useState('')
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [draftFromDate, setDraftFromDate] = useState(paramFrom)
  const [draftToDate, setDraftToDate] = useState(paramTo)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [visibleCount, setVisibleCount] = useState(15)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const initialLoadDone = useRef(false)
  const allCategoriesRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const categoryEditorRef = useRef<HTMLDivElement>(null)
  const dateEditorRef = useRef<HTMLDivElement>(null)
  const groupCheckboxRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const sectionCheckboxRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const removedCategories = useMemo(
    () => new Set(budgetGroups.find(group => group.id === 'removed')?.categories ?? []),
    [budgetGroups],
  )

  const clearFilters = (): void => {
    setSearchQuery('')
    setFromDate('')
    setToDate('')
    // Reset to default: all except removed
    setSelectedCategories(new Set(categories.filter(category => !removedCategories.has(category))))
  }

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      const result = await loadTransactionsAndGroups(fileStore)
      if (cancelled) return
      budgetStoreRef.current = result.store
      setAllTransactions(result.transactions)
      setBudgetGroups(result.budgetGroups)
      setEditingCategory(null)

      if (!initialLoadDone.current) {
        initialLoadDone.current = true
        const removed = result.budgetGroups.find(g => g.id === 'removed')
        const removedSet = new Set(removed?.categories ?? [])
        const allCats = new Set(result.transactions.map(t => t.category))
        removedSet.forEach(c => allCats.delete(c))
        const urlCategories = searchParams.get('categories')?.split(',').filter(Boolean) ?? []
        setSelectedCategories(
          urlCategories.length > 0 ? new Set(urlCategories.filter(category => allCats.has(category))) : allCats,
        )
        setLoading(false)
      }
    }

    const handleRefresh = () => { refresh().catch(console.error) }

    // Defer heavy load to next frame so navigation isn't blocked
    const frameId = requestAnimationFrame(handleRefresh)
    const unsubscribe = fileStore.subscribe('budget/categories.json', handleRefresh)
    window.addEventListener('budget-changed', handleRefresh)
    window.addEventListener('storage', handleRefresh)

    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
      unsubscribe()
      window.removeEventListener('budget-changed', handleRefresh)
      window.removeEventListener('storage', handleRefresh)
    }
    // searchParams is intentionally read only on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileStore])

  useEffect(() => {
    if (!searchOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [searchOpen])

  useEffect(() => {
    if (!filterOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [filterOpen])

  useEffect(() => {
    if (!datePickerOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDatePickerOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [datePickerOpen])

  useEffect(() => {
    if (!sortOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [sortOpen])

  useEffect(() => {
    if (!editingCategory) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (categoryEditorRef.current && !categoryEditorRef.current.contains(event.target as Node)) {
        setEditingCategory(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [editingCategory])

  useEffect(() => {
    if (!editingDate) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (dateEditorRef.current && !dateEditorRef.current.contains(event.target as Node)) {
        setEditingDate(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [editingDate])

  const categories = useMemo(
    () => Array.from(new Set(allTransactions.map(transaction => transaction.category))).sort(compareText),
    [allTransactions],
  )

  useEffect(() => {
    setSelectedCategories(current => {
      const validCategories = new Set(categories)
      const next = new Set([...current].filter(c => validCategories.has(c)))
      return next.size === current.size ? current : next
    })
  }, [categories])

  const allSelected = selectedCategories.size === categories.length
  const noneSelected = selectedCategories.size === 0
  const someSelected = !allSelected && !noneSelected
  const categorySummaryLabel = allSelected
    ? 'All Categories'
    : noneSelected
      ? 'None'
      : `${selectedCategories.size} selected`

  const dateSummaryLabel =
    fromDate || toDate
      ? fromDate && toDate
        ? `${new Date(`${fromDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(`${toDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : fromDate
          ? `From ${new Date(`${fromDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : `Until ${new Date(`${toDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : null

  const openDatePicker = (): void => {
    setDraftFromDate(fromDate)
    setDraftToDate(toDate)
    setDatePickerOpen(true)
  }

  const toggleSearchPanel = (): void => {
    if (searchOpen) {
      setSearchOpen(false)
      return
    }

    setDraftSearchQuery(searchQuery)
    setSearchOpen(true)
  }

  const applySearch = (): void => {
    setSearchQuery(draftSearchQuery)
    setSearchOpen(false)
  }

  const clearSearch = (): void => {
    setDraftSearchQuery('')
    setSearchQuery('')
    setSearchOpen(false)
  }

  const applyDateRange = (): void => {
    setFromDate(draftFromDate)
    setToDate(draftToDate)
    setDatePickerOpen(false)
  }

  const applyPreset = (from: string, to: string): void => {
    setDraftFromDate(from)
    setDraftToDate(to)
  }

  const getPresets = (): Array<{ label: string; from: string; to: string }> => {
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const daysAgo = (n: number) => {
      const d = new Date(today)
      d.setDate(d.getDate() - n)
      return fmt(d)
    }
    const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    const lastMonthStart = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, '0')}-01`
    const thisYear = `${today.getFullYear()}-01-01`
    const lastYearStart = `${today.getFullYear() - 1}-01-01`
    const lastYearEnd = `${today.getFullYear() - 1}-12-31`

    return [
      { label: 'Last 7 days', from: daysAgo(7), to: fmt(today) },
      { label: 'Last 14 days', from: daysAgo(14), to: fmt(today) },
      { label: 'Last 30 days', from: daysAgo(30), to: fmt(today) },
      { label: 'This month', from: thisMonth, to: fmt(today) },
      { label: 'Last month', from: lastMonthStart, to: fmt(lastMonthEnd) },
      { label: 'This year', from: thisYear, to: fmt(today) },
      { label: 'Last year', from: lastYearStart, to: lastYearEnd },
    ]
  }

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return allTransactions.filter(transaction => {
      if (normalizedSearch) {
        const description = transaction.description?.toLowerCase() ?? ''
        const category = transaction.category.toLowerCase()
        const amount = String(transaction.amount)
        if (
          !description.includes(normalizedSearch) &&
          !category.includes(normalizedSearch) &&
          !amount.includes(normalizedSearch)
        ) {
          return false
        }
      }

      if (fromDate && transaction.date < fromDate) return false
      if (toDate && transaction.date > toDate) return false
      if (!selectedCategories.has(transaction.category)) return false

      return true
    })
  }, [allTransactions, fromDate, searchQuery, selectedCategories, toDate])

  const groupedTransactions = useMemo<TransactionGroup[]>(() => {
    const grouped = new Map<string, LoadedTransaction[]>()

    filteredTransactions.forEach(transaction => {
      const current = grouped.get(transaction.date) ?? []
      current.push(transaction)
      grouped.set(transaction.date, current)
    })

    return Array.from(grouped.entries())
      .sort(([left], [right]) => (sortBy === 'date-asc' ? left.localeCompare(right) : right.localeCompare(left)))
      .map(([date, transactions]) => {
        const sortedTransactions = [...transactions].sort((left, right) => {
          switch (sortBy) {
            case 'amount-desc':
              return right.amount - left.amount || compareText(left.category, right.category)
            case 'amount-asc':
              return left.amount - right.amount || compareText(left.category, right.category)
            case 'category-asc':
              return compareText(left.category, right.category) || right.amount - left.amount
            case 'category-desc':
              return compareText(right.category, left.category) || right.amount - left.amount
            case 'date-asc':
            case 'date-desc':
            default:
              return right.amount - left.amount || compareText(left.category, right.category)
          }
        })

        return {
          date,
          total: transactions.reduce((sum, t) => (t.isRemoved ? sum : sum + t.amount), 0),
          transactions: sortedTransactions,
        }
      })
  }, [filteredTransactions, sortBy])

  // Reset visible count when filters or sort change
  useEffect(() => {
    setVisibleCount(15)
  }, [searchQuery, fromDate, toDate, selectedCategories, sortBy])

  // Slice groups to show only `visibleCount` transactions
  const visibleGroups = useMemo(() => {
    let remaining = visibleCount
    const result: TransactionGroup[] = []
    for (const group of groupedTransactions) {
      if (remaining <= 0) break
      if (group.transactions.length <= remaining) {
        result.push(group)
        remaining -= group.transactions.length
      } else {
        result.push({ ...group, transactions: group.transactions.slice(0, remaining) })
        remaining = 0
      }
    }
    return result
  }, [groupedTransactions, visibleCount])

  const totalTransactionCount = useMemo(
    () => groupedTransactions.reduce((sum, g) => sum + g.transactions.length, 0),
    [groupedTransactions],
  )
  const hasMore = visibleCount < totalTransactionCount

  // IntersectionObserver for infinite scroll
  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 15, totalTransactionCount))
  }, [totalTransactionCount])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') {
      setDownloadUrl('')
      return
    }

    const csv = buildCsv(filteredTransactions)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    setDownloadUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [filteredTransactions])

  const summary = useMemo(() => {
    if (filteredTransactions.length === 0) return getEmptySummary()

    const active = filteredTransactions.filter(t => !t.isRemoved)
    const totalTransactions = active.length
    if (totalTransactions === 0) return getEmptySummary()

    const largestIncome = active.reduce<number | null>(
      (largest, transaction) =>
        transaction.amount > 0 && (largest === null || transaction.amount > largest) ? transaction.amount : largest,
      null,
    )
    const largestExpense = active.reduce<number | null>(
      (largest, transaction) =>
        transaction.amount < 0 && (largest === null || Math.abs(transaction.amount) > largest)
          ? Math.abs(transaction.amount)
          : largest,
      null,
    )
    const averageTransaction =
      active.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0) / totalTransactions
    const totalIncome = active.reduce(
      (sum, transaction) => (transaction.amount > 0 ? sum + transaction.amount : sum),
      0,
    )
    const totalSpending = active.reduce(
      (sum, transaction) => (transaction.amount < 0 ? sum + Math.abs(transaction.amount) : sum),
      0,
    )
    const dates = active.map(transaction => transaction.date).sort(compareText)

    return {
      totalTransactions,
      largestIncome,
      largestExpense,
      averageTransaction,
      totalIncome,
      totalSpending,
      firstTransaction: dates[0] ?? null,
      lastTransaction: dates[dates.length - 1] ?? null,
    }
  }, [filteredTransactions])

  const categoryFilterGroups = useMemo<CategoryFilterGroup[]>(() => {
    return buildCategoryGroups(budgetGroups, categories, false)
  }, [budgetGroups, categories])

  const categoryEditorGroups = useMemo<CategoryFilterGroup[]>(() => {
    const editableCategories = Array.from(
      new Set([...categories, ...budgetGroups.flatMap(group => group.categories)]),
    ).sort(compareText)

    return buildCategoryGroups(budgetGroups, editableCategories, true)
  }, [budgetGroups, categories])

  const visibleCategoryFilterGroups = useMemo(() => {
    const normalizedFilterSearch = filterSearch.trim().toLowerCase()

    return categoryFilterGroups
      .map(group => ({
        ...group,
        categories: normalizedFilterSearch
          ? group.categories.filter(category => category.toLowerCase().includes(normalizedFilterSearch))
          : group.categories,
      }))
      .filter(group => group.categories.length > 0)
  }, [categoryFilterGroups, filterSearch])

  const filterSections = useMemo(() => {
    const expenseGroups = visibleCategoryFilterGroups.filter(g => g.type === 'expense')
    const incomeGroups = visibleCategoryFilterGroups.filter(g => g.type === 'income')
    const sections: Array<{ type: 'expense' | 'income'; label: string; groups: CategoryFilterGroup[] }> = []
    if (expenseGroups.length > 0) sections.push({ type: 'expense', label: 'Expense', groups: expenseGroups })
    if (incomeGroups.length > 0) sections.push({ type: 'income', label: 'Income', groups: incomeGroups })
    return sections
  }, [visibleCategoryFilterGroups])

  const visibleCategoryEditorGroups = useMemo(() => {
    const normalizedSearch = categoryEditSearch.trim().toLowerCase()

    return categoryEditorGroups
      .map(group => ({
        ...group,
        categories: normalizedSearch
          ? group.categories.filter(category => category.toLowerCase().includes(normalizedSearch))
          : group.categories,
      }))
      .filter(group => group.categories.length > 0)
  }, [categoryEditorGroups, categoryEditSearch])

  const toggleCategory = (category: string): void => {
    setSelectedCategories(current => {
      const next = new Set(current)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const toggleCategoryGroup = (groupCategories: string[]): void => {
    if (groupCategories.length === 0) return

    setSelectedCategories(current => {
      const allInGroup = groupCategories.every(c => current.has(c))
      const next = new Set(current)
      if (allInGroup) {
        groupCategories.forEach(c => next.delete(c))
      } else {
        groupCategories.forEach(c => next.add(c))
      }
      return next
    })
  }

  useEffect(() => {
    // Set "All Categories" checkbox indeterminate state
    if (allCategoriesRef.current) {
      allCategoriesRef.current.indeterminate = someSelected
    }

    // Set section checkbox indeterminate states
    filterSections.forEach(section => {
      const checkbox = sectionCheckboxRefs.current[section.type]
      if (!checkbox) return
      const sectionCats = section.groups.flatMap(g => g.categories)
      const selectedCount = sectionCats.filter(c => selectedCategories.has(c)).length
      checkbox.indeterminate = selectedCount > 0 && selectedCount < sectionCats.length
    })

    // Set group checkbox indeterminate states
    visibleCategoryFilterGroups.forEach(group => {
      const checkbox = groupCheckboxRefs.current[group.id]
      if (!checkbox) return

      const selectedCount = group.categories.filter(c => selectedCategories.has(c)).length
      checkbox.indeterminate = selectedCount > 0 && selectedCount < group.categories.length
    })
  }, [selectedCategories, someSelected, visibleCategoryFilterGroups, filterSections])

  const openCategoryEditor = (key: string): void => {
    setCategoryEditSearch('')
    setEditingCategory(current => (current?.key === key ? null : { key }))
  }

  const reassignTransactionCategory = async (transaction: LoadedTransaction, nextCategory: string): Promise<void> => {
    if (transaction.category === nextCategory) {
      setEditingCategory(null)
      setCategoryEditSearch('')
      return
    }

    const store = budgetStoreRef.current
    const monthCsv = store.csvs[transaction.monthKey]

    if (!monthCsv) {
      setEditingCategory(null)
      setCategoryEditSearch('')
      return
    }

    const parsedTransactions = parseCSV(monthCsv.csv)
    const targetIndex = parsedTransactions.findIndex(parsedTransaction => {
      return (
        parsedTransaction.date === transaction.date &&
        parsedTransaction.amount === transaction.amount &&
        parsedTransaction.category === transaction.category &&
        getTransactionDescription(parsedTransaction.description) === getTransactionDescription(transaction.description)
      )
    })

    if (targetIndex === -1) {
      setEditingCategory(null)
      setCategoryEditSearch('')
      return
    }

    const updatedTransactions = parsedTransactions.map((parsedTransaction, index) =>
      index === targetIndex ? { ...parsedTransaction, category: nextCategory } : parsedTransaction,
    )
    const nextStore = await saveCSVForMonth(fileStore, store, transaction.monthKey, buildCsv(updatedTransactions))

    setAllTransactions(currentTransactions =>
      currentTransactions.map(currentTransaction =>
        currentTransaction === transaction
          ? {
              ...currentTransaction,
              category: nextCategory,
              isRemoved: removedCategories.has(nextCategory),
            }
          : currentTransaction,
      ),
    )
    setEditingCategory(null)
    setCategoryEditSearch('')
    budgetStoreRef.current = nextStore
    saveBudgetStore(fileStore, nextStore).catch(console.error)
  }

  async function reassignTransactionDate(transaction: LoadedTransaction, nextDate: string) {
    if (!nextDate || nextDate === transaction.date) {
      setEditingDate(null)
      return
    }

    const store = budgetStoreRef.current
    const monthCsv = store.csvs[transaction.monthKey]
    if (!monthCsv) {
      setEditingDate(null)
      return
    }

    const parsedTransactions = parseCSV(monthCsv.csv)
    const targetIndex = parsedTransactions.findIndex(parsedTransaction => {
      return (
        parsedTransaction.date === transaction.date &&
        parsedTransaction.amount === transaction.amount &&
        parsedTransaction.category === transaction.category &&
        getTransactionDescription(parsedTransaction.description) === getTransactionDescription(transaction.description)
      )
    })

    if (targetIndex === -1) {
      setEditingDate(null)
      return
    }

    const nextMonthKey = nextDate.slice(0, 7)
    let updatedStore = store

    if (nextMonthKey === transaction.monthKey) {
      // Same month — just update the date in place
      const updatedTransactions = parsedTransactions.map((parsedTransaction, index) =>
        index === targetIndex ? { ...parsedTransaction, date: nextDate } : parsedTransaction,
      )
      updatedStore = await saveCSVForMonth(fileStore, updatedStore, transaction.monthKey, buildCsv(updatedTransactions))
    } else {
      // Different month — remove from old CSV, add to new CSV
      const updatedOldTransactions = parsedTransactions.filter((_, index) => index !== targetIndex)
      updatedStore = await saveCSVForMonth(
        fileStore,
        updatedStore,
        transaction.monthKey,
        buildCsv(updatedOldTransactions),
      )

      const newMonthCsv = updatedStore.csvs[nextMonthKey]
      const newMonthTransactions = newMonthCsv ? parseCSV(newMonthCsv.csv) : []
      const movedTransaction: Transaction = {
        date: nextDate,
        category: transaction.category,
        amount: transaction.amount,
        description: transaction.description,
      }
      newMonthTransactions.push(movedTransaction)
      updatedStore = await saveCSVForMonth(fileStore, updatedStore, nextMonthKey, buildCsv(newMonthTransactions))
    }

    setAllTransactions(currentTransactions =>
      currentTransactions.map(currentTransaction =>
        currentTransaction === transaction
          ? { ...currentTransaction, date: nextDate, monthKey: nextMonthKey }
          : currentTransaction,
      ),
    )
    setEditingDate(null)
    budgetStoreRef.current = updatedStore
    saveBudgetStore(fileStore, updatedStore).catch(console.error)
  }

  if (loading) {
    return (
      <div className="txn-page">
        <header className="txn-header">
          <div className="txn-header-top">
            <div className="txn-header-title-block">
              <h1 className="txn-title">Transactions</h1>
              <p className="txn-header-meta">Loading…</p>
            </div>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className="txn-page">
      <header className="txn-header">
        <div className="txn-header-top">
          <div className="txn-header-title-block">
            <h1 className="txn-title">Transactions</h1>
            <p className="txn-header-meta">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="txn-toolbar" role="toolbar" aria-label="Transaction controls">
            <div className="txn-search" ref={searchRef}>
              <button
                className="txn-filter-btn"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                onClick={toggleSearchPanel}
              >
                <span className="txn-filter-btn-key">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>{' '}
                  Search
                </span>
                {searchQuery && <span className="txn-filter-btn-value txn-search-btn-value">{searchQuery}</span>}
              </button>
              {searchOpen && (
                <div className="txn-search-panel" role="dialog" aria-label="Search transactions">
                  <div className="txn-search-panel-body">
                    <h3 className="txn-date-panel-heading">Search</h3>
                    <input
                      type="search"
                      className="txn-search-panel-input"
                      autoFocus
                      aria-label="Search transactions"
                      placeholder="Enter a search term..."
                      value={draftSearchQuery}
                      onChange={event => setDraftSearchQuery(event.target.value)}
                    />
                  </div>
                  <div className="txn-date-panel-footer">
                    <button type="button" className="txn-date-panel-btn txn-date-panel-clear" onClick={clearSearch}>
                      Clear
                    </button>
                    <div className="txn-date-panel-actions">
                      <button type="button" className="txn-date-panel-btn" onClick={() => setSearchOpen(false)}>
                        Cancel
                      </button>
                      <button type="button" className="txn-date-panel-btn txn-date-panel-apply" onClick={applySearch}>
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="txn-date-picker" ref={datePickerRef}>
              <button
                className="txn-filter-btn"
                type="button"
                aria-haspopup="true"
                aria-expanded={datePickerOpen}
                onClick={openDatePicker}
              >
                <span className="txn-filter-btn-key">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>{' '}
                  Date
                </span>
                {dateSummaryLabel && <span className="txn-filter-btn-value">{dateSummaryLabel}</span>}
              </button>
              {datePickerOpen && (
                <div className="txn-date-panel" role="dialog" aria-label="Date range picker">
                  <div className="txn-date-panel-presets">
                    <h3 className="txn-date-panel-heading">Date Range</h3>
                    <ul className="txn-date-panel-preset-list">
                      {getPresets().map(preset => (
                        <li key={preset.label}>
                          <button
                            type="button"
                            className={`txn-date-preset-btn${draftFromDate === preset.from && draftToDate === preset.to ? ' txn-date-preset-btn--active' : ''}`}
                            onClick={() => applyPreset(preset.from, preset.to)}
                          >
                            {preset.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="txn-date-panel-custom">
                    <div className="txn-date-panel-field">
                      <div className="txn-date-panel-field-header">
                        <label htmlFor="txn-draft-from">Start date</label>
                        {draftFromDate && (
                          <button type="button" className="txn-date-clear-btn" onClick={() => setDraftFromDate('')}>
                            Clear
                          </button>
                        )}
                      </div>
                      <input
                        id="txn-draft-from"
                        type="date"
                        className="txn-date-panel-input"
                        value={draftFromDate}
                        onChange={event => setDraftFromDate(event.target.value)}
                      />
                    </div>
                    <div className="txn-date-panel-field">
                      <div className="txn-date-panel-field-header">
                        <label htmlFor="txn-draft-to">End date</label>
                        {draftToDate && (
                          <button type="button" className="txn-date-clear-btn" onClick={() => setDraftToDate('')}>
                            Clear
                          </button>
                        )}
                      </div>
                      <input
                        id="txn-draft-to"
                        type="date"
                        className="txn-date-panel-input"
                        value={draftToDate}
                        onChange={event => setDraftToDate(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="txn-date-panel-footer">
                    <button
                      type="button"
                      className="txn-date-panel-btn txn-date-panel-clear"
                      onClick={() => {
                        setDraftFromDate('')
                        setDraftToDate('')
                      }}
                    >
                      Clear
                    </button>
                    <div className="txn-date-panel-actions">
                      <button type="button" className="txn-date-panel-btn" onClick={() => setDatePickerOpen(false)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="txn-date-panel-btn txn-date-panel-apply"
                        onClick={applyDateRange}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="txn-filter" ref={filterRef}>
              <button
                className="txn-filter-btn"
                type="button"
                aria-haspopup="true"
                aria-expanded={filterOpen}
                onClick={() => {
                  setFilterOpen(current => !current)
                  setFilterSearch('')
                }}
              >
                <span className="txn-filter-btn-key">Category</span>
                <span className="txn-filter-btn-value">{categorySummaryLabel}</span>
              </button>
              {filterOpen && (
                <div className="txn-filter-panel" role="group" aria-label="Category filters">
                  <input
                    className="txn-filter-search-input"
                    type="search"
                    aria-label="Search categories"
                    placeholder="Search categories"
                    value={filterSearch}
                    onChange={event => setFilterSearch(event.target.value)}
                  />
                  {!filterSearch && categories.length > 0 && (
                    <label className="txn-filter-item txn-filter-item-all">
                      <input
                        ref={allCategoriesRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => {
                          if (allSelected || someSelected) {
                            setSelectedCategories(new Set())
                          } else {
                            setSelectedCategories(new Set(categories))
                          }
                        }}
                      />
                      <span>All Categories</span>
                    </label>
                  )}
                  <div className="txn-filter-list">
                    {filterSections.length > 0 ? (
                      filterSections.map(section => {
                        const sectionCats = section.groups.flatMap(g => g.categories)
                        const sectionChecked =
                          sectionCats.length > 0 && sectionCats.every(c => selectedCategories.has(c))

                        return (
                          <div key={section.type} className="txn-filter-section">
                            <label className="txn-filter-item txn-filter-section-header">
                              <input
                                ref={element => {
                                  sectionCheckboxRefs.current[section.type] = element
                                }}
                                type="checkbox"
                                checked={sectionChecked}
                                onChange={() => toggleCategoryGroup(sectionCats)}
                              />
                              <span>{section.label}</span>
                            </label>
                            <div className="txn-filter-section-groups">
                              {section.groups.map(group => {
                                const groupChecked = group.categories.every(c => selectedCategories.has(c))

                                return (
                                  <div key={group.id} className="txn-filter-group">
                                    <label className="txn-filter-item txn-filter-group-header">
                                      <input
                                        ref={element => {
                                          groupCheckboxRefs.current[group.id] = element
                                        }}
                                        type="checkbox"
                                        checked={groupChecked}
                                        onChange={() => toggleCategoryGroup(group.categories)}
                                      />
                                      <span>{group.name}</span>
                                    </label>
                                    <div className="txn-filter-group-categories">
                                      {group.categories.map(category => (
                                        <label key={category} className="txn-filter-item txn-filter-item-category">
                                          <input
                                            type="checkbox"
                                            checked={selectedCategories.has(category)}
                                            onChange={() => toggleCategory(category)}
                                          />
                                          <span>{category}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="txn-filter-empty">No matching categories</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="txn-sort" ref={sortRef}>
              <button
                className="txn-filter-btn"
                type="button"
                aria-haspopup="true"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen(current => !current)}
              >
                <span className="txn-filter-btn-key">Sort</span>
                <span className="txn-filter-btn-value">{sortOptions.find(o => o.value === sortBy)?.label}</span>
              </button>
              {sortOpen && (
                <ul className="txn-sort-panel" role="listbox" aria-label="Sort options">
                  {sortOptions.map(option => (
                    <li key={option.value} role="option" aria-selected={sortBy === option.value}>
                      <button
                        type="button"
                        className={`txn-sort-option${sortBy === option.value ? ' txn-sort-option--active' : ''}`}
                        onClick={() => {
                          setSortBy(option.value)
                          setSortOpen(false)
                        }}
                      >
                        {option.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="txn-layout">
        <section className="txn-list" aria-label="All transactions">
          {allTransactions.length === 0 ? (
            <div className="txn-empty-state">
              <h2 className="txn-empty-title">No transactions yet</h2>
              <p className="txn-empty-copy">Import a monthly CSV on the Budget page to see transactions here.</p>
            </div>
          ) : groupedTransactions.length > 0 ? (
            <>
              {visibleGroups.map(group => (
                <section key={group.date} className="txn-group" aria-labelledby={`txn-group-${group.date}`}>
                  <div className="txn-group-header">
                    <h2 id={`txn-group-${group.date}`} className="txn-group-title">
                      {formatDate(group.date)}
                    </h2>
                    <span className={`txn-group-total${group.total > 0 ? ' txn-amount-positive' : ''}`}>
                      {formatSignedCurrency(group.total)}
                    </span>
                  </div>
                  <ul className="txn-group-list">
                    {group.transactions.map((transaction, index) => {
                      const description = transaction.description?.trim() || 'No description'
                      const rowKey = `${transaction.monthKey}-${transaction.date}-${transaction.category}-${transaction.amount}-${description}-${index}`
                      const isEditingCategory = editingCategory?.key === rowKey
                      const isEditingDateRow = editingDate?.key === rowKey

                      return (
                        <li key={rowKey} className={`txn-row${transaction.isRemoved ? ' txn-row--removed' : ''}`}>
                          <span className="txn-row-description" title={description}>
                            {description}
                          </span>
                          <div className="txn-row-date-cell" ref={isEditingDateRow ? dateEditorRef : undefined}>
                            <button
                              type="button"
                              className={`txn-row-date-button${isEditingDateRow ? ' txn-row-date-button--active' : ''}`}
                              aria-label={`Edit date for ${description}`}
                              onClick={() =>
                                isEditingDateRow
                                  ? setEditingDate(null)
                                  : setEditingDate({ key: rowKey, value: transaction.date })
                              }
                            >
                              {new Date(`${transaction.date}T00:00:00`).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </button>
                            {isEditingDateRow && (
                              <DatePickerFlyout
                                value={editingDate.value}
                                onSelect={nextDate => reassignTransactionDate(transaction, nextDate)}
                                onCancel={() => setEditingDate(null)}
                              />
                            )}
                          </div>
                          <div
                            className={`txn-row-category-cell${isEditingCategory ? ' txn-row-category-cell--open' : ''}`}
                            ref={isEditingCategory ? categoryEditorRef : undefined}
                          >
                            <button
                              type="button"
                              className="txn-row-category txn-row-category-button"
                              aria-haspopup="dialog"
                              aria-expanded={isEditingCategory}
                              aria-label={`Edit category for ${description}`}
                              onClick={() => openCategoryEditor(rowKey)}
                            >
                              <span className="txn-row-category-text">{transaction.category || 'Uncategorized'}</span>
                              <span className="txn-row-category-edit-icon" aria-hidden="true">
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="m6 9 6 6 6-6" />
                                </svg>
                              </span>
                            </button>
                            {isEditingCategory && (
                              <div
                                className="txn-category-editor"
                                role="dialog"
                                aria-label={`Edit category for ${description}`}
                              >
                                <input
                                  className="txn-category-editor-search-input"
                                  type="search"
                                  aria-label="Search categories"
                                  placeholder="Search categories"
                                  value={categoryEditSearch}
                                  onChange={event => setCategoryEditSearch(event.target.value)}
                                  autoFocus
                                />
                                <div className="txn-category-editor-list">
                                  {visibleCategoryEditorGroups.length > 0 ? (
                                    visibleCategoryEditorGroups.map(categoryGroup => (
                                      <div key={categoryGroup.id} className="txn-category-editor-group">
                                        <div className="txn-category-editor-group-title">{categoryGroup.name}</div>
                                        <div className="txn-category-editor-group-options">
                                          {categoryGroup.categories.map(category => (
                                            <button
                                              key={category}
                                              type="button"
                                              className={`txn-category-editor-option${category === transaction.category ? ' txn-category-editor-option--active' : ''}`}
                                              onClick={() => reassignTransactionCategory(transaction, category)}
                                            >
                                              {category}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="txn-category-editor-empty">No matching categories</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <span className={`txn-row-amount${transaction.amount > 0 ? ' txn-amount-positive' : ''}`}>
                            {formatSignedCurrency(transaction.amount)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
              {hasMore && <div ref={sentinelRef} className="txn-scroll-sentinel" aria-hidden="true" />}
            </>
          ) : (
            <div className="txn-empty-state">
              <h2 className="txn-empty-title">No matching transactions</h2>
              <p className="txn-empty-copy">Try a different search or clear your filters.</p>
              <button className="txn-clear-button" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </section>

        <aside className="txn-summary" aria-labelledby="txn-summary-title">
          <div className="txn-summary-card">
            <div className="txn-summary-header">
              <h2 id="txn-summary-title" className="txn-summary-title">
                Summary
              </h2>
              <a
                className="txn-download-link"
                href={downloadUrl}
                download={`transactions-${new Date().toISOString().slice(0, 10)}.csv`}
              >
                Download CSV
              </a>
            </div>
            <dl className="txn-summary-list">
              <div className="txn-summary-item">
                <dt>Total transactions</dt>
                <dd>{summary.totalTransactions}</dd>
              </div>
              <div className="txn-summary-item">
                <dt>Largest income</dt>
                <dd className={summary.largestIncome !== null ? 'txn-amount-positive' : ''}>
                  {summary.largestIncome !== null ? formatSignedCurrency(summary.largestIncome) : '—'}
                </dd>
              </div>
              <div className="txn-summary-item">
                <dt>Largest expense</dt>
                <dd>{summary.largestExpense !== null ? formatCurrency(summary.largestExpense) : '—'}</dd>
              </div>
              <div className="txn-summary-item">
                <dt>Average transaction</dt>
                <dd className={summary.averageTransaction !== null ? 'txn-amount-positive' : ''}>
                  {summary.averageTransaction !== null ? formatCurrency(summary.averageTransaction) : '—'}
                </dd>
              </div>
              <div className="txn-summary-item">
                <dt>First transaction</dt>
                <dd>{summary.firstTransaction ? formatDate(summary.firstTransaction) : '—'}</dd>
              </div>
              <div className="txn-summary-item">
                <dt>Last transaction</dt>
                <dd>{summary.lastTransaction ? formatDate(summary.lastTransaction) : '—'}</dd>
              </div>
              <div className="txn-summary-item">
                <dt>Total income</dt>
                <dd className={summary.totalIncome > 0 ? 'txn-amount-positive' : ''}>
                  {formatCurrency(summary.totalIncome)}
                </dd>
              </div>
              <div className="txn-summary-item">
                <dt>Total spending</dt>
                <dd>{formatCurrency(summary.totalSpending)}</dd>
              </div>
              <div className="txn-summary-item txn-summary-item--net">
                <dt>{summary.totalIncome >= summary.totalSpending ? 'Net income' : 'Net spending'}</dt>
                <dd>{formatCurrency(Math.abs(summary.totalSpending - summary.totalIncome))}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Transactions
