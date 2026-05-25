import { test, expect, Page } from '@playwright/test'
import { SecurityPage } from './pages/security.page'
import { assertAllKeysAreEnvelopes, isEnvelope, readEnvelope, SENSITIVE_KEYS } from './fixtures/encryption.fixtures'
import {
  seedBudgetCsvsForYear,
  seedCrossPageEncrypted,
  URLS,
} from './fixtures/cross-page-data'

/**
 * #153 — Cross-page: Encryption Round-trip Integration (62c)
 *
 * 6 tests across Flow 6 (lock/unlock → all pages) plus enable→export→
 * disable→factory-reset→import (test 38).
 *
 * Adaptations from audit-153:
 *  - A: No Lock button in UI. To lock the SAME tab programmatically,
 *       dispatch `encryption-remote-lock` CustomEvent (matches the
 *       existing pattern in encryption.spec.ts line 83). The
 *       `dispatchRemoteLock` helper writes `_encryption-lock-signal`,
 *       which only fires a native `storage` event in OTHER tabs — the
 *       writer tab never receives its own write, so it is useless for
 *       single-tab locking.
 *  - B: Encryption enablement requires the UI path (PBKDF2 + envelope
 *       migration). Use the `seedCrossPageEncrypted` helper, which
 *       seeds + opens Settings/Security + drives `SecurityPage.enable`.
 *  - C: PBKDF2 adds ~1s per enable/unlock. Suite test timeout bumped to
 *       60s to absorb 2 enables + 1 unlock + nav in the worst case.
 *  - D: After unlock, React context re-renders. No `page.reload()` is
 *       needed — just `page.goto(targetPage)`.
 *  - E: Wrong passphrase keeps UnlockScreen visible. The error message
 *       in `#unlock-passphrase-error` reads "Wrong passphrase. Please
 *       try again." and the input is cleared. Sensitive keys stay
 *       encrypted (envelope shape).
 *  - F: Factory Reset = `localStorage.clear()` + `window.location.reload()`
 *       (ImportExportContext.tsx:138-141). The AdvancedPane button has
 *       a two-step confirm flow — click "Factory Reset App" → click
 *       "Yes, Reset Everything".
 *  - G: `.mini-progress-pct` = "13%". GoalsPeek/GoalMiniCard use
 *       `getLatestGoalTotals().fiTotal`, which sums ONLY FI-classified
 *       accounts (260000 / 2000000 = 13%). The Savings (GW) account
 *       is excluded from this percentage.
 *  - H: `.nw-amount` = "$315,000". NetWorthSummary sums ALL accounts'
 *       latest balances (260000 + 55000 = $315,000), unlike GoalsPeek.
 *  - I: Budget page recomputes saveRate from CSVs at render time; it
 *       does NOT consume `budget-summary` from localStorage. To make
 *       test 24 verify a literal "35.0%" we seed currentYear CSVs at
 *       10000 in / -6500 out → saveRate = 1 - 78000/120000 = 0.35.
 *       (`budget-summary` is what GoalsPeek consumes on Home; that's
 *        unchanged from the cross-page baseline.)
 */

const PASSPHRASE = 'TestPass123!'
const WRONG_PASSPHRASE = 'WrongPass456!'
const HOME = '/finance-tracking/'

async function gotoAndSettle(page: Page, url: string, heading: RegExp): Promise<void> {
  await page.goto(url)
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('heading', { name: heading }).first().waitFor()
}

/**
 * Lock the current tab. EncryptionContext listens for
 * `encryption-remote-lock` CustomEvent (EncryptionContext.tsx:105) and
 * clears the in-memory key, which flips `isLocked` and mounts
 * UnlockScreen. Equivalent to what `appStorage.lock()` triggers, but
 * synchronous and same-tab.
 */
async function lockSameTab(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('encryption-remote-lock'))
  })
}

async function unlockWith(page: Page, passphrase: string): Promise<void> {
  await page.locator('#unlock-passphrase').fill(passphrase)
  await page.getByRole('button', { name: /^Unlock$|^Unlocking…$/ }).click()
}

