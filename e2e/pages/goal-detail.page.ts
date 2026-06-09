import { Page, Locator } from '@playwright/test'

export class GoalDetailPage {
  readonly page: Page

  // FI Card
  readonly fiCard: Locator
  readonly sparklineFigure: Locator
  readonly sparklineSvg: Locator

  // Savings Pace
  readonly savingsPlan: Locator
  readonly savingsPlanHighlightRow: Locator
  readonly savingsPlanEmpty: Locator

  // Analysis
  readonly analysisToggle: Locator
  readonly chartViewToggle: Locator

  // Back link
  readonly backLink: Locator
  readonly detailTitle: Locator

  constructor(page: Page) {
    this.page = page

    this.fiCard = page.locator('.fi-card')
    this.sparklineFigure = page.locator('.projection-chart-wrapper')
    this.sparklineSvg = this.sparklineFigure.locator('svg')

    this.savingsPlan = page.locator('.fi-goal-pace')
    this.savingsPlanHighlightRow = this.savingsPlan
    this.savingsPlanEmpty = this.savingsPlan.locator('a[href="#/budget"]')

    this.analysisToggle = page.getByRole('button', { name: /Analysis/ })
    this.chartViewToggle = page.getByRole('button', { name: 'Switch to chart view' })
    this.backLink = page.locator('.goal-detail-back-link')
    this.detailTitle = page.locator('.goal-detail-title')
  }

  async goto(goalId: number) {
    await this.page.goto(`/finance-tracking/#/goal/${goalId}`)
    await this.page.waitForLoadState('domcontentloaded')
  }

  async gotoHome() {
    await this.page.goto('/finance-tracking/')
    await this.page.waitForLoadState('domcontentloaded')
  }
}
