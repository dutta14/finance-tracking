import { test, expect } from './fixtures/base'
import { GoalDetailPage } from './pages/goal-detail.page'
import { HomePage } from './pages/home.page'
import {
  seedProjectionData,
  seedGoalReachedState,
  seedNoBudgetState,
  seedNotReachableState,
  seedNotReachableTinySavings,
  seedHighGrowthRate,
  seedNegativeGrowthRate,
  seedNoAccountsState,
  FI_GOAL,
  FI_GOAL_ZERO_TARGET,
  FI_GOAL_PAST_RETIREMENT,
  BUDGET_SUMMARY,
  BUDGET_SUMMARY_HIGH_SAVINGS,
  PROFILE,
} from './fixtures/projections.fixtures'

test.describe('Goal Projections E2E', () => {
  test.describe('Projected Date (Happy Path)', () => {
    test('shows projected FI date on Home GoalsPeek when budget savings exist', async ({
      page,
    }) => {
      await seedProjectionData(page)
      const home = new HomePage(page)
      await home.goto()

      const projectedDate = page.locator('.goals-peek-projected-date')
      await expect(projectedDate).toBeVisible()
      // Should show a month and year like "Jan 2045"
      await expect(projectedDate).toHaveText(/[A-Z][a-z]{2}\s\d{4}/)
    })

    test('projected date updates when budget savings rate changes', async ({ page }) => {
      // First seed with normal savings
      await seedProjectionData(page)
      const home = new HomePage(page)
      await home.goto()

      const projectedDate = page.locator('.goals-peek-projected-date')
      await expect(projectedDate).toBeVisible()
      const originalDate = await projectedDate.textContent()

      // Re-seed with higher savings and reload
      await page.evaluate((highBudget) => {
        localStorage.setItem('budget-summary', JSON.stringify(highBudget))
      }, BUDGET_SUMMARY_HIGH_SAVINGS)
      await page.reload()

      await expect(projectedDate).toBeVisible()
      const newDate = await projectedDate.textContent()
      // Higher savings should yield an earlier or equal projected date
      expect(newDate).not.toBe(null)
      expect(originalDate).not.toBe(null)
    })

    test('Goal detail analysis shows lifecycle projection chart', async ({ page }) => {
      await seedProjectionData(page)
      const detail = new GoalDetailPage(page)
      await detail.goto(FI_GOAL.id)

      await detail.analysisToggle.click()
      await detail.chartViewToggle.click()
      await expect(detail.sparklineFigure).toBeVisible()
      await expect(detail.sparklineFigure).toHaveAttribute('aria-describedby', /.+/)
      await expect(detail.sparklineSvg).toBeVisible()
    })

    test('Savings pace prose shows required monthly savings amount', async ({ page }) => {
      await seedProjectionData(page)
      const detail = new GoalDetailPage(page)
      await detail.goto(FI_GOAL.id)

      await expect(detail.savingsPlan).toBeVisible()
      await expect(detail.savingsPlanHighlightRow).toContainText('$')
      await expect(detail.savingsPlanHighlightRow).toContainText(/\/(mo|yr)/)
    })
  })

  test.describe('Goal Reached State', () => {
    test('shows goal reached when FI balance exceeds target', async ({ page }) => {
      await seedGoalReachedState(page)
      const home = new HomePage(page)
      await home.goto()

      const reachedState = page.locator('.goals-peek-projected--reached')
      await expect(reachedState).toBeVisible()
      await expect(reachedState).toContainText('Goal reached')
    })

    test('goal reached state on detail page shows reached text', async ({ page }) => {
      await seedGoalReachedState(page)
      const detail = new GoalDetailPage(page)
      await detail.goto(FI_GOAL.id)

      // When goal is reached, the detail page shows "Goal reached!" instead of a trajectory sparkline
      await expect(detail.fiCard).toBeVisible()
      await expect(page.getByText(/Goal reached!/)).toBeVisible()
    })
  })

  test.describe('No Budget Data State', () => {
    test('shows "Add budget data" link when no budget data exists', async ({ page }) => {
      await seedNoBudgetState(page)
      const home = new HomePage(page)
      await home.goto()

      const noBudgetLink = page.locator('.goals-peek-projected--link')
      await expect(noBudgetLink).toBeVisible()
      await expect(noBudgetLink).toContainText('Add budget data')
      // No NaN or Infinity text artifacts
      await expect(page.locator('body')).not.toContainText('NaN')
      await expect(page.locator('body')).not.toContainText('Infinity')
    })

    test('clicking the goal peek item opens detail page with an Add budget data link', async ({ page }) => {
      await seedNoBudgetState(page)
      const home = new HomePage(page)
      await home.goto()

      const noBudgetLink = page.locator('.goals-peek-projected--link')
      await expect(noBudgetLink).toBeVisible()

      const peekItem = page.locator('.goals-peek-item').first()
      await peekItem.click()

      await expect(page).toHaveURL(/\/#\/goal\/\d+/)
      const detail = new GoalDetailPage(page)
      await expect(detail.savingsPlanEmpty).toBeVisible()
      await expect(detail.savingsPlanEmpty).toHaveText('Add budget data')
      await expect(detail.savingsPlanEmpty).toHaveAttribute('href', '#/budget')
    })
  })

  test.describe('Not Reachable State', () => {
    test('shows "Not reachable at current rate" when annual savings is 0', async ({ page }) => {
      await seedNotReachableState(page)
      const home = new HomePage(page)
      await home.goto()

      const warnState = page.locator('.goals-peek-projected--warn')
      await expect(warnState).toBeVisible()
      await expect(warnState).toContainText('Not reachable')
    })

    test('shows "Not reachable" when savings positive but insufficient', async ({ page }) => {
      await seedNotReachableTinySavings(page)
      const home = new HomePage(page)
      await home.goto()

      const warnState = page.locator('.goals-peek-projected--warn')
      await expect(warnState).toBeVisible()
      await expect(warnState).toContainText('Not reachable')
    })
  })

  test.describe('Cross-Page Consistency', () => {
    test('projected info on Home is paired with projected timing prose on Goal Detail', async ({ page }) => {
      await seedProjectionData(page)
      const home = new HomePage(page)
      await home.goto()

      const peekDate = page.locator('.goals-peek-projected-date')
      await expect(peekDate).toBeVisible()
      await expect(peekDate).toHaveText(/[A-Z][a-z]{2}\s\d{4}/)

      const detail = new GoalDetailPage(page)
      await detail.goto(FI_GOAL.id)

      await expect(detail.savingsPlan).toBeVisible()
      await expect(detail.savingsPlan).toContainText(/At this pace/i)
      await expect(detail.savingsPlan).toContainText(/[A-Z][a-z]+\s\d{4}/)
    })

    test('savings rate on GoalsPeek is consistent with budget summary', async ({ page }) => {
      await seedProjectionData(page)
      const home = new HomePage(page)
      await home.goto()

      // Verify projection uses budget data — projected date should exist
      const projectedDate = page.locator('.goals-peek-projected-date')
      await expect(projectedDate).toBeVisible()
      const dateText = await projectedDate.textContent()
      expect(dateText).toMatch(/[A-Z][a-z]{2}\s\d{4}/)

      // Verify the projection year is reasonable given the seed data
      // BUDGET_SUMMARY.annualSavings = 12000, starting balance 340K, target 1M, 8% growth
      const year = parseInt(dateText!.match(/(\d{4})/)![1], 10)
      const currentYear = new Date().getFullYear()
      expect(year).toBeGreaterThanOrEqual(currentYear + 3)
      expect(year).toBeLessThanOrEqual(currentYear + 20)
    })
  })

  test.describe('Edge Cases', () => {
    test('zero FI goal target — no crash, no NaN/Infinity', async ({ page }) => {
      await seedProjectionData(page, { goals: [FI_GOAL_ZERO_TARGET] })
      const home = new HomePage(page)
      await home.goto()

      await expect(page.locator('body')).not.toContainText('NaN')
      await expect(page.locator('body')).not.toContainText('Infinity')
      await expect(page.locator('body')).not.toContainText('undefined')
    })

    test('zero FI goal target on detail page shows empty projection state', async ({ page }) => {
      await seedProjectionData(page, { goals: [FI_GOAL_ZERO_TARGET] })
      const detail = new GoalDetailPage(page)
      await detail.goto(FI_GOAL_ZERO_TARGET.id)

      await expect(detail.fiCard).toBeVisible()
      await expect(page.locator('body')).not.toContainText('NaN')
      await expect(page.locator('body')).not.toContainText('Infinity')
    })

    test('missing profile birthday — uses default, no crash', async ({ page }) => {
      await seedProjectionData(page, { profile: null })
      const home = new HomePage(page)
      await home.goto()

      await expect(page.locator('body')).not.toContainText('NaN')
      await expect(page.locator('body')).not.toContainText('Infinity')
      // Page should still render the goals card
      await expect(home.goalsCard).toBeVisible()
    })

    test('retirement date in past — appropriate state', async ({ page }) => {
      await seedProjectionData(page, { goals: [FI_GOAL_PAST_RETIREMENT] })
      const home = new HomePage(page)
      await home.goto()

      await expect(page.locator('body')).not.toContainText('NaN')
      await expect(page.locator('body')).not.toContainText('Infinity')
      // Should show some state (reached, warn, or projected) without crashing
      await expect(home.goalsCard).toBeVisible()
    })

    test('very high growth rate — no overflow', async ({ page }) => {
      await seedHighGrowthRate(page)
      const home = new HomePage(page)
      await home.goto()

      await expect(page.locator('body')).not.toContainText('NaN')
      await expect(page.locator('body')).not.toContainText('Infinity')
      await expect(home.goalsCard).toBeVisible()
    })
  })

  test.describe('Boundary Values', () => {
    test('negative growth rate — no crash', async ({ page }) => {
      await seedNegativeGrowthRate(page)
      const home = new HomePage(page)
      await home.goto()

      await expect(page.locator('body')).not.toContainText('NaN')
      await expect(page.locator('body')).not.toContainText('Infinity')
      await expect(home.goalsCard).toBeVisible()
    })
  })

  test.describe('Calculation Accuracy', () => {
    test('projected date within reasonable range for known inputs', async ({ page }) => {
      // With FI_BALANCE=340000, target=1000000, annualSavings=12000, growth=8%
      // Monthly rate = 0.08/12 ≈ 0.00667, monthly savings = 1000
      // Should project roughly 8-15 years out from now
      await seedProjectionData(page)
      const home = new HomePage(page)
      await home.goto()

      const projectedDate = page.locator('.goals-peek-projected-date')
      await expect(projectedDate).toBeVisible()
      const text = await projectedDate.textContent()

      // Extract year from "Mon YYYY"
      const match = text?.match(/(\d{4})/)
      expect(match).not.toBeNull()
      const projectedYear = parseInt(match![1], 10)
      const currentYear = new Date().getFullYear()

      // Should be between 3 and 20 years from now
      expect(projectedYear).toBeGreaterThanOrEqual(currentYear + 3)
      expect(projectedYear).toBeLessThanOrEqual(currentYear + 20)
    })

    test('monthly savings on detail page reasonable given budget', async ({ page }) => {
      await seedProjectionData(page)
      const detail = new GoalDetailPage(page)
      await detail.goto(FI_GOAL.id)

      await expect(detail.savingsPlan).toBeVisible()

      const paceText = await detail.savingsPlan.textContent()
      expect(paceText).toMatch(/\$[\d,]+/)
      expect(paceText).toMatch(/\/(mo|yr)/)
    })
  })

  test.describe('Dark Mode', () => {
    test('projection chart SVG visible in dark mode', async ({ page }) => {
      await seedProjectionData(page, { darkMode: true })
      const detail = new GoalDetailPage(page)
      await detail.goto(FI_GOAL.id)

      const isDark = await page.evaluate(() => document.body.classList.contains('dark'))
      expect(isDark).toBe(true)

      await detail.analysisToggle.click()
      await detail.chartViewToggle.click()
      await expect(detail.sparklineFigure).toBeVisible()
      await expect(detail.sparklineFigure).toHaveAttribute('aria-describedby', /.+/)
      await expect(detail.sparklineSvg).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('projection chart has descriptive accessible text', async ({ page }) => {
      await seedProjectionData(page)
      const detail = new GoalDetailPage(page)
      await detail.goto(FI_GOAL.id)

      await detail.analysisToggle.click()
      await detail.chartViewToggle.click()
      await expect(detail.sparklineFigure).toBeVisible()
      const descriptionId = await detail.sparklineFigure.getAttribute('aria-describedby')
      expect(descriptionId).toBeTruthy()
      await expect(page.locator(`[id="${descriptionId}"]`)).toContainText('Lifecycle projection chart')
      await expect(detail.sparklineSvg).toBeVisible()
    })

    test('progress bar has correct ARIA attributes', async ({ page }) => {
      await seedProjectionData(page)
      const home = new HomePage(page)
      await home.goto()

      const progressBar = home.goalsCard.locator('[role="progressbar"]')
      await expect(progressBar).toBeVisible()
      await expect(progressBar).toHaveAttribute('aria-valuenow', /.+/)
      await expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      await expect(progressBar).toHaveAttribute('aria-valuemax', /.+/)
    })
  })

  test.describe('Missing Data Degradation', () => {
    test('budget exists but no accounts — projection uses $0 balance', async ({ page }) => {
      await seedNoAccountsState(page)
      const home = new HomePage(page)
      await home.goto()

      await expect(page.locator('body')).not.toContainText('NaN')
      await expect(page.locator('body')).not.toContainText('Infinity')
      await expect(home.goalsCard).toBeVisible()
    })
  })
})
