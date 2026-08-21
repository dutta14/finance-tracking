import { FC, useState, lazy, Suspense, useEffect, useRef, useCallback } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useBudget } from './hooks/useBudget'
import { useCSVUpload } from './hooks/useCSVUpload'
import { BudgetViewMode, TimePeriod } from './types'
import BudgetHeader from './components/BudgetHeader'
import ManualTransactionEntry from './components/ManualTransactionEntry'
import BudgetSummary from './components/BudgetSummary'
import BudgetTable from './components/BudgetTable'
import BudgetAggregatedView from './components/BudgetAggregatedView'
import CategoryGroupManager from './components/CategoryGroupManager'
import CSVPreviewModal from './components/CSVPreviewModal'
import CashflowBarChart from './components/CashflowBarChart'
import CashflowSankey from './components/CashflowSankey'
import { getCSVFormatHelp } from './utils/csvParser'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { getStorageItem } from '../../utils/storage'
import '../../styles/Budget.css'

const PdfToCsv = lazy(() => import('../tools/components/PdfToCsv'))

const Budget: FC = () => {
  const {
    years,
    selectedYear,
    setSelectedYear,
    spreadsheetMode,
    setSpreadsheetMode,
    uploadCSV,
    removeCSV,
    updateCategoryGroups,
    updateIncomeCategoryGroups,
    mergeCategories,
    categoryHasTransactions,
    deleteCategory,
    addTransaction,
    yearTransactions,
    categoryGroups,
    incomeCategoryGroups,
    removedCategories,
    incomeRemovedCategories,
    incomeCatSet,
    categorySums,
    summary,
    monthsWithData,
  } = useBudget()

  const {
    csvPreview,
    toastMsg,
    quickUploadRef,
    bulkUploadRef,
    handleQuickUpload,
    handleBulkUpload,
    handlePreviewConfirm,
    handlePreviewCancel,
  } = useCSVUpload(uploadCSV)

  const [showFormatHelp, setShowFormatHelp] = useState(false)
  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month')
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [showPdfToCsv, setShowPdfToCsv] = useState(false)
  const pdfToCsvEnabled = getStorageItem('lab-pdf-to-csv', '0') === '1'
  const location = useLocation()
  const navigate = useNavigate()
  const budgetPath = location.pathname.replace(/\/+$/, '')
  const viewMode: BudgetViewMode = budgetPath.endsWith('/groups')
    ? 'groups'
    : budgetPath.endsWith('/spreadsheet')
      ? 'spreadsheet'
      : 'cashflow'

  const pdfModalRef = useRef<HTMLDivElement>(null)
  const pdfTriggerRef = useRef<HTMLElement | null>(null)
  const formatHelpRef = useRef<HTMLDivElement>(null)

  const closePdfModal = useCallback(() => setShowPdfToCsv(false), [])
  const openPdfModal = useCallback(() => {
    pdfTriggerRef.current = document.activeElement as HTMLElement
    setShowPdfToCsv(true)
  }, [])

  useFocusTrap(pdfModalRef, showPdfToCsv)

  useEffect(() => {
    if (!showPdfToCsv) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePdfModal()
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      pdfTriggerRef.current?.focus()
    }
  }, [showPdfToCsv, closePdfModal])

  useEffect(() => {
    setSelectedPeriod(null)
  }, [timePeriod])

  useEffect(() => {
    const state = location.state as { scrollTo?: string } | null
    if (state?.scrollTo) {
      const el = document.getElementById(state.scrollTo)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [location.state])

  useEffect(() => {
    if (!showFormatHelp) return

    const handler = (e: MouseEvent) => {
      if (formatHelpRef.current && !formatHelpRef.current.contains(e.target as Node)) {
        setShowFormatHelp(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFormatHelp])

  const currentYear = new Date().getFullYear()

  if (budgetPath === '/budget') {
    return <Navigate to="/budget/cashflow" replace />
  }

  return (
    <div className="budget-page">
      <BudgetHeader
        selectedYear={selectedYear}
        viewMode={viewMode}
        timePeriod={timePeriod}
        onPrevYear={() => setSelectedYear(y => y - 1)}
        onNextYear={() => setSelectedYear(y => y + 1)}
        onSetViewMode={mode => navigate(`/budget/${mode}`)}
        onSetTimePeriod={setTimePeriod}
      />

      <div className="budget-content">
        {viewMode === 'spreadsheet' && (
          <div className="budget-action-bar">
            <div className="tab-bar">
              <button
                className={`tab-btn tab-btn--sm${spreadsheetMode === 'aggregated' ? ' active' : ''}`}
                onClick={() => setSpreadsheetMode('aggregated')}
                aria-pressed={spreadsheetMode === 'aggregated'}
              >
                Aggregated
              </button>
              <button
                className={`tab-btn tab-btn--sm${spreadsheetMode === 'detailed' ? ' active' : ''}`}
                onClick={() => setSpreadsheetMode('detailed')}
                aria-pressed={spreadsheetMode === 'detailed'}
              >
                Detailed
              </button>
            </div>
            <ManualTransactionEntry categoryGroups={categoryGroups} years={years} onAdd={addTransaction} />
            <div className="budget-spreadsheet-actions">
              <div className="budget-upload-dropdown">
                <button className="budget-action-btn budget-split-main" onClick={() => quickUploadRef.current?.click()}>
                  Upload CSV
                </button>
                <button
                  className="budget-action-btn budget-split-drop"
                  onClick={() => setShowUploadMenu(v => !v)}
                  aria-haspopup="true"
                  aria-expanded={showUploadMenu}
                  aria-label="Upload options"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 3.5l3 3 3-3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {showUploadMenu && (
                  <>
                    <div className="budget-upload-backdrop" onClick={() => setShowUploadMenu(false)} />
                    <div className="budget-upload-menu" role="menu">
                      <button
                        className="budget-upload-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setShowUploadMenu(false)
                          bulkUploadRef.current?.click()
                        }}
                      >
                        Bulk Upload
                      </button>
                      {pdfToCsvEnabled && (
                        <button
                          className="budget-upload-menu-item"
                          role="menuitem"
                          onClick={() => {
                            setShowUploadMenu(false)
                            openPdfModal()
                          }}
                        >
                          PDF → CSV
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="budget-format-help-wrapper" ref={formatHelpRef}>
                <button
                  className="budget-action-btn budget-action-btn--subtle"
                  onClick={() => setShowFormatHelp(v => !v)}
                >
                  ?
                </button>
                {showFormatHelp && (
                  <div className="budget-format-help-panel">
                    <pre>{getCSVFormatHelp()}</pre>
                  </div>
                )}
              </div>
              <input
                ref={quickUploadRef}
                type="file"
                accept=".csv"
                data-testid="quick-upload-input"
                style={{ display: 'none' }}
                onChange={handleQuickUpload}
              />
              <input
                ref={bulkUploadRef}
                type="file"
                accept=".csv"
                multiple
                data-testid="bulk-upload-input"
                style={{ display: 'none' }}
                onChange={handleBulkUpload}
              />
            </div>
          </div>
        )}

        {csvPreview && (
          <CSVPreviewModal
            csv={csvPreview.csv}
            monthKey={csvPreview.monthKey}
            onConfirm={handlePreviewConfirm}
            onCancel={handlePreviewCancel}
          />
        )}

        {toastMsg && <div className="budget-sync-msg">{toastMsg}</div>}

        {Object.keys(yearTransactions).length === 0 && monthsWithData.size === 0 ? (
          <div className="budget-empty-year">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="budget-empty-year-icon"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 9h18M9 4v16" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <h2 className="budget-empty-year-title">No data for {selectedYear}</h2>
            <p className="budget-empty-year-desc">
              {selectedYear > currentYear
                ? "This year hasn't started yet. Data will appear as you add it."
                : 'Import a bank CSV or add transactions manually to start tracking this year.'}
            </p>
            <div className="budget-empty-year-actions">
              {selectedYear <= currentYear && (
                <button
                  className="budget-action-btn budget-action-btn--accent"
                  onClick={() => quickUploadRef.current?.click()}
                >
                  Import CSV
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {viewMode !== 'groups' && (
              <BudgetSummary
                totalIncome={summary.totalIncome}
                totalExpense={summary.totalExpense}
                saveRate={summary.saveRate}
                year={selectedYear}
              />
            )}

            {viewMode === 'groups' ? (
              <CategoryGroupManager
                groups={categoryGroups}
                onUpdate={groups => updateCategoryGroups(groups)}
                incomeCategoryGroups={incomeCategoryGroups}
                onUpdateIncomeGroups={groups => updateIncomeCategoryGroups(groups)}
                onMerge={mergeCategories}
                onDeleteCategory={deleteCategory}
                categoryHasTransactions={categoryHasTransactions}
                categorySums={categorySums}
                yearTransactions={yearTransactions}
              />
            ) : viewMode === 'spreadsheet' ? (
              <>
                {spreadsheetMode === 'detailed' ? (
                  <>
                    <BudgetTable
                      year={selectedYear}
                      type="income"
                      categoryGroups={incomeCategoryGroups}
                      categorySums={categorySums}
                      monthsWithData={monthsWithData}
                      onUploadCSV={uploadCSV}
                      onRemoveCSV={removeCSV}
                      timePeriod={timePeriod}
                    />
                    <BudgetTable
                      year={selectedYear}
                      type="expense"
                      categoryGroups={categoryGroups}
                      categorySums={categorySums}
                      monthsWithData={monthsWithData}
                      onUploadCSV={uploadCSV}
                      onRemoveCSV={removeCSV}
                      timePeriod={timePeriod}
                    />
                  </>
                ) : (
                  <>
                    <BudgetAggregatedView
                      year={selectedYear}
                      type="income"
                      categoryGroups={categoryGroups}
                      incomeCategoryGroups={incomeCategoryGroups}
                      categorySums={categorySums}
                      timePeriod={timePeriod}
                    />
                    <BudgetAggregatedView
                      year={selectedYear}
                      type="expense"
                      categoryGroups={categoryGroups}
                      categorySums={categorySums}
                      timePeriod={timePeriod}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <CashflowBarChart
                  year={selectedYear}
                  yearTransactions={yearTransactions}
                  timePeriod={timePeriod}
                  removedCategories={new Set([...removedCategories, ...incomeRemovedCategories])}
                  incomeCatSet={incomeCatSet}
                  selectedPeriod={selectedPeriod}
                  onSelectPeriod={setSelectedPeriod}
                />
                <CashflowSankey
                  year={selectedYear}
                  yearTransactions={yearTransactions}
                  categoryGroups={categoryGroups}
                  removedCategories={new Set([...removedCategories, ...incomeRemovedCategories])}
                  categorySums={categorySums}
                  incomeCatSet={incomeCatSet}
                  selectedPeriod={selectedPeriod}
                  timePeriod={timePeriod}
                />
              </>
            )}
          </>
        )}

        {showPdfToCsv && (
          <div className="budget-pdf-overlay" onClick={closePdfModal}>
            <div
              className="budget-pdf-modal"
              ref={pdfModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="budget-pdf-title"
              onClick={e => e.stopPropagation()}
            >
              <div className="budget-pdf-modal-header">
                <h2 id="budget-pdf-title" className="budget-pdf-modal-title">
                  PDF → CSV
                </h2>
                <button className="budget-pdf-modal-close" onClick={closePdfModal} aria-label="Close">
                  ✕
                </button>
              </div>
              <div className="budget-pdf-modal-body">
                <Suspense
                  fallback={
                    <div className="budget-pdf-loading" role="status">
                      Loading…
                    </div>
                  }
                >
                  <PdfToCsv />
                </Suspense>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Budget
