import { Page, Locator } from '@playwright/test'

export class BudgetPage {
  readonly page: Page

  // Title / shell
  readonly title: Locator
  readonly emptyState: Locator
  readonly emptyStateTitle: Locator
  readonly emptyStateDesc: Locator
  readonly emptyImportBtn: Locator

  // Year nav
  readonly yearNav: Locator
  readonly prevYearBtn: Locator
  readonly nextYearBtn: Locator
  readonly yearLabel: Locator

  // View mode + time period
  readonly viewToggles: Locator
  readonly aggregatedBtn: Locator
  readonly detailedBtn: Locator
  readonly cashflowBtn: Locator
  readonly monthPeriodBtn: Locator
  readonly quarterPeriodBtn: Locator
  readonly halfPeriodBtn: Locator
  readonly groupsBtn: Locator

  // Upload
  readonly uploadBtn: Locator
  readonly uploadDropDown: Locator
  readonly uploadMenu: Locator
  readonly quickUploadInput: Locator
  readonly bulkUploadInput: Locator
  readonly toast: Locator

  // CSV Preview modal
  readonly previewOverlay: Locator
  readonly previewModal: Locator
  readonly previewTable: Locator
  readonly previewCancel: Locator
  readonly previewConfirm: Locator

  // Manual transaction entry
  readonly addTxnBtn: Locator
  readonly txnForm: Locator
  readonly txnDate: Locator
  readonly txnDesc: Locator
  readonly txnAmount: Locator
  readonly txnCategory: Locator
  readonly txnCatListbox: Locator
  readonly txnSave: Locator
  readonly txnCancel: Locator

  // Summary
  readonly summaryIncome: Locator
  readonly summaryExpense: Locator
  readonly summarySave: Locator
  readonly incomeValue: Locator
  readonly expenseValue: Locator
  readonly saveRateValue: Locator

  // Category Group Manager
  readonly groupManager: Locator
  readonly groupBlocks: Locator

  // Budget Tables
  readonly tableSections: Locator
  readonly incomeTable: Locator
  readonly expenseTable: Locator

  constructor(page: Page) {
    this.page = page

    this.title = page.locator('.budget-title')
    this.emptyState = page.locator('.budget-empty-year')
    this.emptyStateTitle = page.locator('.budget-empty-year-title')
    this.emptyStateDesc = page.locator('.budget-empty-year-desc')
    this.emptyImportBtn = page.locator('.budget-action-btn--accent')

    this.yearNav = page.locator('.budget-year-nav')
    this.prevYearBtn = page.locator('.budget-year-btn[title="Previous year"]')
    this.nextYearBtn = page.locator('.budget-year-btn[title="Next year"]')
    this.yearLabel = page.locator('.budget-year-label')

    this.viewToggles = page.locator('.budget-view-toggle')
    this.aggregatedBtn = page.locator('.budget-view-btn', { hasText: 'Aggregated' })
    this.detailedBtn = page.locator('.budget-view-btn', { hasText: 'Detailed' })
    this.cashflowBtn = page.locator('.budget-view-btn', { hasText: 'Cashflow' })
    this.monthPeriodBtn = page.locator('.budget-view-toggle').nth(1).locator('.budget-view-btn', { hasText: 'M' })
    this.quarterPeriodBtn = page.locator('.budget-view-toggle').nth(1).locator('.budget-view-btn', { hasText: 'Q' })
    this.halfPeriodBtn = page.locator('.budget-view-toggle').nth(1).locator('.budget-view-btn', { hasText: 'H' })
    this.groupsBtn = page.locator('.budget-action-btn', { hasText: /^(Groups|Hide Groups)$/ })

    this.uploadBtn = page.locator('.budget-split-main')
    this.uploadDropDown = page.locator('.budget-split-drop')
    this.uploadMenu = page.locator('.budget-upload-menu')
    this.quickUploadInput = page.locator('input[data-testid="quick-upload-input"]')
    this.bulkUploadInput = page.locator('input[data-testid="bulk-upload-input"]')
    this.toast = page.locator('.budget-sync-msg')

    this.previewOverlay = page.locator('.csv-preview-overlay')
    this.previewModal = page.locator('.csv-preview-modal')
    this.previewTable = page.locator('.csv-preview-table')
    this.previewCancel = page.locator('.csv-preview-btn--cancel')
    this.previewConfirm = page.locator('.csv-preview-btn--confirm')

    this.addTxnBtn = page.locator('.budget-add-txn-btn')
    this.txnForm = page.locator('form.budget-txn-form')
    this.txnDate = page.locator('#txn-date')
    this.txnDesc = page.locator('#txn-desc')
    this.txnAmount = page.locator('#txn-amount')
    this.txnCategory = page.locator('#txn-category')
    this.txnCatListbox = page.locator('#txn-cat-listbox')
    this.txnSave = page.locator('button.budget-txn-save')
    this.txnCancel = page.locator('.budget-txn-cancel')

    this.summaryIncome = page.locator('.budget-summary-card--income')
    this.summaryExpense = page.locator('.budget-summary-card--expense')
    this.summarySave = page.locator('.budget-summary-card--save')
    this.incomeValue = this.summaryIncome.locator('.budget-summary-value')
    this.expenseValue = this.summaryExpense.locator('.budget-summary-value')
    this.saveRateValue = this.summarySave.locator('.budget-summary-value')

    this.groupManager = page.locator('.budget-group-manager')
    this.groupBlocks = page.locator('.budget-group-block')

    this.tableSections = page.locator('.budget-table-section')
    this.incomeTable = page.locator('.budget-table-section').filter({ has: page.locator('.budget-table-title', { hasText: /^Income/ }) })
    this.expenseTable = page.locator('.budget-table-section').filter({ has: page.locator('.budget-table-title', { hasText: /^Expenses/ }) })
  }

