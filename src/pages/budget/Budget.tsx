import { FC, useState, lazy, Suspense, useEffect, useRef, useCallback } from 'react'
import { useBudget } from './hooks/useBudget'
import { useCSVUpload } from './hooks/useCSVUpload'
import { TimePeriod } from './types'
import BudgetHeader from './components/BudgetHeader'
import ManualTransactionEntry from './components/ManualTransactionEntry'
import BudgetSummary from './components/BudgetSummary'
import BudgetTable from './components/BudgetTable'
import BudgetAggregatedView from './components/BudgetAggregatedView'
import CategoryGroupManager from './components/CategoryGroupManager'
import CSVPreviewModal from './components/CSVPreviewModal'
import CashflowBarChart from './components/CashflowBarChart'
import CashflowSankey from './components/CashflowSankey'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import '../../styles/Budget.css'

const PdfToCsv = lazy(() => import('../tools/components/PdfToCsv'))

const Budget: FC = () => {
  const {
    years,
    selectedYear, setSelectedYear,
    viewMode, setViewMode,
    uploadCSV, removeCSV, createYear, updateCategoryGroups, mergeCategories, editCategory,
    categoryHasTransactions, deleteCategory,
    addTransaction,
    yearTransactions, categoryGroups, removedCategories, categorySums, summary, monthsWithData,
  } = useBudget()

  const {
    csvPreview, toastMsg,
    quickUploadRef, bulkUploadRef,
    handleQuickUpload, handleBulkUpload,
    handlePreviewConfirm, handlePreviewCancel,
  } = useCSVUpload(uploadCSV)

  const [showGroupMgr, setShowGroupMgr] = useState(false)
  const [showFormatHelp, setShowFormatHelp] = useState(false)
  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month')
  const [showPdfToCsv, setShowPdfToCsv] = useState(false)
  const pdfToCsvEnabled = localStorage.getItem('lab-pdf-to-csv') === '1'

  const pdfModalRef = useRef<HTMLDivElement>(null)
  const pdfTriggerRef = useRef<HTMLElement | null>(null)

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

  const currentYear = new Date().getFullYear()

  return (
    <div className="budget-page">
      <BudgetHeader
        selectedYear={selectedYear}
        currentYear={currentYear}
        viewMode={viewMode}
        timePeriod={timePeriod}
        showGroupMgr={showGroupMgr}
        showFormatHelp={showFormatHelp}
        showUploadMenu={showUploadMenu}
        quickUploadRef={quickUploadRef}
        bulkUploadRef={bulkUploadRef}
        onPrevYear={() => setSelectedYear(y => y - 1)}
        onNextYear={() => setSelectedYear(y => y + 1)}
        onSetViewMode={setViewMode}
        onSetTimePeriod={setTimePeriod}
        onToggleGroupMgr={() => setShowGroupMgr(v => !v)}
        onToggleFormatHelp={() => setShowFormatHelp(v => !v)}
        onToggleUploadMenu={() => setShowUploadMenu(v => !v)}
        onQuickUpload={handleQuickUpload}
        onBulkUpload={handleBulkUpload}
        onOpenPdfToCsv={pdfToCsvEnabled ? openPdfModal : undefined}
      />

      <ManualTransactionEntry
        categoryGroups={categoryGroups}
        years={years}
        onAdd={addTransaction}
      />

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
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="budget-empty-year-icon">
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
              <button className="budget-action-btn budget-action-btn--accent" onClick={() => quickUploadRef.current?.click()}>
                Import CSV
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <BudgetSummary
            totalIncome={summary.totalIncome}
            totalExpense={summary.totalExpense}
            saveRate={summary.saveRate}
            year={selectedYear}
          />

          {showGroupMgr && (
            <CategoryGroupManager
              groups={categoryGroups}
              onUpdate={(groups) => updateCategoryGroups(groups)}
              onMerge={mergeCategories}
              onDeleteCategory={deleteCategory}
              categoryHasTransactions={categoryHasTransactions}
              categorySums={categorySums}
            />
          )}

          {viewMode === 'detailed' ? (
            <>
              <BudgetTable
                year={selectedYear} type="income"
                categoryGroups={categoryGroups} categorySums={categorySums}
                monthsWithData={monthsWithData}
                onUploadCSV={uploadCSV} onRemoveCSV={removeCSV} onEditCategory={editCategory}
                yearTransactions={yearTransactions} timePeriod={timePeriod}
              />
              <BudgetTable
                year={selectedYear} type="expense"
                categoryGroups={categoryGroups} categorySums={categorySums}
                monthsWithData={monthsWithData}
                onUploadCSV={uploadCSV} onRemoveCSV={removeCSV} onEditCategory={editCategory}
                yearTransactions={yearTransactions} timePeriod={timePeriod}
              />
            </>
          ) : viewMode === 'aggregated' ? (
            <>
              <BudgetAggregatedView
                year={selectedYear} type="income"
                categoryGroups={categoryGroups} categorySums={categorySums} timePeriod={timePeriod}
              />
              <BudgetAggregatedView
                year={selectedYear} type="expense"
                categoryGroups={categoryGroups} categorySums={categorySums} timePeriod={timePeriod}
              />
            </>
          ) : (
            <>
              <CashflowBarChart
                year={selectedYear} yearTransactions={yearTransactions}
                timePeriod={timePeriod} removedCategories={removedCategories} categorySums={categorySums}
              />
              <CashflowSankey
                year={selectedYear} yearTransactions={yearTransactions}
                categoryGroups={categoryGroups} removedCategories={removedCategories} categorySums={categorySums}
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
              <h2 id="budget-pdf-title" className="budget-pdf-modal-title">PDF → CSV</h2>
              <button className="budget-pdf-modal-close" onClick={closePdfModal} aria-label="Close">✕</button>
            </div>
            <div className="budget-pdf-modal-body">
              <Suspense fallback={<div className="budget-pdf-loading" role="status">Loading…</div>}>
                <PdfToCsv />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Budget
