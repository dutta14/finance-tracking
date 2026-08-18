import { FC } from 'react'
import { TimePeriod, BudgetViewMode } from '../types'

interface BudgetHeaderProps {
  selectedYear: number
  viewMode: BudgetViewMode
  timePeriod: TimePeriod
  onPrevYear: () => void
  onNextYear: () => void
  onSetViewMode: (mode: BudgetViewMode) => void
  onSetTimePeriod: (period: TimePeriod) => void
}

const BudgetHeader: FC<BudgetHeaderProps> = ({
  selectedYear,
  viewMode,
  timePeriod,
  onPrevYear,
  onNextYear,
  onSetViewMode,
  onSetTimePeriod,
}) => (
  <div className="budget-header">
    <div className="budget-header-left">
      <h1 className="budget-title">Budget</h1>
      <div className="tab-bar">
        <button
          className={`tab-btn${viewMode === 'cashflow' ? ' active' : ''}`}
          onClick={() => onSetViewMode('cashflow')}
        >
          Cashflow
        </button>
        <button
          className={`tab-btn${viewMode === 'spreadsheet' ? ' active' : ''}`}
          onClick={() => onSetViewMode('spreadsheet')}
        >
          Spreadsheet
        </button>
        <button className={`tab-btn${viewMode === 'groups' ? ' active' : ''}`} onClick={() => onSetViewMode('groups')}>
          Groups
        </button>
      </div>
    </div>
    <div className="budget-header-right">
      {viewMode !== 'groups' && (
        <div className="tab-bar">
          <button
            className={`tab-btn${timePeriod === 'month' ? ' active' : ''}`}
            onClick={() => onSetTimePeriod('month')}
          >
            M
          </button>
          <button
            className={`tab-btn${timePeriod === 'quarter' ? ' active' : ''}`}
            onClick={() => onSetTimePeriod('quarter')}
          >
            Q
          </button>
          <button
            className={`tab-btn${timePeriod === 'half' ? ' active' : ''}`}
            onClick={() => onSetTimePeriod('half')}
          >
            H
          </button>
        </div>
      )}
      <div className="budget-year-nav">
        <button className="budget-year-btn" onClick={onPrevYear} title="Previous year">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="budget-year-label">{selectedYear}</span>
        <button className="budget-year-btn" onClick={onNextYear} title="Next year">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  </div>
)

export default BudgetHeader
