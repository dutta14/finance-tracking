import { Page, Locator } from '@playwright/test'

export class GoalDetailPage {
  readonly page: Page

  // FI Card
  readonly fiCard: Locator
  readonly fiCardTrajectory: Locator
  readonly sparklineFigure: Locator
  readonly sparklineSvg: Locator
  readonly sparklineCaption: Locator

  // Savings Plan
  readonly savingsPlan: Locator
  readonly savingsPlanTitle: Locator
  readonly savingsPlanHighlightRow: Locator
  readonly savingsPlanEmpty: Locator

  // Projection states
  readonly projectedDate: Locator
  readonly trajectoryOnTrack: Locator
  readonly trajectoryAhead: Locator
  readonly trajectoryBehind: Locator

  // Back link
  readonly backLink: Locator
  readonly detailTitle: Locator

  constructor(page: Page) {
    this.page = page

    this.fiCard = page.locator('.fi-card')
    this.fiCardTrajectory = page.locator('.fi-card-trajectory')
    this.sparklineFigure = page.locator('[aria-label="Savings trajectory projection"]')
    this.sparklineSvg = this.sparklineFigure.locator('svg')
    this.sparklineCaption = this.sparklineFigure.locator('figcaption')

    this.savingsPlan = page.locator('.splan')
    this.savingsPlanTitle = page.locator('.splan-title')
    this.savingsPlanHighlightRow = page.locator('.splan-compare-row--highlight')
    this.savingsPlanEmpty = page.locator('.splan-empty')

    this.projectedDate = page.locator('.goals-peek-projected-date')
    this.trajectoryOnTrack = page.locator('.fi-card-trajectory[data-status="on-track"]')
    this.trajectoryAhead = page.locator('.fi-card-trajectory[data-status="ahead"]')
    this.trajectoryBehind = page.locator('.fi-card-trajectory[data-status="behind"]')

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

  getTrajectoryStatus(): Locator {
    return this.fiCardTrajectory
  }
}