test.describe('Cross-page: Encryption Round-trip Integration (#153)', () => {
  // PBKDF2 + envelope migration costs ~1s per enable/unlock. Each test
  // here runs 1-2 enables + 0-1 unlocks; the full-roundtrip test 38
  // additionally exports, disables, factory-resets, and imports.
  test.setTimeout(60_000)

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    // Same one-shot-sentinel reset pattern as #151/#152: lets each test
    // re-seed on first navigation but preserves in-test mutations.
    await page.addInitScript(() => {
      try {
        if (sessionStorage.getItem('__cross_page_test_started') !== '1') {
          sessionStorage.setItem('__cross_page_test_started', '1')
          localStorage.removeItem('__cross_page_seeded')
        }
      } catch {
        /* ignore */
      }
    })
  })

  /* ────────────────────────────────────────────────────────────
   * Flow 6: Enable → Lock → Unlock → render data on each page
   * ──────────────────────────────────────────────────────────── */
  test.describe('Flow 6: Lock → Unlock → All Pages', () => {
    test('21. Home page shows $315,000 net worth and Early Retirement goal after unlock', async ({
      page,
    }) => {
      // Adaptations B, A, D, H, G + enhanced assertion.
      const security = await seedCrossPageEncrypted(page, PASSPHRASE)
      // Close the Settings modal before locking so the unlock screen
      // is the only thing on top after the lock.
      await page.keyboard.press('Escape')
      await expect(security.settingsModal).toBeHidden()

      await lockSameTab(page)
      await expect(page.getByRole('heading', { name: /unlock your data/i })).toBeVisible()

      await unlockWith(page, PASSPHRASE)
      await expect(page.getByRole('heading', { name: /unlock your data/i })).toBeHidden()

      // Adaptation D: no reload — after unlock, the React context's
      // cryptoKey is set and the app re-renders Home (we were already
      // on `/finance-tracking/`). Calling `page.goto('/finance-tracking/')`
      // would trigger a fresh load, dropping the in-memory key and
      // bouncing us back to UnlockScreen.

      // Adaptation H: NetWorthSummary sums all accounts for the latest
      // month (2025-04 → 260000 + 55000 = $315,000).
      await expect(page.locator('.nw-amount').first()).toHaveText(/\$315,000/)

      // GoalsPeek renders the seeded goal name.
      const goalsCard = page.locator('.home-card--goals')
      await expect(goalsCard).toBeVisible()
      await expect(goalsCard.getByText('Early Retirement').first()).toBeVisible()

      // Enhanced assertion (#153 spec): encryption remains active —
      // every sensitive key still holds { v, iv, ct } after unlock.
      // Encryption must not have silently disabled itself.
      await assertAllKeysAreEnvelopes(page)
      expect(await page.evaluate(() => localStorage.getItem('encryption-enabled'))).toBe('1')
    })

    test('22. Goals page shows retirement year 2045 and FI progress 13% after unlock', async ({
      page,
    }) => {
      // Adaptation G: `.mini-progress-pct` = 13% (FI-only sum:
      // 260000/2000000). The Savings GW account is NOT included.
      const security = await seedCrossPageEncrypted(page, PASSPHRASE)
      await page.keyboard.press('Escape')
      await expect(security.settingsModal).toBeHidden()

      await lockSameTab(page)
      await expect(page.getByRole('heading', { name: /unlock your data/i })).toBeVisible()
      await unlockWith(page, PASSPHRASE)
      await expect(page.getByRole('heading', { name: /unlock your data/i })).toBeHidden()

      await gotoAndSettle(page, URLS.goal, /^goals$/i)

      const card = page.locator('.goal-mini-card').first()
      await expect(card).toBeVisible()
      // birthday 1990-06-15 + retirementAge 55 → 2045.
      await expect(card.locator('.mini-retire-year')).toHaveText('2045')
      await expect(card.locator('.mini-progress-pct')).toHaveText('13%')
      // FI goal label renders as "$2,000,000".
      await expect(card).toContainText('$2,000,000')
    })

    test('23. Net Worth page lists 401k + Savings accounts with latest balances after unlock', async ({
      page,
    }) => {
      const security = await seedCrossPageEncrypted(page, PASSPHRASE)
      await page.keyboard.press('Escape')
      await expect(security.settingsModal).toBeHidden()

      await lockSameTab(page)
      await expect(page.getByRole('heading', { name: /unlock your data/i })).toBeVisible()
      await unlockWith(page, PASSPHRASE)
      await expect(page.getByRole('heading', { name: /unlock your data/i })).toBeHidden()

      await gotoAndSettle(page, URLS.netWorth, /^net worth$/i)

      // Default sub-view is Charts. Click Spreadsheet to expose
      // `.data-spreadsheet-account-name` headers.
      await page.getByRole('tab', { name: 'Spreadsheet' }).click()

      // Account columns render `.data-spreadsheet-account-name` headers.
      const names = page.locator('.data-spreadsheet-account-name')
      await expect(names.filter({ hasText: '401k' }).first()).toBeVisible()
      await expect(names.filter({ hasText: 'Savings' }).first()).toBeVisible()

      // Latest balance cells (formatCurrency renders "$260,000" /
      // "$55,000" — no fractional digits).
      const sheet = page.locator('.data-spreadsheet')
      await expect(sheet.first()).toContainText('$260,000')
      await expect(sheet.first()).toContainText('$55,000')
    })

    test('24. Budget page shows imported CSVs and 35.0% save rate after unlock', async ({
      page,
    }) => {
      // Adaptation I: Budget page recomputes saveRate from CSVs. We
      // seed `currentYear` (Budget defaults `selectedYear` =
      // new Date().getFullYear()) with 12 monthly CSVs at $10,000 in /
      // -$6,500 out → totalIncome=120000, totalExpense=78000,
      // saveRate = 1 - 78000/120000 = 0.35 → renders "35.0%".
      const currentYear = new Date().getFullYear()
      const security = await seedCrossPageEncrypted(page, PASSPHRASE, {
        budgetStore: seedBudgetCsvsForYear(currentYear, 10_000, 6_500),
      })
      await page.keyboard.press('Escape')
      await expect(security.settingsModal).toBeHidden()

      await lockSameTab(page)
      await expect(page.getByRole('heading', { name: /unlock your data/i })).toBeVisible()
      await unlockWith(page, PASSPHRASE)
      await expect(page.getByRole('heading', { name: /unlock your data/i })).toBeHidden()

      await gotoAndSettle(page, URLS.budget, /^budget$/i)

      // BudgetSummary card for the selected (current) year.
      const saveCard = page.locator('.budget-summary-card--save')
      await expect(saveCard).toBeVisible()
      await expect(saveCard.locator('.budget-summary-value')).toHaveText('35.0%')
      // 35.0% (1 − 6500/10000) is computed from the imported CSV
      // transaction rows; the value can only be correct if the encrypted
      // `budget-csvs-*` envelope decrypted successfully.
    })

    test('25. Wrong passphrase keeps UnlockScreen visible and all 13 keys remain envelopes', async ({
      page,
    }) => {
      // Adaptation E: UnlockScreen stays mounted, error message reads
      // "Wrong passphrase. Please try again.", input is cleared, no
      // sensitive data leaks.
      const security = await seedCrossPageEncrypted(page, PASSPHRASE)
      await page.keyboard.press('Escape')
      await expect(security.settingsModal).toBeHidden()

      await lockSameTab(page)
      const unlockHeading = page.getByRole('heading', { name: /unlock your data/i })
      await expect(unlockHeading).toBeVisible()

      await unlockWith(page, WRONG_PASSPHRASE)

      // Stays on UnlockScreen with the error.
      await expect(unlockHeading).toBeVisible()
      await expect(page.locator('#unlock-passphrase-error')).toHaveText(
        /Wrong passphrase\. Please try again\./,
      )
      // Input was cleared.
      await expect(page.locator('#unlock-passphrase')).toHaveValue('')

      // Every sensitive key still holds { v, iv, ct }.
      await assertAllKeysAreEnvelopes(page)
      expect(await page.evaluate(() => localStorage.getItem('encryption-enabled'))).toBe('1')

      // Correct passphrase still works after the failed attempt (no
      // lockout, no relock storm).
      await unlockWith(page, PASSPHRASE)
      await expect(unlockHeading).toBeHidden()
    })
  })

  /* ────────────────────────────────────────────────────────────
   * Edge case: enable → export → disable → factory reset → import
   * ──────────────────────────────────────────────────────────── */
  test.describe('Edge cases', () => {
    test('38. Enable → export → disable → factory reset → import → no encryption artifacts and all pages render', async ({
      page,
    }) => {
      // Adaptation F + ImportExportContext.tsx:31-71,138-141. The
      // exported v2 payload is plaintext (appStorage.getJSON
      // transparently decrypts before serialization), so the imported
      // file has no envelope shapes inside it. After factory reset +
      // import, the app must:
      //   - have no `encryption-enabled` / `encryption-salt` /
      //     `encryption-verify` keys in localStorage
      //   - render Home with the original $315,000 net worth and
      //     Early Retirement goal
      //   - render Net Worth with the original accounts
      const security = await seedCrossPageEncrypted(page, PASSPHRASE)

      // Step 1: Export while encrypted. The download is plaintext.
      await page.getByRole('button', { name: 'Advanced', exact: true }).click()
      const exportBtn = page.getByRole('button', { name: /^Export$/ })
      await expect(exportBtn).toBeVisible()
      const [download] = await Promise.all([page.waitForEvent('download'), exportBtn.click()])

      // Read the exported file content (Playwright streams to a temp
      // path). The body is the v2 JSON payload.
      const downloadPath = await download.path()
      expect(downloadPath).not.toBeNull()
      const fs = await import('node:fs/promises')
      const exportedBytes = await fs.readFile(downloadPath as string)
      const exportedText = exportedBytes.toString('utf-8')
      const parsed = JSON.parse(exportedText) as { version: number; goals: unknown[] }
      expect(parsed.version).toBe(2)
      expect(Array.isArray(parsed.goals)).toBe(true)
      // Sanity: the exported payload is plaintext (no envelope shapes
      // anywhere at the top level).
      for (const key of Object.keys(parsed)) {
        expect(isEnvelope((parsed as Record<string, unknown>)[key])).toBe(false)
      }

      // Step 2: Disable encryption.
      await page.getByRole('button', { name: 'Security', exact: true }).click()
      await security.disable(PASSPHRASE)
      await expect(security.status).toHaveText(/Encryption disabled/)

      // Step 3: Factory reset via the Advanced pane (two-step confirm).
      await page.getByRole('button', { name: 'Advanced', exact: true }).click()
      await page.getByRole('button', { name: /^Factory Reset App$/ }).click()
      // Confirm dialog appears with "Yes, Reset Everything".
      await Promise.all([
        page.waitForLoadState('load'),
        page.getByRole('button', { name: /^Yes, Reset Everything$/ }).click(),
      ])

      // Confirm factory reset wiped the encryption lifecycle keys
      // (the cross-page seed's `addInitScript` re-runs on this reload
      // and re-plants plaintext data, but it sets
      // `encryption-enabled='0'` and never plants `encryption-salt` or
      // `encryption-verify` — so those three keys are our reset proof).
      const postReset = await page.evaluate(() => ({
        enabled: localStorage.getItem('encryption-enabled'),
        salt: localStorage.getItem('encryption-salt'),
        verify: localStorage.getItem('encryption-verify'),
      }))
      expect(postReset.enabled).not.toBe('1')
      expect(postReset.salt).toBeNull()
      expect(postReset.verify).toBeNull()

      // Step 4: Import the exported file via Settings → Advanced.
      // ImportExportContext.handleImport schedules a reload 200ms
      // after dispatching `data-changed`; wait for that reload to
      // complete before asserting on the post-import UI.
      await page.getByRole('button', { name: 'Settings' }).click()
      await page.getByRole('dialog').waitFor({ state: 'visible' })
      await page.getByRole('button', { name: 'Advanced', exact: true }).click()
      // The Advanced pane renders a hidden <input type="file"> that the
      // "Import" button click-forwards to. setInputFiles works directly
      // on the hidden input.
      const fileInput = page.locator('input[type="file"][accept=".json"]')
      await fileInput.setInputFiles({
        name: 'cross-page-export.json',
        mimeType: 'application/json',
        buffer: exportedBytes,
      })
      // Wait for the in-app reload that handleImport schedules.
      await page.waitForLoadState('load')

      // Step 5: After import + reload, navigate Home and assert data is
      // back, AND the encryption artifacts are absent. The
      // `__cross_page_seeded` sentinel from seedCrossPage's
      // addInitScript would re-seed on this fresh load — that's fine
      // for THIS test because the imported payload overwrote
      // localStorage just before the reload, and on the next nav the
      // sentinel sees `__cross_page_seeded='1'` AND the imported keys
      // are already present, so nothing is overwritten. We re-navigate
      // explicitly to make sure we're not still on /settings.
      await page.goto(HOME)
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('.nw-amount').first()).toHaveText(/\$315,000/)
      await expect(page.locator('.home-card--goals').getByText('Early Retirement').first()).toBeVisible()

      // Encryption artifacts must not be present.
      expect(await page.evaluate(() => localStorage.getItem('encryption-enabled'))).not.toBe('1')
      expect(await page.evaluate(() => localStorage.getItem('encryption-salt'))).toBeNull()
      expect(await page.evaluate(() => localStorage.getItem('encryption-verify'))).toBeNull()

      // And the sensitive keys are plaintext now (NOT envelopes).
      for (const key of SENSITIVE_KEYS) {
        const value = await readEnvelope(page, key)
        if (value === null) continue
        expect(
          isEnvelope(value),
          `${key} should be plaintext after import, but still has envelope shape`,
        ).toBe(false)
      }

      // Final cross-page sanity: Net Worth page still renders the
      // imported accounts.
      await gotoAndSettle(page, URLS.netWorth, /^net worth$/i)
      await page.getByRole('tab', { name: 'Spreadsheet' }).click()
      const sheet = page.locator('.data-spreadsheet')
      await expect(sheet.first()).toContainText('$260,000')
      await expect(sheet.first()).toContainText('$55,000')
    })
  })
})
