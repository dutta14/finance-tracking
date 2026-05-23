import { Page, Locator } from '@playwright/test'

export class TaxesPage {
  readonly page: Page

  readonly heading: Locator
  readonly yearLabel: Locator
  readonly prevYearBtn: Locator
  readonly nextYearBtn: Locator

  readonly emptyState: Locator
  readonly emptyStateHeading: Locator
  readonly createYearBtn: Locator
  readonly importTemplateBtn: Locator

  readonly body: Locator
  readonly templateBar: Locator
  readonly saveTemplateBtn: Locator
  readonly deleteYearBtn: Locator

  readonly sections: Locator
  readonly items: Locator
  readonly uploadErrorRegion: Locator
  readonly uploadError: Locator

  // Modals
  readonly modalOverlay: Locator
  readonly addItemInput: Locator
  readonly saveTemplateNameInput: Locator
  readonly importTemplateModal: Locator
  readonly confirmDeleteModal: Locator

  constructor(page: Page) {
    this.page = page

    this.heading = page.locator('.tax-heading')
    this.yearLabel = page.locator('.tax-year-label')
    this.prevYearBtn = page.locator('.tax-year-nav .tax-year-btn').first()
    this.nextYearBtn = page.locator('.tax-year-nav .tax-year-btn').nth(1)

    this.emptyState = page.locator('.tax-empty-state')
    this.emptyStateHeading = page.locator('.tax-empty-state h2')
    this.createYearBtn = page.locator('.tax-empty-state .tax-btn--primary')
    this.importTemplateBtn = page.locator('.tax-empty-state .tax-btn--outline', { hasText: /Import from Template/ })

    this.body = page.locator('.tax-body')
    this.templateBar = page.locator('.tax-template-bar')
    this.saveTemplateBtn = page.locator('.tax-template-bar .tax-btn--outline', { hasText: /Save as Template/ })
    this.deleteYearBtn = page.locator('.tax-template-bar .tax-btn--danger', { hasText: /Delete Year/ })

    this.sections = page.locator('.tax-section')
    this.items = page.locator('.tax-item')
    this.uploadErrorRegion = page.locator('.tax-upload-error-region')
    this.uploadError = page.locator('.tax-upload-error')

    this.modalOverlay = page.locator('.tax-modal-overlay')
    this.addItemInput = page.locator('.tax-modal .tax-input[placeholder="Item name"]')
    this.saveTemplateNameInput = page.locator('.tax-modal .tax-input[placeholder="Template name"]')
    this.importTemplateModal = page.locator('.tax-modal', { hasText: 'Import from Template' })
    this.confirmDeleteModal = page.locator('.tax-modal', { hasText: /Delete .+ Tax Prep\?/ })
  }

  async goto() {
    await this.page.goto('/finance-tracking/#/taxes')
    await this.page.waitForLoadState('domcontentloaded')
    await this.heading.waitFor({ state: 'visible' })
  }

  /** Locate the owner section by its visible title. */
  section(title: string | RegExp): Locator {
    return this.page.locator('.tax-section').filter({
      has: this.page.locator('.tax-section-title', { hasText: title }),
    })
  }

  /** Locate a single checklist item row by its label text. */
  item(label: string | RegExp): Locator {
    return this.page.locator('.tax-item').filter({
      has: this.page.locator('.tax-item-label-text', { hasText: label }),
    })
  }

  /** Click the section's "+ Add Item" button and wait for the modal. */
  async openAddItemModal(sectionTitle: string | RegExp) {
    await this.section(sectionTitle).locator('.tax-btn--outline', { hasText: '+ Add Item' }).click()
    await this.addItemInput.waitFor({ state: 'visible' })
  }

  /** Add a custom item via the modal in the given owner section. */
  async addCustomItem(sectionTitle: string | RegExp, label: string) {
    await this.openAddItemModal(sectionTitle)
    await this.addItemInput.fill(label)
    await this.page.locator('.tax-modal .tax-btn--primary', { hasText: /^Add$/ }).click()
    await this.modalOverlay.waitFor({ state: 'hidden' })
  }

  /**
   * Upload a file payload to the named checklist item by triggering the
   * hidden file input directly (the Upload button opens a native picker
   * we cannot drive on real clicks; we bypass it).
   */
  async uploadFile(label: string | RegExp, file: { name: string; mimeType: string; buffer: Buffer }) {
    const row = this.item(label)
    await row.locator('input[type="file"]').setInputFiles(file)
  }

  /** Click × on the file chip whose name matches. */
  async removeFile(itemLabel: string | RegExp, fileName: string) {
    const row = this.item(itemLabel)
    const chip = row.locator('.tax-file-chip').filter({ has: this.page.locator('.tax-file-name', { hasText: fileName }) })
    await chip.locator('.tax-file-remove').click()
  }

  /** Click the row's × remove-item button. */
  async removeItem(label: string | RegExp) {
    await this.item(label).locator('.tax-item-actions .tax-btn--muted').click()
  }

  /** Double-click the label text to enter rename mode. */
  async startRenameByDoubleClick(label: string | RegExp) {
    await this.item(label).locator('.tax-item-label-text').dblclick()
  }

  /** Click the pencil ✎ button to enter rename mode. */
  async startRenameByPencil(label: string | RegExp) {
    await this.item(label).locator('.tax-rename-btn').click()
  }

  /** The active rename input (only one can be open at a time). */
  get activeRenameInput(): Locator {
    return this.page.locator('.tax-rename-input')
  }

  /** Locate the rename input inside a specific row (works even if label
   *  text is no longer rendered because the row is in edit mode). */
  renameInput(label: string | RegExp): Locator {
    return this.item(label).locator('.tax-rename-input')
  }

  /** Open the Delete Year confirmation modal. */
  async openDeleteYear() {
    await this.deleteYearBtn.click()
    await this.confirmDeleteModal.waitFor({ state: 'visible' })
  }

  /** Confirm deletion of the current year. */
  async confirmDeleteYear() {
    await this.confirmDeleteModal.locator('.tax-btn--danger').click()
    await this.confirmDeleteModal.waitFor({ state: 'hidden' })
  }
}
