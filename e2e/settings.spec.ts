import { test, expect } from './fixtures/base'
import { SettingsPage } from './pages/settings.page'
import {
  ALL_DATA_BALANCE,
  seedAllData,
  seedEmpty,
  seedProfile,
} from './fixtures/settings.fixtures'
import { readJsonFile } from './fixtures/filestore-helpers'

test.describe('Settings — Non-Security E2E', () => {
  /* ── Settings — Profile ───────────────────────────────────────── */

  test.describe('Profile', () => {
    test('1. Opening Settings shows Profile pane by default', async ({ page }) => {
      // (was #60 test 9) — first impression of the modal must land on
      // Profile, with the dialog wired up so getByRole('dialog', { name }) works.
      await seedProfile(page, { name: 'Casey', birthday: '1988-02-10' })
      const settings = new SettingsPage(page)
      await settings.open()

      // Dialog has accessible name "Settings" via aria-labelledby.
      await expect(settings.dialog).toBeVisible()
      await expect(settings.dialog).toHaveAttribute('aria-modal', 'true')

      // Profile is active by default (aria-selected on tabs, not class).
      await expect(settings.navProfile).toHaveAttribute('aria-selected', 'true')
      await expect(settings.navAppearance).toHaveAttribute('aria-selected', 'false')
      await expect(settings.profileHeading).toBeVisible()

      // Name + birthday surfaces are reachable in view + edit modes.
      await expect(settings.viewName).toHaveText('Casey')
      await settings.editProfileBtn.click()
      await expect(settings.profileNameInput).toBeVisible()
      await expect(settings.profileBirthdayInput).toBeVisible()
    })

    test('2. Editing profile name and saving persists the change', async ({ page }) => {
      // (was #60 test 10) — full edit→save→reload→Home greeting loop.
      await seedProfile(page, { name: 'Casey', birthday: '1988-02-10' })
      const settings = new SettingsPage(page)
      await settings.open()

      await settings.editProfileBtn.click()
      await settings.profileNameInput.fill('Alex')
      await settings.saveProfileBtn.click()

      // Success flash + view name swaps.
      await expect(settings.profileSavedFlash).toBeVisible()
      await expect(settings.viewName).toHaveText('Alex')

      // Persisted to localStorage under user-profile (encryption disabled).
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('user-profile') || '{}'))
      expect(stored.name).toBe('Alex')
      expect(stored.birthday).toBe('1988-02-10')

      // Reload + Home greeting picks up the new name.
      await settings.closeButton.click()
      await page.reload()
      await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Alex$/ })).toBeVisible()
    })

    test('3. Profile supports partner toggle — adding partner fields', async ({ page }) => {
      // (was #60 test 11) — partner is stored NESTED under `partner` inside
      // user-profile (see src/hooks/useProfile.ts), NOT as separate keys.
      await seedProfile(page, { name: 'Casey', birthday: '1988-02-10' })
      const settings = new SettingsPage(page)
      await settings.open()

      await settings.editProfileBtn.click()
      // No partner section yet → +Add Partner is the affordance.
      await expect(settings.partnerNameInput).toHaveCount(0)
      await settings.addPartnerBtn.click()

      // Partner fields render in a second .settings-profile-card.
      await expect(settings.partnerNameInput).toBeVisible()
      await expect(settings.partnerBirthdayInput).toBeVisible()
      await settings.partnerNameInput.fill('Jordan')
      await settings.partnerBirthdayInput.fill('1990-07-04')
      await settings.saveProfileBtn.click()

      await expect(settings.profileSavedFlash).toBeVisible()
      await expect(settings.viewPartnerName).toHaveText('Jordan')

      // Storage shape: partner object nested under `partner` key.
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('user-profile') || '{}'))
      expect(stored.partner).toBeTruthy()
      expect(stored.partner.name).toBe('Jordan')
      expect(stored.partner.birthday).toBe('1990-07-04')
      // The shape uses one nested object, NOT separate partner-name keys.
      const keys = await page.evaluate(() => Object.keys(localStorage))
      expect(keys).not.toContain('partner-name')
      expect(keys).not.toContain('partner-birthday')
    })

    test('4. Canceling profile edit reverts changes', async ({ page }) => {
      // (was #60 test 12) — Cancel must NOT touch localStorage.
      await seedProfile(page, { name: 'Casey', birthday: '1988-02-10' })
      const settings = new SettingsPage(page)
      await settings.open()

      const before = await page.evaluate(() => localStorage.getItem('user-profile'))

      await settings.editProfileBtn.click()
      await settings.profileNameInput.fill('Discarded')
      await settings.cancelProfileBtn.click()

      // View name is unchanged.
      await expect(settings.viewName).toHaveText('Casey')

      // Re-opening edit shows the original value, not the discarded one.
      await settings.editProfileBtn.click()
      await expect(settings.profileNameInput).toHaveValue('Casey')

      // Storage is byte-for-byte unchanged.
      const after = await page.evaluate(() => localStorage.getItem('user-profile'))
      expect(after).toBe(before)
    })
  })

  /* ── Settings — Appearance ────────────────────────────────────── */

  test.describe('Appearance', () => {
    test('5. Switching to Dark mode toggles theme', async ({ page }) => {
      // (was #60 test 13) — body.dark class + darkMode='1' + aria-pressed.
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('appearance')

      // Default seed: light. Light is pressed, dark is not.
      await expect(settings.lightThemeBtn).toHaveAttribute('aria-pressed', 'true')
      await expect(settings.darkThemeBtn).toHaveAttribute('aria-pressed', 'false')

      await settings.darkThemeBtn.click()

      await expect(settings.darkThemeBtn).toHaveAttribute('aria-pressed', 'true')
      await expect(settings.lightThemeBtn).toHaveAttribute('aria-pressed', 'false')
      await expect(page.locator('body')).toHaveClass(/\bdark\b/)
      await expect.poll(() => page.evaluate(() => localStorage.getItem('darkMode'))).toBe('1')
    })

    test('6. Switching back to Light mode reverts theme', async ({ page }) => {
      // (was #60 test 14) — start in dark via seed, click Light, verify revert.
      await page.addInitScript(() => {
        localStorage.clear()
        localStorage.setItem('_e2eMode', '1')
        localStorage.setItem('encryption-enabled', '0')
        localStorage.setItem('onboarding-dismissed', '1')
        localStorage.setItem('darkMode', '1')
      })
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('appearance')

      await expect(settings.darkThemeBtn).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('body')).toHaveClass(/\bdark\b/)

      await settings.lightThemeBtn.click()

      await expect(settings.lightThemeBtn).toHaveAttribute('aria-pressed', 'true')
      await expect(settings.darkThemeBtn).toHaveAttribute('aria-pressed', 'false')
      await expect(page.locator('body')).not.toHaveClass(/\bdark\b/)
      await expect.poll(() => page.evaluate(() => localStorage.getItem('darkMode'))).toBe('0')
    })
  })

  /* ── Settings — Advanced ──────────────────────────────────────── */

  test.describe('Advanced', () => {
    test('7. Advanced pane shows only the CSV import toggle', async ({ page }) => {
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('advanced')

      await expect(settings.allowCsvToggle).toBeVisible()
      await expect(settings.allowCsvToggle).toHaveAttribute('aria-checked', 'false')
      await expect(settings.dialog.getByRole('button', { name: /export/i })).toHaveCount(0)
      await expect(settings.dialog.getByRole('button', { name: /import/i })).toHaveCount(0)
      await expect(settings.dialog.getByRole('button', { name: /factory reset/i })).toHaveCount(0)
    })

    test('8. Advanced pane does not reveal JSON import, export, or reset even with seeded data', async ({ page }) => {
      await seedAllData(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('advanced')
      await expect(settings.dialog.locator('input[type="file"][accept=".json"]')).toHaveCount(0)
      await expect(settings.dialog.getByRole('button', { name: /export/i })).toHaveCount(0)
      await expect(settings.dialog.getByRole('button', { name: /factory reset/i })).toHaveCount(0)

      const balances = await readJsonFile(page, 'accounts.json', [])
      expect(balances).toHaveLength(1)
    })
  })

  /* ── Settings — Labs ──────────────────────────────────────────── */

  test.describe('Labs', () => {
    test('9. Labs pane shows experimental feature toggles', async ({ page }) => {
      // (was #60 test 23) — both lab toggles render with switch role.
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('labs')

      await expect(settings.labPdfToCsvToggle).toBeVisible()
      await expect(settings.labPdfToCsvToggle).toHaveAttribute('aria-checked', 'false')
      await expect(settings.demoModeToggle).toBeVisible()
      await expect(settings.demoModeToggle).toHaveAttribute('aria-checked', 'false')
    })
  })

  /* ── Settings — Modal Behavior ────────────────────────────────── */

  test.describe('Modal Behavior', () => {
    test('10. Settings modal closes on Escape key', async ({ page }) => {
      // (was #60 test 24) — Escape closes; focus returns to the trigger.
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()

      await page.keyboard.press('Escape')
      await expect(settings.dialog).toHaveCount(0)

      // useFocusTrap restores focus to the previously focused element on
      // unmount — that's the Settings trigger button.
      const focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
      expect(focusedLabel).toBe('Settings')
    })

    test('11. Settings modal closes on backdrop click', async ({ page }) => {
      // (was #60 test 25) — clicking the backdrop (NOT the modal) closes.
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()

      // Click the corner of the backdrop (well outside the modal panel).
      await settings.backdrop.click({ position: { x: 5, y: 5 } })
      await expect(settings.dialog).toHaveCount(0)
    })

    test('12. Settings nav highlights active section', async ({ page }) => {
      // (was #60 test 26) — aria-selected="true" toggles on click; only one
      // tab carries it at a time. Pane content swaps in lockstep.
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()

      // Default: Profile is selected, Appearance is not.
      await expect(settings.navProfile).toHaveAttribute('aria-selected', 'true')
      await expect(settings.navAppearance).toHaveAttribute('aria-selected', 'false')

      await settings.navAppearance.click()
      await expect(settings.navAppearance).toHaveAttribute('aria-selected', 'true')
      await expect(settings.navProfile).toHaveAttribute('aria-selected', 'false')
      await expect(settings.appearanceHeading).toBeVisible()
      await expect(settings.profileHeading).toHaveCount(0)
    })
  })

  /* ── Edge Cases ───────────────────────────────────────────────── */

  test.describe('Edge Cases', () => {
    test('13. Settings with no profile data shows empty fields gracefully', async ({ page }) => {
      // (was #60 test 28) — no user-profile in storage; modal must mount,
      // edit form must render empty inputs, no console errors.
      const consoleErrors: string[] = []
      page.on('pageerror', e => consoleErrors.push(e.message))

      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()

      // View mode renders the empty-name placeholder, not a crashed pane.
      await expect(settings.viewName).toHaveText('No name set')

      await settings.editProfileBtn.click()
      await expect(settings.profileNameInput).toHaveValue('')
      await expect(settings.profileBirthdayInput).toHaveValue('')

      expect(consoleErrors).toEqual([])
    })
  })

  /* ── Import / Export ──────────────────────────────────────────── */

  test.describe('Import / Export', () => {
    test('14. Advanced pane exposes no JSON import control', async ({ page }) => {
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('advanced')

      await expect(settings.dialog.locator('input[type="file"][accept=".json"]')).toHaveCount(0)
      await expect(settings.dialog.getByRole('button', { name: /import/i })).toHaveCount(0)
    })

    test('15. Advanced pane exposes no export or destructive reset controls', async ({ page }) => {
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('advanced')

      await expect(settings.dialog.getByRole('button', { name: /export/i })).toHaveCount(0)
      await expect(settings.dialog.getByRole('button', { name: /factory reset/i })).toHaveCount(0)
    })
  })

  /* ── Persistence ──────────────────────────────────────────────── */

  test.describe('Persistence', () => {
    test('16. Accent theme persists across reload and applies CSS custom properties', async ({ page }) => {
      // (was #60 test 33) — AppearancePane does NOT expose an accent
      // picker (it only has Light/Dark buttons). The accent-theme contract
      // is therefore: `accentTheme` in localStorage survives reload, AND
      // the `--accent` CSS custom property on document.documentElement is
      // a defined non-empty color. The colorThemes.css source currently
      // ships the light blue palette as --accent: #2563eb; this test
      // pins both halves of the contract so a future accent picker change
      // OR a colorThemes refactor will trip the assertion.
      await page.addInitScript(() => {
        localStorage.clear()
        localStorage.setItem('_e2eMode', '1')
        localStorage.setItem('encryption-enabled', '0')
        localStorage.setItem('onboarding-dismissed', '1')
        localStorage.setItem('accentTheme', 'blue')
      })
      await page.goto('/finance-tracking/')
      await page.waitForLoadState('domcontentloaded')

      // Persistence half.
      expect(await page.evaluate(() => localStorage.getItem('accentTheme'))).toBe('blue')

      // Reload survives.
      await page.reload()
      expect(await page.evaluate(() => localStorage.getItem('accentTheme'))).toBe('blue')

      // CSS custom property is applied and matches the current light-mode
      // blue palette shipped in src/styles/colorThemes.css (:root).
      const accent = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase(),
      )
      expect(accent).toBe('#2563eb')
    })

    test('17. `allowCsvImport` setting persists and controls upload visibility', async ({ page }) => {
      // (was #60 test 34) — SPEC ADAPTATION: the spec says "navigate to
      // Budget page" but `allowCsvImport` actually gates the Net Worth
      // (Data) page's CSV controls (see src/pages/data/Data.tsx). Budget
      // always exposes its Import CSV button regardless of this flag.
      // Tests assert real behavior: navigate to /net-worth and verify the
      // "Import from CSV" header button toggles in lockstep with the flag.
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('advanced')

      // Flip ON.
      await settings.allowCsvToggle.click()
      await expect(settings.allowCsvToggle).toHaveAttribute('aria-checked', 'true')
      await expect.poll(() => page.evaluate(() => localStorage.getItem('allowCsvImport'))).toBe('1')

      // Reload + visit Net Worth: Import button is visible (header + empty-state both render).
      await page.reload()
      await page.goto('/finance-tracking/#/net-worth')
      const importBtn = page.getByRole('button', { name: 'Import from CSV' })
      await expect(importBtn.first()).toBeVisible()

      // Flip OFF via settings.
      await settings.openInPlace()
      await settings.navTo('advanced')
      await expect(settings.allowCsvToggle).toHaveAttribute('aria-checked', 'true')
      await settings.allowCsvToggle.click()
      await expect(settings.allowCsvToggle).toHaveAttribute('aria-checked', 'false')
      await expect.poll(() => page.evaluate(() => localStorage.getItem('allowCsvImport'))).toBe('0')
      await settings.closeButton.click()

      // Net Worth no longer renders the Import button.
      await page.goto('/finance-tracking/#/net-worth')
      await expect(page.getByRole('button', { name: 'Import from CSV' })).toHaveCount(0)
    })

    test('18. Labs toggle dispatches `labs-changed` event and updates feature visibility', async ({ page }) => {
      // (was #60 test 35) — register the listener BEFORE the toggle action,
      // then read the flag AFTER. Verify all three: event fired AND
      // localStorage updated AND toggle visibility (aria-checked) flipped.
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('labs')

      await page.evaluate(() => {
        ;(window as unknown as { __labsFired: boolean }).__labsFired = false
        window.addEventListener('labs-changed', () => {
          ;(window as unknown as { __labsFired: boolean }).__labsFired = true
        })
      })

      // Toggle the PDF→CSV lab. Pre: off.
      await expect(settings.labPdfToCsvToggle).toHaveAttribute('aria-checked', 'false')
      await settings.labPdfToCsvToggle.click()

      // (1) Event fired.
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { __labsFired: boolean }).__labsFired))
        .toBe(true)
      // (2) localStorage updated.
      await expect.poll(() => page.evaluate(() => localStorage.getItem('lab-pdf-to-csv'))).toBe('1')
      // (3) UI state reflects the change.
      await expect(settings.labPdfToCsvToggle).toHaveAttribute('aria-checked', 'true')
    })
  })

  /* ── Layout & Export ──────────────────────────────────────────── */

  test.describe('Layout & Export', () => {
    test('19. Profile with extremely long name does not break layout', async ({ page }) => {
      // (was #60 test 38) — 200-char name must not introduce horizontal
      // overflow. The contract is scrollWidth <= clientWidth on <html>;
      // visual presence is implied but not the assertion target.
      await seedProfile(page, { name: 'Short', birthday: '1988-02-10' })
      const settings = new SettingsPage(page)
      await settings.open()

      const longName = 'A'.repeat(200)
      await settings.editProfileBtn.click()
      await settings.profileNameInput.fill(longName)
      await settings.saveProfileBtn.click()
      await expect(settings.profileSavedFlash).toBeVisible()

      // Verify the long name is actually in storage (sanity check on save).
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('user-profile') || '{}'))
      expect(stored.name).toBe(longName)

      // No horizontal scrollbar on <html> while modal is open.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
        .toBe(true)

      // Close the modal and check Home greeting also doesn't overflow.
      await settings.closeButton.click()
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
        .toBe(true)
    })

    test('20. Opening Advanced leaves seeded file-store data intact', async ({ page }) => {
      await seedAllData(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('advanced')

      await expect(settings.dialog.getByRole('button', { name: /export/i })).toHaveCount(0)
      const goals = await readJsonFile(page, 'goals.json', { financialGoals: [], gwGoals: [] })
      const accounts = await readJsonFile(page, 'accounts.json', [])
      expect((goals as { financialGoals: unknown[] }).financialGoals).toHaveLength(1)
      expect(accounts).toHaveLength(1)

      const snapshot = await page.evaluate(() => localStorage.getItem('__e2eSeedData'))
      expect(snapshot).toContain('accounts.json')
      expect(snapshot).toContain('goals.json')
      expect(snapshot).toContain(String(ALL_DATA_BALANCE.balance))
    })
  })
})
