import { Page, Locator, expect } from '@playwright/test'
import { APP_BASE, hashUrl, NAV_PATHS, PAGE_HEADINGS, PrimaryNavLink } from '../fixtures/nav-data'

export type NavName = PrimaryNavLink | 'Drive'

/**
 * Page object for the sidebar / primary-navigation flows (#141, 61a).
 *
 * All locators are accessible-name based. `aria-current="page"` is the
 * canonical active-state assertion — never the `active` CSS class.
 */
export class NavigationPage {
  readonly page: Page

  readonly sidebar: Locator
  readonly utilities: Locator
  readonly toggleExpand: Locator
  readonly toggleCollapse: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = page.getByRole('navigation', { name: 'Main navigation' })
    this.utilities = page.getByRole('group', { name: 'Utilities' })
    // Two toggle buttons exist in the DOM (one inside the sidebar, one in
    // the main-content rail when collapsed); their accessible names differ
    // by state so each locator resolves to exactly one element at a time.
    this.toggleCollapse = page.getByRole('button', { name: 'Collapse sidebar' })
    this.toggleExpand = page.getByRole('button', { name: 'Expand sidebar' })
  }

  /** Navigate to the app root via the hash router. */
  async goto(path: string = '/'): Promise<void> {
    await this.page.goto(hashUrl(path))
    await this.page.waitForLoadState('domcontentloaded')
  }

  /** Locator for a primary nav button. Drive lives in the footer group. */
  link(name: NavName): Locator {
    if (name === 'Drive') return this.utilities.getByRole('button', { name: 'Drive' })
    return this.sidebar.getByRole('button', { name, exact: true })
  }

  /** Click a nav link and wait until URL + heading reflect the new page. */
  async navTo(name: NavName): Promise<void> {
    await this.link(name).click()
    await this.expectOnPage(name)
  }

  /** Wait for the page to be on the route corresponding to `name`. */
  async expectOnPage(name: NavName): Promise<void> {
    await expect(this.page).toHaveURL(routeRegex(NAV_PATHS[name]))
    await expect(this.page.getByRole('heading', { level: 1, name: PAGE_HEADINGS[name] })).toBeVisible()
  }

  /**
   * Assert exactly one nav link has `aria-current="page"`, and it is the
   * one named `name`.
   */
  async expectActive(name: NavName): Promise<void> {
    await expect(this.link(name)).toHaveAttribute('aria-current', 'page')
    for (const other of (['Home', 'Goals', 'Net Worth', 'Budget', 'Taxes', 'Drive'] as NavName[]).filter(
      n => n !== name,
    )) {
      await expect(this.link(other)).not.toHaveAttribute('aria-current', /.*/)
    }
  }

  /** Click the sidebar collapse button and wait for the sidebar to disappear. */
  async collapseSidebar(): Promise<void> {
    await this.toggleCollapse.click()
    await expect(this.sidebar).toBeHidden()
    await expect(this.toggleExpand).toBeVisible()
  }

  /** Click the expand button (visible only when sidebar is collapsed). */
  async expandSidebar(): Promise<void> {
    await this.toggleExpand.click()
    await expect(this.sidebar).toBeVisible()
    await expect(this.toggleCollapse).toBeVisible()
  }
}

/**
 * Build a regex that matches the trailing hash path. Uses end-of-string
 * anchor so `/net-worth` does not match `/net-worth/allocation`.
 */
export function routeRegex(hashPath: string): RegExp {
  const escaped = hashPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Home (`/`) is treated specially: HashRouter may render either
  // `#/` or no hash at all after `Navigate to="/"`. Accept both.
  if (hashPath === '/') return new RegExp(`${escapeForRegex(APP_BASE)}(?:#/?)?$`)
  return new RegExp(`#${escaped}$`)
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
