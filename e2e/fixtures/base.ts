import { test as base, expect } from '@playwright/test'

/**
 * Global feature-flags mock fixture (#146).
 *
 * Every e2e test automatically intercepts the GitHub Contents API call
 * that FlagContext makes on mount:
 *   GET https://api.github.com/repos/dutta14/finance-tracking/contents/feature-flags.json
 *
 * Without this mock, anonymous GitHub API rate-limits (403) leak into
 * console-error assertions and slow down CI with real network calls.
 *
 * The mock returns `{ flags: {} }` (all flags at their coded defaults).
 * Individual tests can still override with their own `page.route` call
 * registered AFTER this one — Playwright uses last-registered-wins order.
 */

export const test = base.extend<{ featureFlagsMock: void }>({
  featureFlagsMock: [
    async ({ page }, use) => {
      await page.route(
        'https://api.github.com/repos/dutta14/finance-tracking/contents/feature-flags.json',
        async route => {
          const content = Buffer.from(JSON.stringify({ flags: {} })).toString('base64')
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ content, encoding: 'base64' }),
          })
        },
      )
      await use()
    },
    { auto: true },
  ],
})

export { expect }
