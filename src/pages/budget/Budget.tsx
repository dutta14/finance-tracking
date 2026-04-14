import { FC, useRef, useState } from 'react'
import { useBudget } from './hooks/useBudget'
import { TimePeriod } from './types'
import BudgetSummary from './components/BudgetSummary'
import BudgetTable from './components/BudgetTable'
import BudgetAggregatedView from './components/BudgetAggregatedView'
import CategoryGroupManager from './components/CategoryGroupManager'
import { getCSVFormatHelp } from './utils/csvParser'
import '../../styles/Budget.css'

const Budget: FC = () => {
  const {
    store, selectedYear, setSelectedYear, yearExists,
    viewMode, setViewMode,
    uploadCSV, removeCSV, createYear, updateCategoryGroups, mergeCategories, editCategory,
    categoryHasTransactions, deleteCategory, applyConfig,
    yearTransactions, categoryGroups, categorySums, summary, monthsWithData,
  } = useBudget()

  const [showGroupMgr, setShowGroupMgr] = useState(false)
  const [showFormatHelp, setShowFormatHelp] = useState(false)
  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const quickUploadRef = useRef<HTMLInputElement>(null)
  const bulkUploadRef = useRef<HTMLInputElement>(null)

  /** Extract YYYY-MM month key from a filename. Supports "2025-05.csv" and "Our Finances - May 2025.csv" */
  const monthKeyFromFilename = (name: string): string | null => {
    // Try YYYY-MM pattern first
    const isoMatch = name.match(/(\d{4})-(\d{2})/)
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`

    // Try "Our Finances - MMM YYYY.csv"
    const MONTHS: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    }
    const namedMatch = name.match(/Our\s+Finances\s*-\s*(\w+)\s+(\d{4})/i)
    if (namedMatch) {
      const mon = MONTHS[namedMatch[1].slice(0, 3).toLowerCase()]
      if (mon) return `${namedMatch[2]}-${mon}`
    }
    return null
  }

  const handleUploadCSV = (monthKey: string, csv: string) => {
    return uploadCSV(monthKey, csv)
  }

  const currentYear = new Date().getFullYear()
  const prevYear = () => setSelectedYear(y => y - 1)
  const nextYear = () => setSelectedYear(y => Math.min(y + 1, currentYear))

  const handleQuickUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Try to infer month from filename
    const monthKey = monthKeyFromFilename(file.name)
    if (!monthKey) {
      setToastMsg('Could not determine month from filename. Use format: yyyy-mm.csv or "Our Finances - MMM YYYY.csv"')
      setTimeout(() => setToastMsg(null), 5000)
      if (quickUploadRef.current) quickUploadRef.current.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = handleUploadCSV(monthKey, text)
      if (!result.ok) {
        setToastMsg(`Upload failed: ${result.error}`)
        setTimeout(() => setToastMsg(null), 5000)
      }
    }
    reader.readAsText(file)
    if (quickUploadRef.current) quickUploadRef.current.value = ''
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    let success = 0
    let failed = 0
    const errors: string[] = []

    // Read files sequentially to avoid state race conditions
    for (const file of Array.from(files)) {
      const monthKey = monthKeyFromFilename(file.name)
      if (!monthKey) {
        failed++
        errors.push(`${file.name}: couldn't determine month`)
        continue
      }
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target?.result as string)
        reader.readAsText(file)
      })
      const result = handleUploadCSV(monthKey, text)
      if (result.ok) success++
      else { failed++; errors.push(`${file.name}: ${result.error}`) }
    }

    const msg = failed === 0
      ? `Uploaded ${success} file${success !== 1 ? 's' : ''} successfully`
      : `${success} succeeded, ${failed} failed: ${errors.join(', ')}`
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 5000)
    if (bulkUploadRef.current) bulkUploadRef.current.value = ''
  }

  return (
    <div className="budget-page">
      {/* Header */}
      <div className="budget-header">
        <div className="budget-header-left">
          <h1 className="budget-title">Budget</h1>
          <div className="budget-year-nav">
            <button className="budget-year-btn" onClick={prevYear} title="Previous year">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="budget-year-label">{selectedYear}</span>
            <button className="budget-year-btn" onClick={nextYear} disabled={selectedYear >= currentYear} title="Next year">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="budget-header-right">
          <div className="budget-view-toggle">
            <button
              className={`budget-view-btn${viewMode === 'detailed' ? ' active' : ''}`}
              onClick={() => setViewMode('detailed')}
            >
              Detailed
            </button>
            <button
              className={`budget-view-btn${viewMode === 'aggregated' ? ' active' : ''}`}
              onClick={() => setViewMode('aggregated')}
            >
              Aggregated
            </button>
          </div>
          <div className="budget-view-toggle">
            <button className={`budget-view-btn${timePeriod === 'month' ? ' active' : ''}`} onClick={() => setTimePeriod('month')}>M</button>
            <button className={`budget-view-btn${timePeriod === 'quarter' ? ' active' : ''}`} onClick={() => setTimePeriod('quarter')}>Q</button>
            <button className={`budget-view-btn${timePeriod === 'half' ? ' active' : ''}`} onClick={() => setTimePeriod('half')}>H</button>
          </div>
          <button className="budget-action-btn" onClick={() => setShowGroupMgr(v => !v)}>
            {showGroupMgr ? 'Hide Groups' : 'Groups'}
          </button>
          <div className="budget-upload-dropdown">
            <button className="budget-action-btn budget-split-main" onClick={() => quickUploadRef.current?.click()}>
              Upload CSV
            </button>
            <button className="budget-action-btn budget-split-drop" onClick={() => setShowUploadMenu(v => !v)}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showUploadMenu && (
              <>
                <div className="budget-upload-backdrop" onClick={() => setShowUploadMenu(false)} />
                <div className="budget-upload-menu">
                  <button className="budget-upload-menu-item" onClick={() => { setShowUploadMenu(false); bulkUploadRef.current?.click() }}>
                    Bulk Upload
                  </button>
                </div>
              </>
            )}
          </div>
          <button className="budget-action-btn budget-action-btn--subtle" onClick={() => setShowFormatHelp(v => !v)}>
            ?
          </button>

          <input
            ref={quickUploadRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleQuickUpload}
          />
          <input
            ref={bulkUploadRef}
            type="file"
            accept=".csv"
            multiple
            style={{ display: 'none' }}
            onChange={handleBulkUpload}
          />
        </div>
      </div>

      {/* Format help */}
      {showFormatHelp && (
        <div className="budget-format-help">
          <pre>{getCSVFormatHelp()}</pre>
          <button className="budget-format-help-close" onClick={() => setShowFormatHelp(false)}>×</button>
        </div>
      )}

      {/* Toast message */}
      {toastMsg && (
        <div className="budget-sync-msg">
          {toastMsg}
        </div>
      )}

      {!yearExists ? (
        /* Year not created */
        <div className="budget-empty-year">
          <p>Budget not created for {selectedYear}.</p>
          <button className="budget-create-year-btn" onClick={() => createYear(selectedYear)} disabled={selectedYear > currentYear}>
            Create {selectedYear} Budget
          </button>
        </div>
      ) : (
        <>
          {/* Summary */}
          <BudgetSummary
            totalIncome={summary.totalIncome}
            totalExpense={summary.totalExpense}
            saveRate={summary.saveRate}
            year={selectedYear}
          />

          {/* Category group manager */}
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

          {/* Tables */}
          {viewMode === 'detailed' ? (
            <>
              <BudgetTable
                year={selectedYear}
                type="income"
                categoryGroups={categoryGroups}
                categorySums={categorySums}
                monthsWithData={monthsWithData}
                onUploadCSV={handleUploadCSV}
                onRemoveCSV={removeCSV}
                onEditCategory={editCategory}
                yearTransactions={yearTransactions}
                timePeriod={timePeriod}
              />
              <BudgetTable
                year={selectedYear}
                type="expense"
                categoryGroups={categoryGroups}
                categorySums={categorySums}
                monthsWithData={monthsWithData}
                onUploadCSV={handleUploadCSV}
                onRemoveCSV={removeCSV}
                onEditCategory={editCategory}
                yearTransactions={yearTransactions}
                timePeriod={timePeriod}
              />
            </>
          ) : (
            <>
              <BudgetAggregatedView
                year={selectedYear}
                type="income"
                categoryGroups={categoryGroups}
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
      )}
    </div>
  )
}

export default Budget
