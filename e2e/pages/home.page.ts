import { Page, Locator } from '@playwright/test'

export class HomePage {
  readonly page: Page

  // Greeting
  readonly greeting: Locator
  readonly setupGuideLink: Locator

  // Setup Progress
  readonly setupProgress: Locator
  readonly setupHeading: Locator
  readonly setupProgressBar: Locator
  readonly setupProgressCount: Locator
  readonly setupDismissBtn: Locator
  readonly setupSteps: Locator

  // Card Grid
  readonly cardGrid: Locator

  // Net Worth Card
  readonly nwCard: Locator
  readonly nwAmount: Locator
  readonly nwDate: Locator
  readonly nwViewLink: Locator

  // Goals Card
  readonly goalsCard: Locator
  readonly goalsViewLink: Locator
  readonly goalsPeekItems: Locator

  // Allocation Card
  readonly allocCard: Locator
  readonly allocViewLink: Locator

  // Reorder
  readonly reorderAnnouncement: Locator

  // Search Modal
  readonly searchDialog: Locator
  readonly searchInput: Locator
  readonly searchResults: Locator

  // Error Boundary
  readonly errorCard: Locator
  readonly errorRetryBtn: Locator

  constructor(page: Page) {
    this.page = page

    this.greeting = page.locator('.home-greeting h1')
    this.setupGuideLink = page.locator('button.setup-guide-link')

    this.setupProgress = page.locator('.setup-progress')
    this.setupHeading = page.locator('#setup-heading')
    this.setupProgressBar = page.getByRole('progressbar', { name: 'Setup progress' })
    this.setupProgressCount = page.locator('.setup-progress-count')
    this.setupDismissBtn = page.getByLabel('Dismiss setup guide')
    this.setupSteps = page.locator('.setup-step')

    this.cardGrid = page.locator('.home-grid')

    this.nwCard = page.locator('.home-card--nw')
    this.nwAmount = page.locator('.nw-amount')
    this.nwDate = page.locator('.nw-date')
    this.nwViewLink = this.nwCard.locator('.home-card-link')

    this.goalsCard = page.locator('.home-card--goals')
    this.goalsViewLink = this.goalsCard.locator('.home-card-link')
    this.goalsPeekItems = page.locator('.goals-peek-item')

    this.allocCard = page.locator('.home-card--alloc')
    this.allocViewLink = this.allocCard.locator('.home-card-link')

    this.reorderAnnouncement = page.locator('[aria-live="polite"].sr-only')

    this.searchDialog = page.getByRole('dialog', { name: 'Search' })
    this.searchInput = page.locator('.search-modal-input')
    this.searchResults = page.locator('[role="listbox"]')

    this.errorCard = page.locator('.error-boundary-card')
    this.errorRetryBtn = page.locator('.error-boundary-card-btn')
  }

  async goto() {
    await this.page.goto('/finance-tracking/')
    await this.page.waitForLoadState('domcontentloaded')
  }

  getSlot(index: number): Locator {
    return this.page.getByTestId(`drag-slot-${index}`)
  }

  getCardHeadingInSlot(index: number): Locator {
    return this.getSlot(index).locator('h3')
  }

  getMoveUpBtn(cardName: string): Locator {
    return this.page.getByLabel(`Move ${cardName} up`)
  }

  getMoveDownBtn(cardName: string): Locator {
    return this.page.getByLabel(`Move ${cardName} down`)
  }

  getSetupStepCta(text: string): Locator {
    return this.setupProgress.locator('.setup-step-cta', { hasText: text })
  }

  async openSearchModal() {
    // The app listens for (metaKey || ctrlKey) && key === 'k'
    await this.page.keyboard.press('Control+k')
  }

  async clearStorage() {
    await this.page.evaluate(() => localStorage.clear())
  }
}
