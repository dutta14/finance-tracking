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
  readonly projectedResult: Locator

  // Analysis
  readonly analysisToggle: Locator
  readonly chartViewToggle: Locator

  // Back link
  readonly backLink: Locator
  readonly detailTitle: Locator

  constructor(page: Page) {
    this.page = page

    this.fiCard = page.locator('.goal-detail-section').first().locator('.fi-card').first()
    this.sparklineFigure = page.locator('.projection-chart-wrapper').first()
    this.sparklineSvg = this.sparklineFigure.locator('svg')

    this.savingsPlan = page.locator('.fi-projection-block, .fi-goal-pace').first()
    this.savingsPlanHighlightRow = page.locator('.fi-projection-row').filter({ hasText: 'Save' }).first()
    this.savingsPlanEmpty = page.locator('.fi-goal-pace a[href="#/budget"]')
    this.projectedResult = page.locator('.fi-projection-result').first()

    this.analysisToggle = page.getByRole('group', { name: 'Analysis type' }).getByRole('button', { name: 'FI' })
    this.chartViewToggle = page.getByRole('group', { name: 'View mode' }).getByRole('button', { name: 'Chart' }).first()
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
