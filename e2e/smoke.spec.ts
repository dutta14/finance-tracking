import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('renders the app with correct page title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Finance Tracking')
  })

  test('displays the sidebar navigation with expected links', async ({ page }) => {
    await page.goto('/')

    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav).toBeVisible()

    await expect(nav.getByRole('button', { name: 'Home' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Goals' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Net Worth' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Budget' })).toBeVisible()
  })

  test('navigates to home page by default', async ({ page }) => {
    await page.goto('/')

    const homeLink = page.getByRole('button', { name: 'Home' })
    await expect(homeLink).toHaveAttribute('aria-current', 'page')
  })
})
