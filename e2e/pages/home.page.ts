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
  readonly setupStepsDone: Locator
  readonly setupStepsCurrent: Locator
  readonly setupStepCta: Locator

  // Card Grid
  readonly cardGrid: Locator

  // Net Worth Card
  readonly nwCard: Locator
  readonly nwAmount: Locator
  readonly nwChange: Locator
  readonly nwChangeUp: Locator
  readonly nwChangeDown: Locator
  readonly nwDate: Locator
  readonly nwViewLink: Locator

  // Goals Card
  readonly goalsCard: Locator
  readonly goalsViewLink: Locator
  readonly goalsPeekItems: Locator

  // Allocation Card
  readonly allocCard: Locator
  readonly allocGrid: Locator
  readonly allocViewLink: Locator

  // Charts Card
  readonly chartsCard: Locator

  // CTA Buttons (empty states)
  readonly ctaBtn: Locator

  // Reorder
  readonly reorderAnnouncement: Locator

  // Search Modal
  readonly searchDialog: Locator
  readonly searchInput: Locator
  readonly searchResults: Locator
  readonly searchResultActive: Locator

  // Error Boundary
  readonly errorCard: Locator
  readonly errorRetryBtn: Locator

  // Sidebar
  readonly sidebarOverlay: Locator

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
    this.setupStepsDone = page.locator('.setup-step--done')
    this.setupStepsCurrent = page.locator('.setup-step--current')
    this.setupStepCta = page.locator('.setup-step-cta')

    this.cardGrid = page.locator('.home-grid')

    this.nwCard = page.locator('.home-card--nw')
    this.nwAmount = page.locator('.nw-amount')
    this.nwChange = page.locator('.nw-change')
    this.nwChangeUp = page.locator('.nw-change.up')
    this.nwChangeDown = page.locator('.nw-change.down')
    this.nwDate = page.locator('.nw-date')
    this.nwViewLink = this.nwCard.locator('.home-card-link')

    this.goalsCard = page.locator('.home-card--goals')
    this.goalsViewLink = this.goalsCard.locator('.home-card-link')
    this.goalsPeekItems = page.locator('.goals-peek-item')

    this.allocCard = page.locator('.home-card--alloc')
    this.allocGrid = this.allocCard.locator('.alloc-grid')
    this.allocViewLink = this.allocCard.locator('.home-card-link')

    this.chartsCard = page.locator('.home-card--charts')

    this.ctaBtn = page.locator('.home-card-cta-btn')

    this.reorderAnnouncement = page.locator('[aria-live="polite"].sr-only')

    this.searchDialog = page.getByRole('dialog', { name: 'Search' })
    this.searchInput = page.locator('.search-modal-input')
    this.searchResults = page.locator('[role="listbox"]')
    this.searchResultActive = page.locator('.search-result--active')

    this.errorCard = page.locator('.error-boundary-card')
    this.errorRetryBtn = page.locator('.error-boundary-card-btn')

    this.sidebarOverlay = page.locator('.sidebar-overlay')
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

  getNwCardCtaBtn(): Locator {
    return this.nwCard.locator('.home-card-cta-btn')
  }

  getGoalsCardCtaBtn(): Locator {
    return this.goalsCard.locator('.home-card-cta-btn')
  }

  async openSearchModal() {
    await this.page.keyboard.press('Control+k')
  }

  async dismissSidebarIfVisible() {
    const overlay = this.sidebarOverlay
    if (await overlay.isVisible()) {
      // Use JS click because the sidebar nav intercepts Playwright's action click
      await this.page.evaluate(() => {
        const el = document.querySelector('.sidebar-overlay') as HTMLElement
        el?.click()
      })
      await overlay.waitFor({ state: 'hidden', timeout: 5000 })
    }
  }

  async clearStorage() {
    await this.page.evaluate(() => localStorage.clear())
  }
}
