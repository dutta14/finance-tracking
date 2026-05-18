import { Page, Locator } from '@playwright/test'

export class NetWorthPage {
  readonly page: Page

  // Empty state
  readonly emptyContainer: Locator
  readonly emptyTitle: Locator
  readonly emptyAddBtn: Locator

  // Header actions
  readonly viewAccountsBtn: Locator
  readonly addEntryBtn: Locator
  readonly copyLastMonthBtn: Locator
  readonly importCsvBtn: Locator
  readonly exportCsvBtn: Locator
  readonly resetBtn: Locator
  readonly csvFileInput: Locator

  // View tabs
  readonly viewTabList: Locator
  readonly chartsTab: Locator
  readonly spreadsheetTab: Locator

  // Tab navigation (Accounts / Allocation / Growth)
  readonly tabBar: Locator

  // AccountsModal
  readonly modal: Locator
  readonly modalCloseBtn: Locator
  readonly modalAddBtn: Locator

  // AccountForm
  readonly accountForm: Locator
  readonly accountNameInput: Locator
  readonly institutionInput: Locator
  readonly formSaveBtn: Locator
  readonly formCancelBtn: Locator

  // Spreadsheet
  readonly spreadsheetWrap: Locator
  readonly spreadsheet: Locator
  readonly inlineMonthInput: Locator
  readonly inlineSaveBtn: Locator
  readonly inlineCancelBtn: Locator
  readonly deleteRowBtns: Locator

  // Charts
  readonly chartsTypePicker: Locator

  // Show inactive
  readonly showInactiveLabel: Locator

  constructor(page: Page) {
    this.page = page

    // Empty state
    this.emptyContainer = page.locator('.data-empty').first()
    this.emptyTitle = page.locator('.data-empty-title').first()
    this.emptyAddBtn = page.locator('.data-empty .data-add-btn')

    // Header actions
    this.viewAccountsBtn = page.locator('button.data-view-accounts-btn')
    this.addEntryBtn = page.locator('button.data-add-entry-btn').first()
    this.copyLastMonthBtn = page.getByLabel('Copy balances from last month')
    this.importCsvBtn = page.locator('button.data-import-csv-btn').first()
    this.exportCsvBtn = page.locator('button.data-export-csv-btn')
    this.resetBtn = page.locator('button.data-reset-btn')
    this.csvFileInput = page.locator('input[aria-label="Import CSV file"]')

    // View tabs
    this.viewTabList = page.locator('[role="tablist"][aria-label="Data view"]')
    this.chartsTab = page.getByRole('tab', { name: 'Charts' })
    this.spreadsheetTab = page.getByRole('tab', { name: 'Spreadsheet' })

    // Tab navigation
    this.tabBar = page.locator('nav[aria-label="Net Worth sections"]')

    // AccountsModal
    this.modal = page.locator('div[role="dialog"][aria-modal="true"]')
    this.modalCloseBtn = page.locator('button.data-modal-close')
    this.modalAddBtn = this.modal.locator('button.data-add-btn')

    // AccountForm
    this.accountForm = page.locator('form.data-form')
    this.accountNameInput = page.locator('input[placeholder="e.g. Chase Checking"]')
    this.institutionInput = page.locator('input[placeholder="e.g. Chase"]')
    this.formSaveBtn = page.locator('button.data-form-save')
    this.formCancelBtn = page.locator('button.data-form-cancel')

    // Spreadsheet
    this.spreadsheetWrap = page.locator('.data-spreadsheet-wrap')
    this.spreadsheet = page.locator('table.data-spreadsheet')
    this.inlineMonthInput = page.locator('input.data-inline-month-input')
    this.inlineSaveBtn = page.locator('button.data-inline-save')
    this.inlineCancelBtn = page.locator('button.data-inline-cancel')
    this.deleteRowBtns = page.locator('button.data-delete-row-btn')

    // Charts
    this.chartsTypePicker = page.locator('.data-charts-type-picker')

    // Show inactive
    this.showInactiveLabel = page.locator('label.data-filter-toggle')
  }

  async goto() {
    await this.page.goto('/finance-tracking/#/net-worth')
    await this.page.waitForLoadState('domcontentloaded')
  }

  async gotoAllocation() {
    await this.page.goto('/finance-tracking/#/net-worth/allocation')
    await this.page.waitForLoadState('domcontentloaded')
  }

  async gotoGrowth() {
    await this.page.goto('/finance-tracking/#/net-worth/growth')
    await this.page.waitForLoadState('domcontentloaded')
  }

  async openAccountsModal() {
    await this.viewAccountsBtn.click()
    await this.modal.waitFor({ state: 'visible' })
  }

  async closeAccountsModal() {
    await this.modalCloseBtn.first().click()
    await this.modal.waitFor({ state: 'hidden' })
  }

  async addAccount(name: string, institution?: string) {
    await this.modalAddBtn.click()
    await this.accountNameInput.waitFor({ state: 'visible' })
    await this.accountNameInput.fill(name)
    if (institution) {
      await this.institutionInput.fill(institution)
    }
    await this.formSaveBtn.click()
  }

  getAccountName(name: string): Locator {
    return this.modal.locator('.data-account-name', { hasText: name })
  }

  getEditBtn(index: number): Locator {
    return this.modal.locator('button.data-action-btn').nth(index)
  }

  getDeleteBtn(index: number): Locator {
    return this.modal.locator('button.data-action-btn--delete').nth(index)
  }

  getInlineBalanceInput(index: number): Locator {
    return this.page.locator('input.data-inline-balance-input').nth(index)
  }

  getChartTypeBtn(index: number): Locator {
    return this.chartsTypePicker.locator('button.data-filter-btn').nth(index)
  }

  getTabLink(name: string): Locator {
    return this.tabBar.locator('.nw-tab', { hasText: name })
  }
}
