import React, { FC, useMemo, useState } from 'react'
import { ProjectionRow } from '../utils/lifecycleProjection'

const dollars = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

type ViewInterval = 'monthly' | 'yearly' | '5year' | '10year'

interface LifecycleTableProps {
  rows: ProjectionRow[]
  interval: ViewInterval
}

const LifecycleTable: FC<LifecycleTableProps> = ({ rows, interval }) => {
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())

  const groupedByYear = useMemo(() => {
    if (interval !== 'monthly') return null
    const groups = new Map<string, ProjectionRow[]>()
    rows.forEach(row => {
      const year = row.month.split(' ')[1]
      if (!groups.has(year)) groups.set(year, [])
      groups.get(year)!.push(row)
    })
    return groups
  }, [rows, interval])

  const toggleYearExpand = (year: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  const allYears = groupedByYear ? Array.from(groupedByYear.keys()) : []
  const allExpanded = allYears.length > 0 && allYears.every(y => expandedYears.has(y))

  const toggleAll = () => {
    if (allExpanded) setExpandedYears(new Set())
    else setExpandedYears(new Set(allYears))
  }

  const expenseLabel =
    interval === 'monthly'
      ? 'Monthly Expense'
      : interval === 'yearly'
        ? 'Yearly Expense'
        : interval === '5year'
          ? '5-Year Expense'
          : '10-Year Expense'

  const renderRateShift = (prev: ProjectionRow | null, row: ProjectionRow) => {
    if (
      prev &&
      prev.growthRate !== undefined &&
      row.growthRate !== undefined &&
      prev.growthRate !== row.growthRate
    ) {
      return (
        <tr key={`rate-shift-${row.month}`} className="projection-rate-shift-row">
          <td colSpan={4}>
            <span className="projection-rate-shift-label">
              Growth rate: {prev.growthRate}% → {row.growthRate}%
            </span>
          </td>
        </tr>
      )
    }
    return null
  }

  const renderRow = (row: ProjectionRow) => (
    <tr key={row.month} className={row.remaining < 0 ? 'projection-row--negative' : ''}>
      <td>{row.month}</td>
      <td className={`phase-badge phase-badge--${row.phase}`}>
        {row.phase === 'accumulation' ? 'Saving' : 'Spending'}
      </td>
      <td>{row.phase === 'drawdown' ? dollars(row.expense) : '—'}</td>
      <td>{dollars(row.remaining)}</td>
    </tr>
  )

  return (
    <div className="projection-table-wrapper">
      <table className="projection-table" aria-label="Lifecycle projection data">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Phase</th>
            <th scope="col">{expenseLabel}</th>
            <th scope="col">Portfolio Balance</th>
          </tr>
        </thead>
        <tbody>
          {interval === 'monthly' && groupedByYear && (
            <tr className="projection-expand-all-row">
              <td colSpan={4}>
                <button className="projection-expand-all-btn" onClick={toggleAll} aria-label={allExpanded ? 'Collapse all years' : 'Expand all years'}>
                  {allExpanded ? 'Collapse All' : 'Expand All'}
                </button>
              </td>
            </tr>
          )}
          {interval === 'monthly' && groupedByYear
            ? Array.from(groupedByYear.entries()).flatMap(([year, yearRows], yearIdx, yearEntries) => {
                const prevYearRows = yearIdx > 0 ? yearEntries[yearIdx - 1][1] : null
                const lastRowOfPrevYear = prevYearRows ? prevYearRows[prevYearRows.length - 1] : null
                return [
                  <tr key={`year-${year}`} className="projection-year-header">
                    <td colSpan={4}>
                      <button
                        className="projection-year-toggle"
                        onClick={() => toggleYearExpand(year)}
                        aria-expanded={expandedYears.has(year)}
                      >
                        <svg
                          className="projection-year-chevron"
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          {expandedYears.has(year) ? (
                            <path
                              d="M3.5 10.5L8 6l4.5 4.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ) : (
                            <path
                              d="M12.5 5.5L8 10l-4.5-4.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </svg>
                        {year}
                      </button>
                    </td>
                  </tr>,
                  ...(expandedYears.has(year)
                    ? yearRows.flatMap((row, idx) => {
                        const prev = idx > 0 ? yearRows[idx - 1] : lastRowOfPrevYear
                        const elements: React.JSX.Element[] = []
                        const shift = renderRateShift(prev, row)
                        if (shift) elements.push(shift)
                        elements.push(renderRow(row))
                        return elements
                      })
                    : []),
                ]
              })
            : rows.flatMap((row, idx) => {
                const prev = idx > 0 ? rows[idx - 1] : null
                const elements: React.JSX.Element[] = []
                const shift = renderRateShift(prev, row)
                if (shift) elements.push(shift)
                elements.push(renderRow(row))
                return elements
              })}
        </tbody>
      </table>
    </div>
  )
}

export default LifecycleTable
