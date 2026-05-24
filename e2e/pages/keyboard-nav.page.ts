import { Page, Locator } from '@playwright/test'
import { hashUrl } from '../fixtures/nav-data'

/**
 * Page object for the keyboard / focus management E2E suite
 * (#144, 61d of 4 under #61).
 *
 * Every test runs at the desktop default viewport (1280×720) — the
 * mobile hamburger keyboard flow lives in #143 (test 36). The sidebar
 * primary nav links are rendered as `<button>` elements (not `<a>`,
 * see SidebarNavigation.tsx). Active state is signalled by
 * `aria-current="page"` on the matching button — never the `active`
 * CSS class on its own.
 */
export const DESKTOP_VIEWPORT = { width: 1280, height: 720 } as const

export interface ActiveElementInfo {
  tag: string
  text: string
  ariaCurrent: string | null
  ariaLabel: string | null
  inSidebar: boolean
  inMain: boolean
}

export class KeyboardNavPage {
  readonly page: Page

  readonly sidebar: Locator
  readonly main: Locator
  readonly homeLink: Locator
  readonly goalsLink: Locator
  readonly netWorthLink: Locator
  readonly budgetLink: Locator
  readonly taxesLink: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = page.getByRole('navigation', { name: 'Main navigation' })
    this.main = page.locator('main.main-content')
    // Sidebar primary nav links are `<button>` elements (not `<a>`).
    // Accessible-name selectors with `exact: true` keep "Net Worth"
    // from matching the "Net Worth" footer / dashboard text.
    this.homeLink = this.sidebar.getByRole('button', { name: 'Home', exact: true })
    this.goalsLink = this.sidebar.getByRole('button', { name: 'Goals', exact: true })
    this.netWorthLink = this.sidebar.getByRole('button', { name: 'Net Worth', exact: true })
    this.budgetLink = this.sidebar.getByRole('button', { name: 'Budget', exact: true })
    this.taxesLink = this.sidebar.getByRole('button', { name: 'Taxes', exact: true })
  }

  /**
   * Set the desktop viewport, seed nav state has already run via the
   * caller, then navigate to `path` via the hash router. We wait on
   * the sidebar (rendered on every authenticated route) as the "app
   * mounted" signal.
   */
  async goto(path: string = '/'): Promise<void> {
    await this.page.setViewportSize({ ...DESKTOP_VIEWPORT })
    await this.page.goto(hashUrl(path))
    await this.page.waitForLoadState('domcontentloaded')
    await this.sidebar.waitFor()
  }

  /** Press Tab `n` times in sequence. */
  async tabN(n: number): Promise<void> {
    for (let i = 0; i < n; i++) await this.page.keyboard.press('Tab')
  }

  /**
   * Return identifying info about `document.activeElement`. The boolean
   * `inSidebar` / `inMain` flags help assertions express "focus moved
   * to the main content area" without pinning to a specific element.
   */
  async getActiveElementInfo(): Promise<ActiveElementInfo> {
    return this.page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return { tag: '', text: '', ariaCurrent: null, ariaLabel: null, inSidebar: false, inMain: false }
      const tag = el.tagName
      const text = (el.textContent || '').trim().slice(0, 80)
      const ariaCurrent = el.getAttribute('aria-current')
      const ariaLabel = el.getAttribute('aria-label')
      const sidebar = document.querySelector('nav[aria-label="Main navigation"]')
      const main = document.querySelector('main.main-content')
      return {
        tag,
        text,
        ariaCurrent,
        ariaLabel,
        inSidebar: !!sidebar && sidebar.contains(el),
        inMain: !!main && main.contains(el),
      }
    })
  }

  /**
   * Return computed `outline` / `boxShadow` / `outlineStyle` for the
   * currently focused element. Used by the focus-visible assertion: at
   * least one of outlineStyle (non-'none') or boxShadow (non-'none')
   * must indicate a focus ring.
   */
  async getActiveElementFocusStyle(): Promise<{
    tag: string
    outline: string
    outlineStyle: string
    boxShadow: string
  } | null> {
    return this.page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const cs = window.getComputedStyle(el)
      return {
        tag: el.tagName,
        outline: cs.outline,
        outlineStyle: cs.outlineStyle,
        boxShadow: cs.boxShadow,
      }
    })
  }
}

/**
 * Sidebar primary nav order, used by the Tab-sequence assertion in
 * tests 21 and 35. Matches DOM order in SidebarNavigation.tsx.
 */
export const SIDEBAR_NAV_ORDER = ['Home', 'Goals', 'Net Worth', 'Budget', 'Taxes'] as const
export type SidebarNavName = (typeof SIDEBAR_NAV_ORDER)[number]
