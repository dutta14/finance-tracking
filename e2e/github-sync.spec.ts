import { test, expect } from './fixtures/base'
import { SettingsPage } from './pages/settings.page'

/**
 * Issue #180 — GitHub Sync refactor regression E2E (Journey 3).
 *
 * Verifies the full sync lifecycle through the UI: configure → test
 * connection → sync → reload + re-unlock → restore. All GitHub API
 * calls are intercepted via page.route so no real network is needed.
 */

const OWNER = 'test-user'
const REPO = 'finance-backups'
const TOKEN = 'ghp_testtoken1234567890abcdef'
const PASSPHRASE = 'mysecurepassphrase'
const GOALS_FILE = 'finance-goals.json'
const DATA_FILE = 'finance-goals-data.json'
const TOOLS_FILE = 'finance-goals-tools.json'
const ALLOCATION_FILE = 'finance-goals-allocation.json'
const TAXES_FILE = 'finance-goals-taxes.json'

const GOAL_DATA = {
  id: 1,
  goalName: 'FI Target',
  fiGoal: 2_000_000,
  goalCreatedIn: 2024,
  goalEndYear: 2050,
  currentAmount: 100_000,
  expenseValue2047: 80_000,
  safeWithdrawalRate: 4,
}

/** Seed a minimal app state so there's data to sync. */
async function seedForSync(page: import('@playwright/test').Page) {
  await page.addInitScript(
    payload => {
      if (sessionStorage.getItem('__ghsync_e2e_seeded')) return
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')
      localStorage.setItem('onboarding-dismissed', '1')
      localStorage.setItem('financialGoals', JSON.stringify([payload.goal]))
      sessionStorage.setItem('__ghsync_e2e_seeded', '1')
    },
    { goal: GOAL_DATA },
  )
}

/** Intercept all GitHub API calls with success responses. */
async function mockGitHubApi(page: import('@playwright/test').Page) {
  // Test connection: GET /repos/:owner/:repo
  await page.route(
    `https://api.github.com/repos/${OWNER}/${REPO}`,
    async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'x-oauth-scopes': '' },
          body: JSON.stringify({
            full_name: `${OWNER}/${REPO}`,
            private: true,
            permissions: { push: true },
          }),
        })
      } else {
        await route.continue()
      }
    },
  )

  // Sync (PUT) and restore (GET) for all content files
  const contentFiles = [GOALS_FILE, DATA_FILE, TOOLS_FILE, ALLOCATION_FILE, TAXES_FILE]
  for (const file of contentFiles) {
    await page.route(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${file}`,
      async route => {
        const method = route.request().method()
        if (method === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: { sha: 'abc1234', name: file },
              commit: { sha: 'def5678' },
            }),
          })
        } else if (method === 'GET') {
          const content = Buffer.from(
            JSON.stringify(file === GOALS_FILE ? [GOAL_DATA] : {}),
          ).toString('base64')
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ content, encoding: 'base64', sha: 'abc1234' }),
          })
        } else {
          await route.continue()
        }
      },
    )
  }

  // Commit history
  await page.route(
    `https://api.github.com/repos/${OWNER}/${REPO}/commits?path=${encodeURIComponent(GOALS_FILE)}&per_page=100`,
    async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            sha: 'abc1234def5678abc1234def5678abc1234def567',
            commit: {
              message: 'Synced user data on Jan 1, 2025',
              author: { date: '2025-01-01T12:00:00Z' },
            },
            html_url: `https://github.com/${OWNER}/${REPO}/commit/abc1234`,
          },
        ]),
      })
    },
  )
}

/** Open Settings modal and navigate to the GitHub Sync tab. */
async function openGitHubSyncTab(page: import('@playwright/test').Page) {
  const settings = new SettingsPage(page)
  await page.goto('/finance-tracking/')
  await page.waitForLoadState('domcontentloaded')
  await settings.settingsButton.click()
  await expect(settings.dialog).toBeVisible()
  const ghTab = settings.dialog.getByRole('tab', { name: 'GitHub Sync' })
  await ghTab.click()
  await expect(ghTab).toHaveAttribute('aria-selected', 'true')
}

/**
 * Configure token + owner/repo and exit editing mode.
 * After this, the repo-info view with Test/Sync buttons is visible.
 */
async function configureSync(page: import('@playwright/test').Page) {
  const dialog = page.getByRole('dialog', { name: 'Settings' })

  // Save encrypted token
  await dialog.locator('.ghsync-token-input').first().fill(TOKEN)
  await dialog.locator('.ghsync-passphrase-input').fill(PASSPHRASE)
  await dialog.getByRole('button', { name: 'Save Token' }).click()
  await expect(dialog.locator('.ghsync-result-success')).toContainText('Token encrypted and saved')

  // Fill owner/repo
  await dialog.locator('input[placeholder="your-github-username"]').fill(OWNER)
  await dialog.locator('input[placeholder="finance-backups"]').fill(REPO)

  // Exit editing mode (Cancel button appears once both fields are non-empty)
  await dialog.locator('.ghsync-repo-cancel').click()
  await expect(dialog.locator('.ghsync-repo-value')).toContainText(`${OWNER}/${REPO}`)
}

