import { Page, Locator, expect } from '@playwright/test'

export class DrivePage {
  readonly page: Page

  readonly heading: Locator
  readonly breadcrumb: Locator
  readonly list: Locator
  readonly backRow: Locator
  readonly dropZone: Locator
  readonly fileInput: Locator
  readonly emptyState: Locator

  readonly previewModal: Locator
  readonly previewModalHeading: Locator
  readonly previewCancelBtn: Locator

  readonly viewer: Locator
  readonly viewerTitle: Locator
  readonly viewerTable: Locator
  readonly viewerBackBtn: Locator

  readonly sortByName: Locator
  readonly sortByOwner: Locator
  readonly sortByDate: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.locator('.drive-title')
    this.breadcrumb = page.locator('.drive-breadcrumb')
    this.list = page.locator('.drive-list')
    this.backRow = page.getByRole('button', { name: 'Back to parent folder' })
    this.dropZone = page.locator('.drive-dropzone')
    this.fileInput = page.locator('.drive-dropzone input[type="file"]')
    this.emptyState = page.locator('.drive-empty')

    this.previewModal = page.getByRole('dialog')
    this.previewModalHeading = this.previewModal.locator('#csv-preview-heading')
    this.previewCancelBtn = this.previewModal.locator('.csv-preview-btn--cancel')

    this.viewer = page.locator('.drive-viewer')
    this.viewerTitle = page.locator('.drive-viewer-title')
    this.viewerTable = page.locator('.drive-viewer-table')
    this.viewerBackBtn = page.locator('.drive-viewer-back')

    const sortGroup = page.locator('.drive-filter-group').filter({ hasText: 'Sort:' })
    this.sortByName = sortGroup.getByRole('button', { name: 'Name' })
    this.sortByOwner = sortGroup.getByRole('button', { name: 'Owner' })
    this.sortByDate = sortGroup.getByRole('button', { name: 'Date' })
  }

  async goto(subPath = '') {
    const clean = subPath.replace(/^\/+/, '')
    const url = clean ? `/finance-tracking/#/drive/${clean}` : '/finance-tracking/#/drive'
    await this.page.goto(url)
    await this.page.waitForLoadState('domcontentloaded')
    await expect(this.heading).toBeVisible()
  }

  /** Folder row by visible folder name (e.g. "Budget", "2024"). */
  folder(name: string): Locator {
    return this.page.locator('.drive-row--folder').filter({
      has: this.page.locator('.drive-row-name', { hasText: new RegExp(`^${escapeRe(name)}$`) }),
    })
  }

  /** File row by visible name (e.g. "Jan 2024", "Zeta-Notes.pdf"). */
  file(name: string): Locator {
    return this.page.locator('.drive-row--file').filter({
      has: this.page.locator('.drive-row-name', { hasText: new RegExp(`^${escapeRe(name)}$`) }),
    })
  }

  /** Breadcrumb segment button by visible label. */
  crumb(name: string): Locator {
    return this.breadcrumb.getByRole('button', { name })
  }

  /** Returns the ordered list of file names currently displayed. */
  async fileRowNames(): Promise<string[]> {
    return this.page.locator('.drive-row--file .drive-row-name').allInnerTexts()
  }

  /**
   * Synthesize a drag-and-drop of a CSV File onto the drop zone. Uses
   * page.evaluateHandle to construct a real DataTransfer containing a real
   * File in the page context, then dispatches dragenter and drop events.
   */
  async dropCsvFile(name: string, content: string) {
    const dataTransfer = await this.page.evaluateHandle(
      ({ name, content }) => {
        const dt = new DataTransfer()
        dt.items.add(new File([content], name, { type: 'text/csv' }))
        return dt
      },
      { name, content },
    )
    await this.dropZone.dispatchEvent('dragenter', { dataTransfer })
    await this.dropZone.dispatchEvent('drop', { dataTransfer })
    await dataTransfer.dispose()
  }

  /** Upload a CSV via the hidden file input (the upload-button code path). */
  async uploadCsvViaInput(name: string, content: string) {
    await this.fileInput.setInputFiles({
      name,
      mimeType: 'text/csv',
      buffer: Buffer.from(content),
    })
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
