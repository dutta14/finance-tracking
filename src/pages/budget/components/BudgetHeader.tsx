import { FC, RefObject } from 'react'
import { TimePeriod, BudgetViewMode } from '../types'
import { getCSVFormatHelp } from '../utils/csvParser'

interface BudgetHeaderProps {
  selectedYear: number
  currentYear: number
  viewMode: BudgetViewMode
  timePeriod: TimePeriod
  showGroupMgr: boolean
  showFormatHelp: boolean
  showUploadMenu: boolean
  quickUploadRef: RefObject<HTMLInputElement | null>
  bulkUploadRef: RefObject<HTMLInputElement | null>
  onPrevYear: () => void
  onNextYear: () => void
  onSetViewMode: (mode: BudgetViewMode) => void
  onSetTimePeriod: (period: TimePeriod) => void
  onToggleGroupMgr: () => void
  onToggleFormatHelp: () => void
  onToggleUploadMenu: () => void
  onQuickUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBulkUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const BudgetHeader: FC<BudgetHeaderProps> = ({
  selectedYear, currentYear, viewMode, timePeriod,
  showGroupMgr, showFormatHelp, showUploadMenu,
  quickUploadRef, bulkUploadRef,
  onPrevYear, onNextYear, onSetViewMode, onSetTimePeriod,
  onToggleGroupMgr, onToggleFormatHelp, onToggleUploadMenu,
  onQuickUpload, onBulkUpload,
}) => (
  <>
    <div className="budget-header">
      <div className="budget-header-left">
        <h1 className="budget-title">Budget</h1>
        <div className="budget-year-nav">
          <button className="budget-year-btn" onClick={onPrevYear} title="Previous year">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="budget-year-label">{selectedYear}</span>
          <button className="budget-year-btn" onClick={onNextYear} disabled={selectedYear >= currentYear} title="Next year">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="budget-header-right">
        <div className="budget-view-toggle">
          <button className={`budget-view-btn${viewMode === 'aggregated' ? ' active' : ''}`} onClick={() => onSetViewMode('aggregated')}>Aggregated</button>
          <button className={`budget-view-btn${viewMode === 'detailed' ? ' active' : ''}`} onClick={() => onSetViewMode('detailed')}>Detailed</button>
          <button className={`budget-view-btn${viewMode === 'cashflow' ? ' active' : ''}`} onClick={() => onSetViewMode('cashflow')}>Cashflow</button>
        </div>
        <div className="budget-view-toggle">
          <button className={`budget-view-btn${timePeriod === 'month' ? ' active' : ''}`} onClick={() => onSetTimePeriod('month')}>M</button>
          <button className={`budget-view-btn${timePeriod === 'quarter' ? ' active' : ''}`} onClick={() => onSetTimePeriod('quarter')}>Q</button>
          <button className={`budget-view-btn${timePeriod === 'half' ? ' active' : ''}`} onClick={() => onSetTimePeriod('half')}>H</button>
        </div>
        <button className="budget-action-btn" onClick={onToggleGroupMgr}>
          {showGroupMgr ? 'Hide Groups' : 'Groups'}
        </button>
        <div className="budget-upload-dropdown">
          <button className="budget-action-btn budget-split-main" onClick={() => quickUploadRef.current?.click()}>
            Upload CSV
          </button>
          <button className="budget-action-btn budget-split-drop" onClick={onToggleUploadMenu}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {showUploadMenu && (
            <>
              <div className="budget-upload-backdrop" onClick={onToggleUploadMenu} />
              <div className="budget-upload-menu">
                <button className="budget-upload-menu-item" onClick={() => { onToggleUploadMenu(); bulkUploadRef.current?.click() }}>
                  Bulk Upload
                </button>
              </div>
            </>
          )}
        </div>
        <button className="budget-action-btn budget-action-btn--subtle" onClick={onToggleFormatHelp}>?</button>

        <input ref={quickUploadRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onQuickUpload} />
        <input ref={bulkUploadRef} type="file" accept=".csv" multiple style={{ display: 'none' }} onChange={onBulkUpload} />
      </div>
    </div>

    {showFormatHelp && (
      <div className="budget-format-help">
        <pre>{getCSVFormatHelp()}</pre>
        <button className="budget-format-help-close" onClick={onToggleFormatHelp}>×</button>
      </div>
    )}
  </>
)

export default BudgetHeader