  async goto() {
    await this.page.goto('/finance-tracking/#/budget')
    await this.page.waitForLoadState('domcontentloaded')
    await this.title.waitFor({ state: 'visible' })
  }

  /**
   * Switch the upper view-mode toggle to a named mode. Buttons inside the
   * second toggle group share the labels M/Q/H, so we limit to the first
   * toggle group.
   */
  async setViewMode(mode: 'aggregated' | 'detailed' | 'cashflow') {
    const labels: Record<typeof mode, string> = {
      aggregated: 'Aggregated',
      detailed: 'Detailed',
      cashflow: 'Cashflow',
    }
    await this.page
      .locator('.budget-view-toggle')
      .nth(0)
      .locator('.budget-view-btn', { hasText: labels[mode] })
      .click()
  }

  async setTimePeriod(period: 'M' | 'Q' | 'H') {
    await this.page
      .locator('.budget-view-toggle')
      .nth(1)
      .locator('.budget-view-btn', { hasText: period })
      .click()
  }

  /** Upload a single CSV via the quick upload input and wait for preview. */
  async uploadCSV(name: string, csv: string) {
    await this.quickUploadInput.setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await this.previewModal.waitFor({ state: 'visible' })
  }

  /** Upload multiple CSVs via the bulk upload input. */
  async bulkUploadCSVs(files: Array<{ name: string; mimeType?: string; buffer?: Buffer; csv?: string }>) {
    await this.bulkUploadInput.setInputFiles(
      files.map(f => ({
        name: f.name,
        mimeType: f.mimeType ?? 'text/csv',
        buffer: f.buffer ?? Buffer.from(f.csv ?? ''),
      })),
    )
  }

  /** Open the manual transaction entry form. */
  async openManualEntry() {
    if (await this.txnForm.isVisible().catch(() => false)) return
    await this.addTxnBtn.click()
    await this.txnForm.waitFor({ state: 'visible' })
  }

  /**
   * Fill the manual entry form. Picks the first matching option from the
   * autocomplete listbox to mimic real keyboard selection.
   */
  async fillManualEntry(opts: { date: string; description?: string; amount: string; category: string }) {
    await this.openManualEntry()
    await this.txnDate.fill(opts.date)
    if (opts.description !== undefined) {
      await this.txnDesc.fill(opts.description)
    }
    await this.txnAmount.fill(opts.amount)

    await this.txnCategory.click()
    await this.txnCategory.fill(opts.category)
    // If the typed category matches an existing option, select it. Otherwise
    // press Enter to keep the free-text value (combobox stays open).
    const firstOption = this.txnCatListbox.locator('li[role="option"]').first()
    if (await firstOption.isVisible().catch(() => false)) {
      await firstOption.click()
    }
  }

  async submitManualEntry() {
    await this.txnSave.click()
  }

  /** Open the category group manager panel if not already open. */
  async openGroupManager() {
    if (await this.groupManager.isVisible().catch(() => false)) return
    await this.groupsBtn.click()
    await this.groupManager.waitFor({ state: 'visible' })
  }

  /** Right-click a month header in the expense table to open context menu. */
  async openMonthContextMenu(monthIndex: number) {
    const monthHeader = this.expenseTable.locator('th.budget-th--month').nth(monthIndex)
    await monthHeader.click({ button: 'right' })
    await this.page.locator('.budget-ctx-menu').waitFor({ state: 'visible' })
  }
}
