import { FC, useState, lazy, Suspense, useEffect, useRef, useCallback } from 'react'
import { useBudget } from './hooks/useBudget'
import { useCSVUpload } from './hooks/useCSVUpload'
import { TimePeriod } from './types'
import BudgetHeader from './components/BudgetHeader'
import BudgetSummary from './components/BudgetSummary'
import BudgetTable from './components/BudgetTable'
import BudgetAggregatedView from './components/BudgetAggregatedView'
import CategoryGroupManager from './components/CategoryGroupManager'
import CSVPreviewModal from './components/CSVPreviewModal'
import CashflowBarChart from './components/CashflowBarChart'
import CashflowSankey from './components/CashflowSankey'
import '../../styles/Budget.css'

const PdfToCsv = lazy(() => import('../tools/components/PdfToCsv'))

const Budget: FC = () => {
  const {
    selectedYear, setSelectedYear, yearExists,
    viewMode, setViewMode,
    uploadCSV, removeCSV, createYear, updateCategoryGroups, mergeCategories, editCategory,
    categoryHasTransactions, deleteCategory,
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

  useEffect(() => {
    if (!showPdfToCsv) return
    const closeBtn = pdfModalRef.current?.querySelector<HTMLElement>('.budget-pdf-modal-close')
    closeBtn?.focus()
    return () => { pdfTriggerRef.current?.focus() }
  }, [showPdfToCsv])

  const handlePdfModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { closePdfModal(); return }
    if (e.key === 'Tab') {
      const modal = pdfModalRef.current
      if (!modal) return
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
  }, [closePdfModal])

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
        onNextYear={() => setSelectedYear(y => Math.min(y + 1, currentYear))}
        onSetViewMode={setViewMode}
        onSetTimePeriod={setTimePeriod}
        onToggleGroupMgr={() => setShowGroupMgr(v => !v)}
        onToggleFormatHelp={() => setShowFormatHelp(v => !v)}
        onToggleUploadMenu={() => setShowUploadMenu(v => !v)}
        onQuickUpload={handleQuickUpload}
        onBulkUpload={handleBulkUpload}
        onOpenPdfToCsv={pdfToCsvEnabled ? openPdfModal : undefined}
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

      {!yearExists ? (
        <div className="budget-empty-year">
          <p>Budget not created for {selectedYear}.</p>
          <button className="budget-create-year-btn" onClick={() => createYear(selectedYear)} disabled={selectedYear > currentYear}>
            Create {selectedYear} Budget
          </button>
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
            onKeyDown={handlePdfModalKeyDown}
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