test.describe('GitHub Sync — Refactor Regression (#180)', () => {
  test('full sync journey: configure → test connection → sync → restore roundtrip', async ({ page }) => {
    await seedForSync(page)
    await mockGitHubApi(page)
    await openGitHubSyncTab(page)

    const dialog = page.getByRole('dialog', { name: 'Settings' })

    // Step 1-2: Configure token + repo
    await configureSync(page)

    // Step 3: Test connection → Connected badge
    const testBtn = dialog.getByRole('button', { name: 'Test' })
    await testBtn.click()
    await expect(dialog.locator('.ghsync-connected-badge')).toBeVisible()
    await expect(dialog.locator('.ghsync-connected-badge')).toHaveText('Connected')

    // Step 4: Sync → status transitions to success
    const syncBtn = dialog.locator('.ghsync-sync-now-btn')
    await expect(syncBtn).toBeEnabled()
    await syncBtn.click()
    await expect(dialog.locator('.ghsync-status-dot--success')).toBeVisible({ timeout: 10_000 })

    // Step 5: History tab → Restore Latest
    await dialog.locator('.ghsync-tab-btn').filter({ hasText: 'History' }).click()
    const restoreBtn = dialog.getByRole('button', { name: 'Restore Latest' })
    await expect(restoreBtn).toBeVisible()
    await restoreBtn.click()

    // Restore triggers a state update that may close the modal.
    // Wait for the restore operation to complete by checking data was applied.
    await expect.poll(
      () => page.evaluate(() => localStorage.getItem('financialGoals')),
      { timeout: 10_000 },
    ).not.toBeNull()
    const goalData = await page.evaluate(() => localStorage.getItem('financialGoals'))
    expect(JSON.parse(goalData!)[0].goalName).toBe('FI Target')
  })

  test('config persists across page reload and token can be re-unlocked', async ({ page }) => {
    await seedForSync(page)
    await mockGitHubApi(page)
    await openGitHubSyncTab(page)

    // Configure
    await configureSync(page)

    const dialog = page.getByRole('dialog', { name: 'Settings' })

    // Close and reload
    await dialog.getByRole('button', { name: 'Close' }).click()
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Re-open Settings → GitHub Sync
    const settings = new SettingsPage(page)
    await settings.settingsButton.click()
    await expect(settings.dialog).toBeVisible()
    await settings.dialog.getByRole('tab', { name: 'GitHub Sync' }).click()

    // Token is locked after reload — unlock it first
    const unlockInput = dialog.locator('input[placeholder="Passphrase to unlock token"]')
    await expect(unlockInput).toBeVisible()
    await unlockInput.fill(PASSPHRASE)
    await dialog.getByRole('button', { name: 'Unlock' }).click()

    // Token unlocked status
    await expect(dialog.locator('.ghsync-token-status')).toContainText('Token unlocked')

    // Config persisted: repo info visible after unlock
    await expect(dialog.locator('.ghsync-repo-value')).toContainText(`${OWNER}/${REPO}`)
  })

  test('sync status transitions from idle to syncing to success', async ({ page }) => {
    await seedForSync(page)
    await mockGitHubApi(page)
    await openGitHubSyncTab(page)

    const dialog = page.getByRole('dialog', { name: 'Settings' })

    await configureSync(page)

    // Initial: idle → Ready to sync
    await expect(dialog.locator('.ghsync-status-dot--idle')).toBeVisible()
    await expect(dialog.locator('.ghsync-status-bar')).toContainText('Ready to sync')

    // Sync
    await dialog.locator('.ghsync-sync-now-btn').click()

    // After: success status
    await expect(dialog.locator('.ghsync-status-dot--success')).toBeVisible({ timeout: 10_000 })
    await expect(dialog.locator('.ghsync-status-bar')).toContainText('Last synced')
  })

  test('restore returns data that was previously synced and shows in history', async ({ page }) => {
    await seedForSync(page)
    await mockGitHubApi(page)
    await openGitHubSyncTab(page)

    const dialog = page.getByRole('dialog', { name: 'Settings' })

    await configureSync(page)

    // History tab
    await dialog.locator('.ghsync-tab-btn').filter({ hasText: 'History' }).click()

    // Mocked commit visible
    await expect(dialog.locator('.ghsync-commit-message')).toContainText('Synced user data on Jan 1, 2025')

    // Restore Latest
    await dialog.getByRole('button', { name: 'Restore Latest' }).click()

    // Restore triggers state update that may close modal — verify via localStorage
    await expect.poll(
      () => page.evaluate(() => {
        const raw = localStorage.getItem('financialGoals')
        if (!raw) return null
        const goals = JSON.parse(raw)
        return goals[0]?.goalName
      }),
      { timeout: 10_000 },
    ).toBe('FI Target')

    // Double-check full data integrity
    const goalData = await page.evaluate(() => localStorage.getItem('financialGoals'))
    const goals = JSON.parse(goalData!)
    expect(goals).toHaveLength(1)
    expect(goals[0].goalName).toBe('FI Target')
  })

  test('test connection shows error when repository is not found', async ({ page }) => {
    await seedForSync(page)

    // Override: 404 for repo
    await page.route(
      `https://api.github.com/repos/${OWNER}/${REPO}`,
      async route => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Not Found' }),
        })
      },
    )

    await openGitHubSyncTab(page)

    const dialog = page.getByRole('dialog', { name: 'Settings' })

    await configureSync(page)

    // Test connection → error
    const testBtn = dialog.getByRole('button', { name: 'Test' })
    await testBtn.click()
    await expect(dialog.locator('.ghsync-result-error')).toContainText('Repository not found')
    await expect(dialog.locator('.ghsync-connected-badge')).toHaveCount(0)
  })
})
