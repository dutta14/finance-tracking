import { test, expect } from '@playwright/test'
import { ResponsivePage, MAIN_PAGE_ROUTES } from './pages/responsive.page'
import { seedNav, hashUrl } from './fixtures/nav-data'
import { seedGoalsData } from './fixtures/goals.fixtures'
import { seedFullYearBudget } from './fixtures/budget.fixtures'

/**
 * Sub-issue #143 (61c of 4 under #61) — Responsive / mobile viewport
 * behavior. 7 tests covering mobile sidebar UX, no-horizontal-overflow
 * on every main page, home-card stacking, goal mini-grid single-column
 * collapse, budget scrollable region, hamburger keyboard a11y, and
 * dark-mode toggle reachability at 375×667.
 *
 * Every test sets the viewport to iPhone-SE (375×667) BEFORE
 * `page.goto`. `LayoutContext.tsx` evaluates `window.innerWidth <= 900`
 * lazily inside `useState`, so the initial `isMobile` value is fixed at
 * first paint. A late viewport resize would fire the resize handler
 * but, by design, the handler does not auto-close the sidebar on
 * desktop→mobile (it only re-opens on mobile→desktop). Exercising the
 * genuine first-paint mobile layout requires the viewport to be set up
 * front.
 *
 * Spec adaptations (from issue #143's text → source reality):
 *   • Test 16 — Spec wording "sidebar auto-collapses" is misleading.
 *     Source defaults `sidebarOpen=true` regardless of viewport; on
 *     mobile the sidebar opens *with an overlay scrim* (App.tsx:140).
 *     We verify the mobile-specific contract: overlay is present and
 *     clickable, and clicking it collapses the sidebar (hamburger
 *     appears, overlay disappears, sidebar nav is removed).
 *   • Test 19 — Spec says "switches to list view". Source does not
 *     auto-toggle `goal-view-mode`; instead, `.goals-mini-grid` uses
 *     `repeat(auto-fit, minmax(200px, 1fr))` which collapses to a
 *     single column at 375px (the wrapper's content box is < 400px).
 *     We assert single-column stacking via bounding-box left-alignment.
 *   • Test 20 — Spec says "table is scrollable". `.budget-table` has
 *     `table-layout: fixed` and `.budget-table-wrapper` has
 *     `overflow-x: hidden` — the table is *not* horizontally
 *     scrollable. The horizontally scrollable region on the Budget
 *     page is `.cashflow-sankey-scroll` (`overflow-x: auto`), wrapping
 *     an SVG with `min-width: 550px` (Budget.css:1533) — i.e., wider
 *     than the 375px viewport, so its `scrollWidth > clientWidth`.
 *     We assert the cashflow scroll wrapper is the genuine
 *     horizontally-scrollable region on the Budget page at mobile width.
 *   • Test 36 — Spec asks for Enter-to-open + Escape-to-close +
 *     focus-restoration on the hamburger. Source has no Escape handler
 *     and no focus-restoration contract. We assert what *is* in
 *     source: hamburger has accessible name "Expand sidebar", is
 *     keyboard-focusable, Enter activates it (sidebar opens), and
 *     clicking the overlay (the mobile-realistic close path) collapses
 *     the sidebar and brings the hamburger back into view.
 */

