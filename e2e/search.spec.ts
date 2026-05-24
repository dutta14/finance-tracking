import { test, expect } from '@playwright/test'
import { SearchPage } from './pages/search.page'
import { seedNav } from './fixtures/nav-data'

/**
 * Sub-issue #142 (61b of 4 under #61) — SearchModal Cmd+K lifecycle and
 * focus trap. 8 tests covering open via shortcut, query filtering, result
 * selection + navigation, Escape close, dialog a11y attributes, keyboard
 * arrow navigation, focus restoration on close, and Tab focus trap.
 *
 * The global shortcut handler in `src/contexts/LayoutContext.tsx` accepts
 * either Meta+k or Control+k (`metaKey || ctrlKey`), so we use Control+k
 * for cross-platform hermeticity. The dialog mounts via createPortal at
 * <body> and the useFocusTrap hook saves `document.activeElement` on open
 * and restores it on close — that contract is exercised by tests 30/32.
 *
 * Note on the "fi" query in test 29: against the empty (un-seeded)
 * index, "fi" matches seven static items in this deterministic flat
 * order (CATEGORY_ORDER then score/alpha within a group):
 *   0. Drive (page, hint "Uploaded files" → "files" contains "fi")
 *   1. Goals (page, hint "FI goal plans")
 *   2. Open Profile (command, label contains "fi" in "profile", 60)
 *   3. New Goal (command, hint "Create a new FI goal", 40)
 *   4. Open Settings (command, keyword "config" contains "fi", 30)
 *   5. FI Calculator (tool, label starts with "fi", 80)
 *   6. Profile Settings (settings, label contains "fi")
 * Multiple results let ArrowDown/ArrowUp actually move the active row
 * (not clamp at index 0), so the increment/decrement/bounds logic is
 * observable. The initial active index is 0; ArrowDown×5 → index 5,
 * ArrowUp×1 → index 4, ArrowDown×1 → index 5 (FI Calculator →
 * route `/goal/calculator`).
 */

test.describe('SearchModal — Cmd+K lifecycle and focus trap (#142)', () => {
  test.beforeEach(async ({ page }) => {
    await seedNav(page)
  })

  /* ── Open & focus ───────────────────────────────────────────── */

  test('9. Cmd+K opens search modal with input focused', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto('/')

    await expect(search.dialog).toBeHidden()
    await search.openWithShortcut('Control+k')

    // openWithShortcut already asserts visible + input focused. Re-verify
    // via document.activeElement to make the focus contract explicit at
    // the test level rather than buried in the page object.
    const isInputFocused = await search.input.evaluate(el => document.activeElement === el)
    expect(isInputFocused).toBe(true)
  })

  /* ── Filtering ──────────────────────────────────────────────── */

  test('10. typing in search modal filters results to matching items', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto('/')
    await search.openWithShortcut('Control+k')

    await search.input.fill('budget')

    // Wait for at least one option to appear, then assert the Budget
    // page row is among them. Label match scores higher than keywords,
    // so the "Budget" page is guaranteed to be present.
    await search.results().first().waitFor()
    await expect(search.result('Budget')).toBeVisible()
  })

  /* ── Selection + navigation ─────────────────────────────────── */

  test('11. selecting a search result closes the modal and navigates to that page', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto('/')
    await search.openWithShortcut('Control+k')

    await search.input.fill('net worth')
    await search.results().first().waitFor()
    await search.result('Net Worth').click()

    await expect(search.dialog).toBeHidden()
    await expect(page).toHaveURL(/#\/net-worth$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Net Worth' })).toBeVisible()
  })

  /* ── Escape close ───────────────────────────────────────────── */

  test('12. Escape closes the search modal', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto('/')
    await search.openWithShortcut('Control+k')

    await search.closeWithEscape()
  })

  /* ── A11y contract ──────────────────────────────────────────── */

  test('28. Cmd+K opens dialog with role="dialog", accessible name, and focused input', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto('/')

    await page.keyboard.press('Control+k')

    // role="dialog" with accessible name "Search" (aria-label on source).
    const dialog = page.getByRole('dialog', { name: 'Search' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-label', 'Search')
    await expect(dialog).toHaveAttribute('aria-modal', 'true')

    // Input is focused after the rAF inside the open effect.
    await expect(search.input).toBeFocused()
  })

  /* ── ArrowDown / ArrowUp / Enter ───────────────────────────── */

  test('29. ArrowDown/ArrowUp move highlight through results, Enter selects and navigates', async ({ page }) => {
    // The initial active index is 0 (first row pre-selected). Sequence:
    // ArrowDown×5 → index 5; ArrowUp×1 → index 4; ArrowDown×1 → index 5
    // (FI Calculator → /goal/calculator).
    const search = new SearchPage(page)
    await search.goto('/')
    await search.openWithShortcut('Control+k')

    await search.input.fill('fi')
    await search.results().first().waitFor()

    const firstName = (await search.results().first().textContent())?.trim() ?? ''

    await search.arrowDown(5)
    await search.arrowUp(1)
    await search.arrowDown(1)

    const active = search.activeResult()
    await expect(active).toBeVisible()
    const activeName = (await active.textContent())?.trim() ?? ''
    expect(activeName).toContain('FI Calculator')
    expect(activeName).not.toBe(firstName)

    await page.keyboard.press('Enter')

    await expect(search.dialog).toBeHidden()
    await expect(page).toHaveURL(/#\/goal\/calculator$/)
  })

  /* ── Focus restoration ─────────────────────────────────────── */

  test('30. Escape closes the modal and restores focus to the previously focused element', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto('/')

    // The sidebar renders nav items as <button>, not <a>. Focus the
    // Goals button so useFocusTrap captures it as previousFocus on open.
    const goalsBtn = page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: 'Goals', exact: true })
    await goalsBtn.focus()
    await expect(goalsBtn).toBeFocused()

    await page.keyboard.press('Control+k')
    await expect(search.dialog).toBeVisible()
    await expect(search.input).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(search.dialog).toBeHidden()

    await expect(goalsBtn).toBeFocused()
  })

  /* ── Tab focus trap + restoration ──────────────────────────── */

  test('32. Tab cycles focus within the modal and Escape restores prior focus', async ({ page }) => {
    const search = new SearchPage(page)
    await search.goto('/')

    // Pre-focus the Home button so we can verify focus restoration on
    // close, per the second half of the spec for this test.
    const homeBtn = page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: 'Home', exact: true })
    await homeBtn.focus()
    await expect(homeBtn).toBeFocused()

    await page.keyboard.press('Control+k')
    await expect(search.dialog).toBeVisible()
    await expect(search.input).toBeFocused()

    // Tab repeatedly. The empty-query index renders 5 page rows + show-all
    // + 5 command rows + show-all = 12 buttons, so 13 Tabs from the input
    // wraps back to the input. Cycle 20 Tabs to confirm focus never
    // escapes the dialog and that wrap returns to the input.
    let wrappedToInput = false
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      const inside = await search.isFocusInsideDialog()
      expect(inside, `Tab #${i + 1} moved focus outside the dialog`).toBe(true)
      const isInput = await search.input.evaluate(el => document.activeElement === el)
      if (isInput && i > 0) wrappedToInput = true
    }
    expect(wrappedToInput, 'Tab cycle never returned focus to the search input').toBe(true)

    await page.keyboard.press('Escape')
    await expect(search.dialog).toBeHidden()

    await expect(homeBtn).toBeFocused()
  })
})
