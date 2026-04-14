import { FC, useState } from 'react'
import { CategoryGroup, TimePeriod } from '../types'
import { shortMonthName, buildMonthKey } from '../utils/csvParser'

interface BudgetAggregatedViewProps {
  year: number
  type: 'income' | 'expense'
  categoryGroups: CategoryGroup[]
  categorySums: Record<string, Record<string, number>>
  timePeriod: TimePeriod
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

const BudgetAggregatedView: FC<BudgetAggregatedViewProps> = ({
  year, type, categoryGroups, categorySums, timePeriod,
}) => {
  const months = Array.from({ length: 12 }, (_, i) => buildMonthKey(year, i))

  const periods: { label: string; monthKeys: string[] }[] = (() => {
    if (timePeriod === 'quarter') {
      return [
        { label: 'Q1', monthKeys: months.slice(0, 3) },
        { label: 'Q2', monthKeys: months.slice(3, 6) },
        { label: 'Q3', monthKeys: months.slice(6, 9) },
        { label: 'Q4', monthKeys: months.slice(9, 12) },
      ]
    }
    if (timePeriod === 'half') {
      return [
        { label: 'H1', monthKeys: months.slice(0, 6) },
        { label: 'H2', monthKeys: months.slice(6, 12) },
      ]
    }
    return months.map((m, i) => ({ label: shortMonthName(i), monthKeys: [m] }))
  })()

  // If a category has ANY negative month, it's an expense (positives are refunds).
  const isTypeCategory = (cat: string): boolean => {
    const monthValues = Object.values(categorySums[cat] || {})
    const hasNegative = monthValues.some(v => v < 0)
    if (type === 'expense') return hasNegative
    return !hasNegative && monthValues.some(v => v > 0)
  }

  const relevantGroups: { id: string; name: string; categories: string[] }[] = type === 'income'
    ? (() => {
        const allIncomeCats = Object.keys(categorySums).filter(c => isTypeCategory(c))
        return allIncomeCats.length > 0 ? [{ id: '__income__', name: 'Income', categories: allIncomeCats }] : []
      })()
    : categoryGroups
        .map(g => ({
          ...g,
          categories: g.categories.filter(c => isTypeCategory(c)),
        }))
        .filter(g => g.categories.length > 0)

  const getGroupPeriodTotal = (group: { categories: string[] }, period: { monthKeys: string[] }): number => {
    let total = 0
    period.monthKeys.forEach(m => {
      group.categories.forEach(cat => {
        total += (categorySums[cat]?.[m] || 0)
      })
    })
    return total
  }

  const getGroupYearTotal = (group: { categories: string[] }): number => {
    let total = 0
    months.forEach(m => {
      group.categories.forEach(cat => { total += (categorySums[cat]?.[m] || 0) })
    })
    return total
  }

  const grandTotal = (): number => {
    let total = 0
    relevantGroups.forEach(g => { total += getGroupYearTotal(g) })
    return total
  }

  const getGroupPct = (group: { categories: string[] }): string => {
    const gt = Math.abs(grandTotal())
    if (gt === 0) return ''
    return `${((Math.abs(getGroupYearTotal(group)) / gt) * 100).toFixed(1)}%`
  }

  const [showPct, setShowPct] = useState(false)

  return (
    <div className="budget-table-section">
      <h3 className="budget-table-title">{type === 'income' ? 'Income' : 'Expenses'} — Aggregated</h3>
      <div className="budget-table-wrapper">
        <table className="budget-table">
          <thead>
            <tr>
              <th className="budget-th budget-th--category">Group</th>
              {periods.map(p => (
                <th key={p.label} className="budget-th budget-th--month">{p.label}</th>
              ))}
              <th className="budget-th budget-th--total budget-th--switchable" onClick={() => setShowPct(p => !p)} title="Click to toggle Total / %">
                {showPct ? '%' : 'Total'}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...relevantGroups].sort((a, b) => a.name.localeCompare(b.name)).map(group => {
              const yearTotal = getGroupYearTotal(group)
              return (
                <tr key={group.id} className="budget-tr--agg-row">
                  <td className="budget-td budget-td--category"><strong>{group.name}</strong></td>
                  {periods.map(p => {
                    const val = getGroupPeriodTotal(group, p)
                    return (
                      <td key={p.label} className={`budget-td budget-td--number${type === 'expense' && val > 0 ? ' refund' : ''}`}>
                        {val !== 0 ? fmt(Math.abs(val)) : ''}
                      </td>
                    )
                  })}
                  <td className={`budget-td ${showPct ? 'budget-td--pct' : `budget-td--number${type === 'expense' && yearTotal > 0 ? ' refund' : ''}`}`}>
                    <strong>{showPct ? getGroupPct(group) : (yearTotal !== 0 ? fmt(Math.abs(yearTotal)) : '')}</strong>
                  </td>
                </tr>
              )
            })}
            {relevantGroups.length > 0 && (
              <tr className="budget-tr--grand-total">
                <td className="budget-td budget-td--category"><strong>Grand Total</strong></td>
                {periods.map(p => {
                  let periodTotal = 0
                  relevantGroups.forEach(g => { periodTotal += getGroupPeriodTotal(g, p) })
                  return (
                    <td key={p.label} className="budget-td budget-td--number">
                      <strong>{periodTotal !== 0 ? fmt(Math.abs(periodTotal)) : ''}</strong>
                    </td>
                  )
                })}
                <td className={`budget-td ${showPct ? 'budget-td--pct' : 'budget-td--number'}`}>
                  <strong>{showPct ? '100%' : fmt(Math.abs(grandTotal()))}</strong>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BudgetAggregatedView