test.describe('Responsive / mobile viewport (#143)', () => {
  /* ── 16. Sidebar overlay collapses sidebar on mobile ──────── */

  test('16. mobile viewport renders sidebar with overlay scrim that collapses on click', async ({ page }) => {
    // Adaptation: see suite-level note for test 16. Source defaults
    // sidebarOpen=true on mobile; the mobile-specific UX is the
    // overlay scrim that, when clicked, collapses the sidebar.
    await seedNav(page)
    const resp = new ResponsivePage(page)
    await resp.gotoMobile('/')

    // On first mobile paint: sidebar nav is visible AND the click-to-close
    // overlay is rendered (only when `isMobile && sidebarOpen` — App.tsx:140).
    await expect(resp.sidebar).toBeVisible()
    await expect(resp.overlay).toBeVisible()
    await expect(resp.hamburger).toBeHidden()

    // Click the overlay → sidebar collapses, overlay unmounts,
    // hamburger appears in the main-content rail.
    await resp.dismissOverlay()
    await expect(resp.sidebar).toBeHidden()
    await expect(resp.overlay).toBeHidden()
    await expect(resp.hamburger).toBeVisible()
  })

  /* ── 17. No horizontal overflow on every main page ────────── */

  test('17. content is readable with no horizontal overflow on every main page', async ({ page }) => {
    await seedNav(page)
    const resp = new ResponsivePage(page)

    // Loop note: HashRouter navs only change the URL fragment, so the
    // React app does NOT remount between iterations and `sidebarOpen`
    // state persists. We only set the viewport once (before the first
    // goto) and rely on the h1 wait to confirm each route mounted.
    // The mobile overlay (`position: fixed; inset: 0;`) doesn't affect
    // `document.documentElement.scrollWidth`, so we don't need to
    // dismiss it to measure horizontal overflow.
    await page.setViewportSize({ width: 375, height: 667 })

    for (const { path, heading } of MAIN_PAGE_ROUTES) {
      await page.goto(hashUrl(path))
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      expect(await resp.hasHorizontalOverflow()).toBe(false)
    }
  })

  /* ── 18. Home dashboard cards stack vertically ────────────── */

  test('18. home dashboard cards stack into a single column on mobile', async ({ page }) => {
    await seedNav(page)
    const resp = new ResponsivePage(page)
    await resp.gotoMobile('/')

    // Close the overlay so the home grid is interactive / measurable
    // without the scrim covering it. (Bounding boxes are accurate
    // either way, but closing keeps the visual state predictable.)
    await resp.dismissOverlay()

    const slots = page.locator('.home-grid-slot')
    await slots.first().waitFor()
    expect(await slots.count()).toBeGreaterThan(1)

    const boxes = await resp.boundingBoxes(slots)
    expect(boxes.length).toBeGreaterThan(1)

    // Single-column stacking: every slot shares the same `x` (within a
    // 1px tolerance for subpixel rounding) AND every slot below the
    // first sits strictly below it.
    const firstX = boxes[0].x
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i].x - firstX)).toBeLessThan(1)
      expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].height - 1)
    }
  })

  /* ── 19. Goals collapse to single-column on narrow screens ── */

  test('19. goal mini grid collapses to a single column on mobile', async ({ page }) => {
    // Adaptation: see suite-level note for test 19. The page does not
    // toggle `goal-view-mode`; CSS `repeat(auto-fit, minmax(200px,
    // 1fr))` collapses to one column when the wrapper's content box
    // is narrower than 400px (true at 375px viewport).
    await seedGoalsData(page, { viewMode: 'grid' })
    const resp = new ResponsivePage(page)
    await resp.gotoMobile('/goal')

    await resp.dismissOverlay()
    await expect(resp.sidebar).toBeHidden()

    // The mini grid wrapper takes the `goals-mini-grid` class when
    // viewMode is 'grid' (GoalsMiniGrid.tsx:263). Each goal card is a
    // direct child element of that wrapper.
    const miniGrid = page.locator('.goals-mini-grid')
    await expect(miniGrid).toBeVisible()

    const cards = miniGrid.locator('> *')
    const count = await cards.count()
    expect(count).toBeGreaterThan(1)

    const boxes = await resp.boundingBoxes(cards)
    const firstX = boxes[0].x
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i].x - firstX)).toBeLessThan(1)
    }

    // Also assert via computed style: the grid template resolves to a
    // single track at this viewport. `grid-template-columns` returns
    // the resolved pixel value(s) — a single number means one column.
    const tracks = await miniGrid.evaluate(el => {
      return window.getComputedStyle(el).gridTemplateColumns.split(' ').length
    })
    expect(tracks).toBe(1)
  })

  /* ── 20. Budget page has a horizontally scrollable region ── */

  test('20. budget page exposes a horizontally scrollable cashflow region on mobile', async ({ page }) => {
    // Adaptation: see suite-level note for test 20. The Budget table
    // itself is fixed-layout with overflow-x: hidden; the genuine
    // horizontally scrollable region on the Budget page is
    // `.cashflow-sankey-scroll` (overflow-x: auto with a 550px-min
    // SVG child, wider than the 375px viewport).
    await seedFullYearBudget(page)
    const resp = new ResponsivePage(page)
    await resp.gotoMobile('/budget')

    await resp.dismissOverlay()
    await expect(resp.sidebar).toBeHidden()

    // Default `viewMode` from useBudget is 'aggregated', which doesn't
    // render the Sankey. Switch to Cashflow view via the in-page
    // button (BudgetHeader.tsx:90) to mount CashflowSankey.
    await page.getByRole('button', { name: 'Cashflow', exact: true }).click()

    const scroll = page.locator('.cashflow-sankey-scroll')
    await expect(scroll).toBeVisible()
    await expect(scroll).toHaveCSS('overflow-x', 'auto')

    // The inner SVG's intrinsic width exceeds the wrapper's client
    // width, making the region actually horizontally scrollable.
    const { scrollWidth, clientWidth } = await scroll.evaluate(el => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(scrollWidth).toBeGreaterThan(clientWidth)

    // And the page as a whole still has no horizontal overflow — the
    // wide chart is contained inside the scroll wrapper, not the body.
    expect(await resp.hasHorizontalOverflow()).toBe(false)
  })

  /* ── 36. Hamburger is keyboard-focusable, Enter opens ────── */

  test('36. mobile hamburger is keyboard-focusable, Enter opens the sidebar, overlay click closes it', async ({ page }) => {
    // Adaptation: see suite-level note for test 36. Source has no
    // Escape handler on the hamburger and no documented
    // focus-restoration contract, so we assert the close path that
    // *is* in source: overlay click → sidebar collapses → hamburger
    // returns. We DO assert keyboard focus + Enter activation, which
    // are real source contracts.
    await seedNav(page)
    const resp = new ResponsivePage(page)
    await resp.gotoMobile('/')

    // Start from the collapsed state so the "Expand sidebar"
    // hamburger is the target. Clicking the overlay collapses the
    // sidebar (App.tsx:140 onClick handler).
    await resp.dismissOverlay()
    await expect(resp.sidebar).toBeHidden()
    await expect(resp.hamburger).toBeVisible()
    await expect(resp.hamburger).toHaveAttribute('aria-label', 'Expand sidebar')

    // Focus the hamburger via the keyboard. `Locator.focus()` mimics
    // tab landing on the element; we verify focus actually moved to it.
    await resp.hamburger.focus()
    await expect(resp.hamburger).toBeFocused()

    // Enter opens the sidebar (button's onClick toggles sidebarOpen).
    await page.keyboard.press('Enter')
    await expect(resp.sidebar).toBeVisible()
    await expect(resp.overlay).toBeVisible()
    await expect(resp.hamburger).toBeHidden()

    // Close again via the mobile-realistic path: click the overlay.
    // The hamburger returns to the DOM and is visible.
    await resp.dismissOverlay()
    await expect(resp.sidebar).toBeHidden()
    await expect(resp.hamburger).toBeVisible()
  })

  /* ── 37. Dark mode toggle works at mobile width ──────────── */

  test('37. dark mode toggle in Settings > Appearance works at mobile width', async ({ page }) => {
    await seedNav(page)
    const resp = new ResponsivePage(page)
    await resp.gotoMobile('/')

    // Sidebar is open by default on mobile, so the Settings button
    // (in the sidebar footer Utilities group) is reachable without
    // first dismissing the overlay.
    await resp.settingsButton.click()
    await expect(resp.settingsDialog).toBeVisible()

    // Appearance is the second nav item; click it and wait for the
    // pane heading to confirm it mounted.
    await resp.settingsDialog.getByRole('button', { name: 'Appearance', exact: true }).click()
    await expect(resp.settingsDialog.getByRole('heading', { level: 3, name: 'Appearance' })).toBeVisible()

    // The Dark option is visible and clickable inside the modal on a
    // 375-wide viewport (not clipped off-screen). aria-pressed reflects
    // the active theme — false initially (default light), true after click.
    await expect(resp.darkThemeOption).toBeVisible()
    await expect(resp.darkThemeOption).toHaveAttribute('aria-pressed', 'false')

    await resp.darkThemeOption.click()
    await expect(resp.darkThemeOption).toHaveAttribute('aria-pressed', 'true')

    // Source contract from SettingsContext.tsx:64-66: body.dark class
    // is toggled and `darkMode` localStorage key is set to '1'.
    const bodyHasDark = await page.evaluate(() => document.body.classList.contains('dark'))
    expect(bodyHasDark).toBe(true)
    const stored = await page.evaluate(() => localStorage.getItem('darkMode'))
    expect(stored).toBe('1')
  })
})
