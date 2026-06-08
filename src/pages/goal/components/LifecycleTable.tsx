import React, { FC } from 'react'
import { ProjectionRow } from '../utils/lifecycleProjection'

const dollars = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

type ViewInterval = 'monthly' | 'yearly' | '5year' | '10year'

interface LifecycleTableProps {
  rows: ProjectionRow[]
  interval: ViewInterval
  primaryAccessDate?: Date
  partnerAccessDate?: Date
}

const LifecycleTable: FC<LifecycleTableProps> = ({ rows, interval, primaryAccessDate, partnerAccessDate }) => {
  // Order retirement columns by which unlocks first
  const primaryFirst = !partnerAccessDate || (primaryAccessDate && primaryAccessDate <= partnerAccessDate)
  const expenseLabel =
    interval === 'monthly'
      ? 'Monthly Expense'
      : interval === 'yearly'
        ? 'Yearly Expense'
        : interval === '5year'
          ? '5-Year Expense'
          : '10-Year Expense'

  const hasBreakdown = rows.some(r => r.retirementPrimary !== undefined)

  const renderMilestoneRows = (prev: ProjectionRow | null, row: ProjectionRow) => {
    const milestones: React.JSX.Element[] = []
    if (prev && prev.growthRate !== undefined && row.growthRate !== undefined && prev.growthRate !== row.growthRate) {
      milestones.push(
        <tr key={`rate-shift-${row.month}`} className="projection-rate-shift-row">
          <td colSpan={hasBreakdown ? 7 : 4}>
            <span className="projection-rate-shift-label">
              Growth rate: {prev.growthRate}% → {row.growthRate}%
            </span>
          </td>
        </tr>,
      )
    }
    if (prev && prev.primaryLocked && !row.primaryLocked) {
      milestones.push(
        <tr key={`unlock-primary-${row.month}`} className="projection-rate-shift-row projection-unlock-row">
          <td colSpan={hasBreakdown ? 7 : 4}>
            <span className="projection-rate-shift-label">🔓 Primary Retirement unlocked</span>
          </td>
        </tr>,
      )
    }
    if (prev && prev.phase === 'accumulation' && row.phase === 'drawdown') {
      milestones.push(
        <tr key={`fire-start-${row.month}`} className="projection-rate-shift-row projection-fire-row">
          <td colSpan={hasBreakdown ? 7 : 4}>
            <span className="projection-rate-shift-label">🏖️ F.I.R.E.</span>
          </td>
        </tr>,
      )
    }
    if (prev && prev.partnerLocked && !row.partnerLocked) {
      milestones.push(
        <tr key={`unlock-partner-${row.month}`} className="projection-rate-shift-row projection-unlock-row">
          <td colSpan={hasBreakdown ? 7 : 4}>
            <span className="projection-rate-shift-label">🔓 Partner Retirement unlocked</span>
          </td>
        </tr>,
      )
    }
    return milestones.length > 0 ? milestones : null
  }

  const renderRow = (row: ProjectionRow) => (
    <tr key={row.month} className={row.remaining < 0 ? 'projection-row--negative' : ''}>
      <td>{row.month}</td>
      <td className={`phase-badge phase-badge--${row.phase}`}>
        {row.phase === 'accumulation' ? 'Saving' : 'Spending'}
      </td>
      <td>{row.phase === 'drawdown' ? dollars(Math.round(row.expense)) : '—'}</td>
      {hasBreakdown && (
        <>
          <td>
            {dollars(Math.round(row.nonRetirement ?? 0))}
            {row.phase === 'accumulation' && row.contribNonRet ? (
              <span className="contrib-badge">+{dollars(Math.round(row.contribNonRet))}</span>
            ) : null}
          </td>
          <td className={(primaryFirst ? row.primaryLocked : row.partnerLocked) ? 'bucket-locked' : ''}>
            {dollars(Math.round((primaryFirst ? row.retirementPrimary : row.retirementPartner) ?? 0))}
            {row.phase === 'accumulation' && (primaryFirst ? row.contribPrimary : row.contribPartner) ? (
              <span className="contrib-badge">
                +{dollars(Math.round((primaryFirst ? row.contribPrimary : row.contribPartner)!))}
              </span>
            ) : null}
          </td>
          <td className={(primaryFirst ? row.partnerLocked : row.primaryLocked) ? 'bucket-locked' : ''}>
            {dollars(Math.round((primaryFirst ? row.retirementPartner : row.retirementPrimary) ?? 0))}
            {row.phase === 'accumulation' && (primaryFirst ? row.contribPartner : row.contribPrimary) ? (
              <span className="contrib-badge">
                +{dollars(Math.round((primaryFirst ? row.contribPartner : row.contribPrimary)!))}
              </span>
            ) : null}
          </td>
        </>
      )}
      <td className="portfolio-total">{dollars(Math.round(row.remaining))}</td>
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
            {hasBreakdown && (
              <>
                <th scope="col">Non-Retirement</th>
                <th scope="col">{primaryFirst ? 'Retirement (Primary)' : 'Retirement (Partner)'}</th>
                <th scope="col">{primaryFirst ? 'Retirement (Partner)' : 'Retirement (Primary)'}</th>
              </>
            )}
            <th scope="col" className="portfolio-total-header">
              Portfolio Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((row, idx) => {
            const prev = idx > 0 ? rows[idx - 1] : null
            const elements: React.JSX.Element[] = []
            const milestones = renderMilestoneRows(prev, row)
            if (milestones) elements.push(...milestones)
            elements.push(renderRow(row))
            return elements
          })}
        </tbody>
      </table>
    </div>
  )
}

export default LifecycleTable
