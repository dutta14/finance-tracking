import { test, expect } from './fixtures/base'
import type { ConsoleMessage } from '@playwright/test'
import { NavigationPage, routeRegex } from './pages/navigation.page'
import { hashUrl, NAV_PATHS, PAGE_HEADINGS, PRIMARY_NAV_LINKS, seedNav } from './fixtures/nav-data'

/**
 * Sub-issue #141 (61a of 4 under #61) — Sidebar navigation, routing,
 * active state. 17 tests covering link presence, route navigation,
 * `aria-current="page"`, no-console-error smoke, rapid navigation,
 * browser refresh, invalid route fallback, and hash fragment behavior.
 *
 * The app uses HashRouter (see src/main.tsx) under the Vite base
 * `/finance-tracking/`. URLs are matched against the trailing `#/<path>`.
 * Invalid routes are caught by `<Route path="*" element={<Navigate to="/"
 * replace />} />` in App.tsx — there is no 404 component.
 */

test.describe('Sidebar navigation, routing, and active state (#141)', () => {
  test.beforeEach(async ({ page }) => {
    await seedNav(page)
  })

  /* ── Sidebar link presence ──────────────────────────────────── */

  test('1. sidebar shows all primary navigation links and Home is active by default', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/')

    await expect(nav.sidebar).toBeVisible()
    for (const name of PRIMARY_NAV_LINKS) {
      await expect(nav.link(name)).toBeVisible()
    }
    // Drive lives in the footer Utilities group, not the primary list.
    await expect(nav.link('Drive')).toBeVisible()

    // Home is the default route → only Home carries aria-current="page".
    await nav.expectActive('Home')
  })

  /* ── Per-link navigation ────────────────────────────────────── */

  test('2. clicking "Goals" navigates to /goal and marks it active', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/')
    await nav.navTo('Goals')
    await nav.expectActive('Goals')
  })

  test('3. clicking "Net Worth" navigates to /net-worth and marks it active', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/')
    await nav.navTo('Net Worth')
    await nav.expectActive('Net Worth')
  })

  test('4. clicking "Budget" navigates to /budget and marks it active', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/')
    await nav.navTo('Budget')
    await nav.expectActive('Budget')
  })

  test('5. clicking "Taxes" navigates to /taxes and the toggle has an aria-label', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/')
    await nav.navTo('Taxes')
    await nav.expectActive('Taxes')

    // Spec 5 (enhanced): the sidebar toggle's accessible name must flip
    // when the sidebar collapses. Asserting toggleExpand becomes visible
    // confirms the same physical toggle now reads "Expand sidebar".
    await nav.collapseSidebar()
    await expect(nav.toggleExpand).toBeVisible()
  })

  test('6. Drive button in footer navigates to /drive and marks it active', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/')
    await nav.navTo('Drive')
    await nav.expectActive('Drive')
  })

  /* ── Sidebar collapse / expand ─────────────────────────────── */

  test('7. collapsing the sidebar removes the nav links and shows only the expand toggle', async ({ page }) => {
    // Adaptation: AppShell unmounts <SidebarNavigation /> when sidebarOpen
    // is false (App.tsx:131), so the sidebar nav region is *removed* from
    // the DOM rather than just receiving a `collapsed` class. The user-
    // visible contract — nav links are gone, the expand toggle is the
    // only thing left — still holds, which is what we assert.
    const nav = new NavigationPage(page)
    await nav.goto('/')

    await nav.collapseSidebar()

    await expect(nav.sidebar).toBeHidden()
    for (const name of PRIMARY_NAV_LINKS) {
      await expect(nav.link(name)).toBeHidden()
    }
    await expect(nav.link('Drive')).toBeHidden()
    await expect(nav.toggleExpand).toBeVisible()
  })

  test('8. expanding the sidebar after collapse restores all nav links', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/')

    await nav.collapseSidebar()
    await nav.expandSidebar()

    await expect(nav.sidebar).toBeVisible()
    for (const name of PRIMARY_NAV_LINKS) {
      await expect(nav.link(name)).toBeVisible()
    }
    await expect(nav.link('Drive')).toBeVisible()
  })

  /* ── Page load smoke ───────────────────────────────────────── */

  test('13. every primary route loads without console or page errors', async ({ page }) => {
    // Mirrors the taxes.spec.ts pattern (pageerror) and additionally
    // collects console errors, filtering noise that is not a regression
    // signal (React DevTools nag in dev, Vite HMR transport, source-map
    // 404s for lazy chunks).
    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    page.on('pageerror', e => pageErrors.push(e.message))
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (/React DevTools|\[vite\]|source ?map/i.test(text)) return
      consoleErrors.push(text)
    })

    const nav = new NavigationPage(page)
    for (const name of [...PRIMARY_NAV_LINKS, 'Drive'] as const) {
      await nav.goto(NAV_PATHS[name])
      await expect(page.getByRole('heading', { level: 1, name: PAGE_HEADINGS[name] })).toBeVisible()
    }

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('14. direct URL access works for nested sub-routes', async ({ page }) => {
    const nav = new NavigationPage(page)

    await nav.goto('/net-worth/allocation')
    await expect(page).toHaveURL(/#\/net-worth\/allocation$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Net Worth' })).toBeVisible()
    // The Net Worth section nav should mark Allocation as active.
    await expect(page.getByRole('link', { name: 'Allocation' })).toHaveAttribute('aria-current', 'page')

    await nav.goto('/goal/calculator')
    await expect(page).toHaveURL(/#\/goal\/calculator$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Goals' })).toBeVisible()

    await nav.goto('/drive')
    await expect(page).toHaveURL(/#\/drive$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Drive' })).toBeVisible()
  })

  test('15. navigating to an unknown route redirects to Home', async ({ page }) => {
    // App.tsx defines `<Route path="*" element={<Navigate to="/" replace />} />`.
    // That is the canonical "not found" behavior — no 404 component exists.
    const nav = new NavigationPage(page)
    await nav.goto('/nonexistent-page')

    await expect(page).toHaveURL(routeRegex('/'))
    await expect(page.getByRole('heading', { level: 1, name: PAGE_HEADINGS['Home'] })).toBeVisible()
    await nav.expectActive('Home')
  })

  /* ── Active state guarantees ───────────────────────────────── */

  test('24. the active page link has aria-current="page" and the visual active class', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/')
    await nav.navTo('Budget')

    const budget = nav.link('Budget')
    await expect(budget).toHaveAttribute('aria-current', 'page')
    // Visual indicator uses the `active` className suffix on .sidebar-link.
    // This is a defense-in-depth check: aria-current is the contract,
    // class `active` is the styling hook. Both must move together.
    await expect(budget).toHaveClass(/(?:^|\s)sidebar-link active(?:$|\s)/)
  })

  test('25. exactly one nav link is active at any time after navigating between pages', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/')

    for (const name of ['Goals', 'Net Worth', 'Budget', 'Taxes', 'Home'] as const) {
      await nav.navTo(name)
      await nav.expectActive(name)
    }
  })

  /* ── Edge cases ────────────────────────────────────────────── */

  test('26. rapid navigation between pages leaves the final page in a consistent state', async ({ page }) => {
    // Click Home → Goals → Net Worth → Budget in quick succession. Only
    // the final state is asserted — intermediate URLs are a race.
    const nav = new NavigationPage(page)
    await nav.goto('/')

    await nav.link('Goals').click()
    await nav.link('Net Worth').click()
    await nav.link('Budget').click()

    await expect(page).toHaveURL(routeRegex('/budget'))
    await expect(page.getByRole('heading', { level: 1, name: 'Budget' })).toBeVisible()
    await nav.expectActive('Budget')
  })

  test('27. browser refresh on a sub-route preserves the page and active link', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/')
    await nav.navTo('Goals')

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL(routeRegex('/goal'))
    await expect(page.getByRole('heading', { level: 1, name: 'Goals' })).toBeVisible()
    await nav.expectActive('Goals')
  })

  test('38. a non-existent route falls back to Home with Home marked active', async ({ page }) => {
    const nav = new NavigationPage(page)
    await nav.goto('/this-route-does-not-exist')

    await expect(page).toHaveURL(routeRegex('/'))
    await expect(page.getByRole('heading', { level: 1, name: PAGE_HEADINGS['Home'] })).toBeVisible()
    await nav.expectActive('Home')
  })

  test('39. hash fragment with no matching anchor lands at top of Home without error', async ({ page }) => {
    // Adaptation: the app uses HashRouter, which consumes the URL hash to
    // resolve routes. A bare hash like `#goals-section` is interpreted as
    // a route path `goals-section`, falls through to the wildcard, and
    // redirects to `/`. In-page anchor scrolling via `#section-id` is
    // therefore unsupported in this app. We capture the actual contract:
    // no error, Home renders, viewport is at the top.
    const pageErrors: string[] = []
    page.on('pageerror', e => pageErrors.push(e.message))

    await page.goto(`${hashUrl('/').replace('#/', '')}#goals-section`)
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { level: 1, name: PAGE_HEADINGS['Home'] })).toBeVisible()
    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY).toBe(0)
    expect(pageErrors).toEqual([])
  })
})
