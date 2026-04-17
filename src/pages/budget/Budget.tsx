import { FC, useState } from 'react'
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
    </div>
  )
}

export default Budget
