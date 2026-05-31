import { test, expect } from './fixtures/base'
import { SettingsPage } from './pages/settings.page'
import {
  ALL_DATA_BALANCE,
  ALL_DATA_GOAL,
  buildV1Import,
  buildV2ImportWithUnknown,
  SENSITIVE_KEYS,
  seedAllData,
  seedEmpty,
  seedProfile,
  V2_EXPORT_KEYS,
} from './fixtures/settings.fixtures'
import { waitForReload } from './fixtures/reload'

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
    test('7. Advanced pane shows CSV import toggle, export, and factory reset options', async ({ page }) => {
      // (was #60 test 21) — surface inventory only; no clicks.
      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('advanced')

      await expect(settings.allowCsvToggle).toBeVisible()
      await expect(settings.allowCsvToggle).toHaveAttribute('aria-checked', 'false')
      await expect(settings.exportBtn).toBeVisible()
      await expect(settings.importBtn).toBeVisible()
      await expect(settings.factoryResetBtn).toBeVisible()
      // Confirmation button is NOT mounted until the reset CTA is clicked.
      await expect(settings.factoryResetConfirmBtn).toHaveCount(0)
    })

    test('8. Factory Reset clears all data after confirmation', async ({ page }) => {
      // (was #60 test 22) — enumerate every key we seeded, assert each is
      // gone. The app's first-load effects WILL re-write a small set of
      // settings defaults (darkMode='0', accentTheme='blue',
      // allowCsvImport='0') plus a fresh schema version and a new
      // flag-client-id; those survivors are documented below and do NOT
      // carry pre-reset values.
      await seedAllData(page)
      const settings = new SettingsPage(page)
      await settings.open()

      // Confirm at least one seeded sensitive key actually landed.
      const seededBalances = await page.evaluate(() => localStorage.getItem('data-balances'))
      expect(seededBalances).toContain(String(ALL_DATA_BALANCE.balance))

      await settings.navTo('advanced')
      await settings.factoryResetBtn.click()
      await expect(settings.factoryResetConfirmBtn).toBeVisible()

      // The reset handler calls localStorage.clear() then window.location.reload().
      // Trigger the click and wait for the reload event before asserting state.
      const reloadPromise = page.waitForEvent('load')
      await settings.factoryResetConfirmBtn.click()
      await reloadPromise

      // Every seeded sensitive key is either cleared (null) or, if the
      // app's context provider re-initialised it on cold load, holds an
      // empty container ([] / {} / null-serialized) — never the original
      // seeded payload. Per-key failure messages name the offender.
      // EMPTY_REINIT_VALUES — values that count as "cleared" because providers
      // re-emit these as their default empty state on cold load (factory reset
      // → reload). The empty string '' is intentionally NOT admitted: no
      // current provider serialises cleared state as "" (verified by grep
      // across src/), and excluding it makes the test fail loudly if a future
      // regression introduces that shape.
      const EMPTY_REINIT_VALUES = new Set(['[]', '{}', 'null'])
      for (const key of SENSITIVE_KEYS) {
        const value = await page.evaluate(k => localStorage.getItem(k), key)
        if (value === null) continue
        expect(
          EMPTY_REINIT_VALUES.has(value),
          `sensitive key "${key}" must be cleared (got non-empty value ${value!.slice(0, 80)})`,
        ).toBe(true)
      }

      // Non-sensitive seeded keys are gone too.
      for (const key of ['goal-view-mode', 'home-card-order'] as const) {
        const value = await page.evaluate(k => localStorage.getItem(k), key)
        expect(value, `non-sensitive seeded key "${key}" must be cleared`).toBeNull()
      }

      // Documented survivors — keys the app re-writes on cold load with
      // their default values (NOT the pre-reset seeded values).
      const darkMode = await page.evaluate(() => localStorage.getItem('darkMode'))
      expect(darkMode, 'darkMode survives reset as default "0", not seeded "1"').toBe('0')
      const accentTheme = await page.evaluate(() => localStorage.getItem('accentTheme'))
      expect(accentTheme, 'accentTheme survives reset as default "blue"').toBe('blue')
      const allowCsv = await page.evaluate(() => localStorage.getItem('allowCsvImport'))
      expect(allowCsv, 'allowCsvImport survives reset as default "0", not seeded "1"').toBe('0')
      const schemaVer = await page.evaluate(() => localStorage.getItem('storage-schema-version'))
      expect(schemaVer, 'storage-schema-version is re-written on cold start').not.toBeNull()
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
    test('14. Import v1 format JSON (legacy goal array) succeeds without crash', async ({ page }) => {
      // (was #60 test 31) — bare-array (v1) shape goes through the
      // Array.isArray(parsed) branch of importValidator. After import the
      // handler reloads the app; assert the seeded goal lands in
      // localStorage and the other pages render their empty states without
      // error.
      const consoleErrors: string[] = []
      page.on('pageerror', e => consoleErrors.push(e.message))

      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('advanced')

      const v1 = buildV1Import()
      // ImportExportContext.handleImport calls window.location.reload()
      // after dispatching `data-changed`. waitForLoadState('load') is
      // unusable here (resolves immediately when the page is already
      // loaded; does not wait for any FUTURE navigation), letting the
      // next page.evaluate race the reload. Use the sentinel helper
      // extracted in #172 to gate on the actual reload landing.
      await waitForReload(page, async () => {
        await settings.importFileInput.setInputFiles({
          name: v1.name,
          mimeType: 'application/json',
          buffer: Buffer.from(v1.content),
        })
      })

      // Goal is in localStorage under financialGoals (survives reload).
      const stored = await page.evaluate(() => localStorage.getItem('financialGoals'))
      expect(stored).toContain('FI Goal')

      // Goals page renders the imported goal — guards against a regression
      // where the validator accepts the payload but the Goals page filters
      // it out (LS substring check alone would miss that).
      await page.goto('/finance-tracking/#/goal')
      await expect(page.getByRole('heading', { name: 'FI Goal' })).toBeVisible()

      // Net Worth, Budget, Taxes each render their empty states with no
      // console errors. We visit each route directly.
      await page.goto('/finance-tracking/#/net-worth')
      await expect(page.getByRole('heading', { name: 'Net Worth' })).toBeVisible()
      await page.goto('/finance-tracking/#/budget')
      await expect(page.getByRole('heading', { name: /^Budget/ })).toBeVisible()
      await page.goto('/finance-tracking/#/taxes')
      await expect(page.getByRole('heading', { name: 'Taxes' })).toBeVisible()

      expect(consoleErrors).toEqual([])
    })

    test('15. Import JSON with unknown keys ignores extras and imports known keys', async ({ page }) => {
      // (was #60 test 32) — unknownField + futureFeature must NOT appear
      // anywhere in localStorage (verify by enumerating keys), and the
      // known goal must land in financialGoals.
      const consoleErrors: string[] = []
      page.on('pageerror', e => consoleErrors.push(e.message))

      await seedEmpty(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('advanced')

      const v2 = buildV2ImportWithUnknown()
      // Sentinel-gated reload (see #172): waitForLoadState('load') is a
      // no-op when the page is already loaded and does not wait for the
      // FUTURE reload that handleImport triggers.
      await waitForReload(page, async () => {
        await settings.importFileInput.setInputFiles({
          name: v2.name,
          mimeType: 'application/json',
          buffer: Buffer.from(v2.content),
        })
      })

      // Known goal made it through.
      const stored = await page.evaluate(() => localStorage.getItem('financialGoals'))
      expect(stored).toContain('V2 Imported Goal')

      // Anti-leak: neither unknown key name appears as a localStorage key.
      const keys = await page.evaluate(() => Object.keys(localStorage))
      expect(keys).not.toContain('unknownField')
      expect(keys).not.toContain('futureFeature')

      // Anti-leak: neither unknown value substring leaked into any stored value.
      const allValues = await page.evaluate(() =>
        Object.keys(localStorage)
          .map(k => localStorage.getItem(k))
          .join('|'),
      )
      expect(allValues).not.toContain('"unknownField"')
      expect(allValues).not.toContain('"futureFeature"')

      // Goals page renders the imported known goal — guards against a
      // regression where unknown-key stripping inadvertently drops the
      // known payload too, or where the validator accepts it but the
      // Goals page filters it out at render time.
      await page.goto('/finance-tracking/#/goal')
      await expect(page.getByText('V2 Imported Goal')).toBeVisible()

      expect(consoleErrors).toEqual([])
    })
  })

  /* ── Persistence ──────────────────────────────────────────────── */

  test.describe('Persistence', () => {
    test('16. Accent theme persists across reload and applies CSS custom properties', async ({ page }) => {
      // (was #60 test 33) — AppearancePane does NOT expose an accent
      // picker (it only has Light/Dark buttons). The accent-theme contract
      // is therefore: `accentTheme` in localStorage survives reload, AND
      // the `--accent` CSS custom property on document.documentElement is
      // a defined non-empty color. The colorThemes.css source only ships
      // the "blue" palette (--accent: #3b82f6) at the moment; this test
      // pins both halves of the contract so a future accent picker change
      // OR a colorThemes refactor will trip the assertion.
      await page.addInitScript(() => {
        localStorage.clear()
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

      // CSS custom property is applied and matches the blue palette
      // shipped in src/styles/colorThemes.css (:root).
      const accent = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase(),
      )
      expect(accent).toBe('#3b82f6')
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

    test('20. Export includes all v2 format keys when all data types are seeded', async ({ page }) => {
      // (was #60 test 39) — capture the download via Playwright's
      // download API (NOT blob-URL interception), parse it, and verify
      // every one of the 15 v2 top-level keys is present with a non-null
      // value, plus version === 2.
      await seedAllData(page)
      const settings = new SettingsPage(page)
      await settings.open()
      await settings.navTo('advanced')

      const [download] = await Promise.all([page.waitForEvent('download'), settings.exportBtn.click()])

      // Read the streamed file body into a string and JSON.parse it.
      const stream = await download.createReadStream()
      const chunks: Buffer[] = []
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const text = Buffer.concat(chunks).toString('utf-8')
      const exported = JSON.parse(text) as Record<string, unknown>

      // version is exactly 2.
      expect(exported.version).toBe(2)

      // Per-key presence + non-null assertion (each gets its own failure message).
      for (const key of V2_EXPORT_KEYS) {
        expect(exported, `v2 export must contain top-level key "${key}"`).toHaveProperty(key)
        expect(exported[key], `v2 export key "${key}" must not be null`).not.toBeNull()
        expect(exported[key], `v2 export key "${key}" must not be undefined`).not.toBeUndefined()
      }

      // Spot-check seeded values flowed through (catches accidental
      // value-stripping in the export pipeline).
      const goals = exported.goals as Array<{ id: number; goalName: string }>
      expect(goals[0]?.id).toBe(ALL_DATA_GOAL.id)
      expect(goals[0]?.goalName).toBe(ALL_DATA_GOAL.goalName)
      const balances = exported.dataBalances as Array<{ balance: number }>
      expect(balances[0]?.balance).toBe(ALL_DATA_BALANCE.balance)
    })
  })
})
