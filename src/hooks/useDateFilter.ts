import { useState, useMemo } from 'react'

export type DateFilter = 'all' | 'ytd' | 'last-12' | 'eoy' | 'custom'

export const DATE_FILTER_OPTIONS: { key: DateFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ytd', label: 'YTD' },
  { key: 'last-12', label: 'Last 12 mo' },
  { key: 'eoy', label: 'Year-End' },
  { key: 'custom', label: 'Custom' },
]

export interface UseDateFilterResult {
  dateFilter: DateFilter
  setDateFilter: (f: DateFilter) => void
  customFrom: string
  customTo: string
  setCustomFrom: (month: string) => void
  setCustomTo: (month: string) => void
  setCustomMonth: (which: 'from' | 'to', part: 'year' | 'month', value: string) => void
  filteredMonths: string[]
  availableYears: string[]
  monthOptions: { val: string; label: string }[]
}

export function useDateFilter(allMonths: string[], defaultFilter: DateFilter = 'all'): UseDateFilterResult {
  const [dateFilter, setDateFilter] = useState<DateFilter>(defaultFilter)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const availableYears = useMemo(() => {
    const years = new Set(allMonths.map(m => m.slice(0, 4)))
    return [...years].sort()
  }, [allMonths])

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const val = String(i + 1).padStart(2, '0')
        const label = new Date(2000, i).toLocaleString('default', { month: 'short' })
        return { val, label }
      }),
    [],
  )

  const setCustomMonth = (which: 'from' | 'to', part: 'year' | 'month', value: string) => {
    const setter = which === 'from' ? setCustomFrom : setCustomTo
    const current = which === 'from' ? customFrom : customTo
    const [y, m] = current ? current.split('-') : ['', '']
    if (part === 'year') setter(value ? `${value}-${m || '01'}` : '')
    else setter(y ? `${y}-${value}` : '')
  }

  const filteredMonths = useMemo(() => {
    const ascending = [...allMonths].reverse()
    if (dateFilter === 'all') return ascending
    const now = new Date()
    const yr = now.getFullYear().toString()
    const cur = `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`
    switch (dateFilter) {
      case 'ytd':
        return ascending.filter(m => m >= `${yr}-01` && m <= cur)
      case 'last-12':
        return ascending.slice(-12)
      case 'eoy':
        return ascending.filter(m => m.endsWith('-12'))
      case 'custom':
        return ascending.filter(m => (!customFrom || m >= customFrom) && (!customTo || m <= customTo))
      default:
        return ascending
    }
  }, [dateFilter, allMonths, customFrom, customTo])

  return { dateFilter, setDateFilter, customFrom, customTo, setCustomFrom, setCustomTo, setCustomMonth, filteredMonths, availableYears, monthOptions }
}
