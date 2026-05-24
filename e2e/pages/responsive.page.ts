import { Page, Locator, expect } from '@playwright/test'
import { hashUrl } from '../fixtures/nav-data'

/**
 * Page object for the mobile / responsive E2E suite (#143, 61c of 4 under #61).
 *
 * Every test in this suite runs at the iPhone-SE viewport (375×667) and
 * must set the viewport BEFORE navigation — `LayoutContext.tsx`
 * evaluates `window.innerWidth <= 900` lazily via `useState(() => …)`,
 * so the initial `isMobile` value is fixed at first render. Resizing
 * after mount only triggers the resize handler, which does not close
 * the sidebar on the desktop→mobile transition (it only re-opens it on
 * mobile→desktop). Setting the viewport up front is the only way to
 * exercise the genuine first-paint mobile layout.
 */
export const MOBILE_VIEWPORT = { width: 375, height: 667 } as const

export class ResponsivePage {
  readonly page: Page

  readonly sidebar: Locator
  readonly overlay: Locator
  readonly hamburger: Locator
  readonly settingsButton: Locator
  readonly settingsDialog: Locator
  readonly darkThemeOption: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = page.getByRole('navigation', { name: 'Main navigation' })
    // `.sidebar-overlay` is the click-to-close scrim rendered only when
    // `isMobile && sidebarOpen` (App.tsx). It has no accessible role,
    // so a CSS-class locator is the only stable handle.
    this.overlay = page.locator('.sidebar-overlay')
    this.hamburger = page.getByRole('button', { name: 'Expand sidebar' })
    this.settingsButton = page.getByRole('button', { name: 'Settings' })
    this.settingsDialog = page.getByRole('dialog', { name: 'Settings' })
    this.darkThemeOption = this.settingsDialog
      .locator('.settings-theme-option')
      .filter({ hasText: 'Dark' })
  }

  /**
   * Set the mobile viewport and navigate via the hash router. The
   * sidebar nav is rendered on mobile too (sidebarOpen defaults to
   * true), so waiting on it is a reliable "app mounted" signal.
   */
  async gotoMobile(path: string = '/'): Promise<void> {
    await this.page.setViewportSize({ ...MOBILE_VIEWPORT })
    await this.page.goto(hashUrl(path))
    await this.page.waitForLoadState('domcontentloaded')
    await this.sidebar.waitFor()
  }

  /**
   * True iff the document scrollWidth exceeds the inner viewport width
   * — the canonical "horizontal page overflow" test.
   */
  async hasHorizontalOverflow(): Promise<boolean> {
    return await this.page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  }

  /**
   * Click the mobile overlay scrim. The sidebar (z=200, width 260px at
   * mobile) sits over the left portion of the overlay (z=199, inset 0),
   * so Playwright's default center-click would land on the sidebar. We
   * click at a fixed offset outside the sidebar's right edge — the
   * mobile-realistic tap-to-dismiss UX.
   */
  async dismissOverlay(): Promise<void> {
    await this.overlay.click({ position: { x: 320, y: 200 } })
    await expect(this.sidebar).toBeHidden()
    await expect(this.overlay).toBeHidden()
  }

  /** Bounding boxes for every element matching `locator`, in DOM order. */
  async boundingBoxes(locator: Locator): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
    const count = await locator.count()
    const boxes: Array<{ x: number; y: number; width: number; height: number }> = []
    for (let i = 0; i < count; i++) {
      const box = await locator.nth(i).boundingBox()
      if (box) boxes.push(box)
    }
    return boxes
  }
}

/**
 * Routes covered by the no-horizontal-overflow sweep (test 17). The
 * mobile overlay scrim is `position: fixed` (and so is the sidebar),
 * so neither contributes to `document.documentElement.scrollWidth` —
 * the sweep doesn't need to dismiss the overlay before measuring.
 */
export const MAIN_PAGE_ROUTES: ReadonlyArray<{ path: string; heading: RegExp }> = [
  { path: '/', heading: /^Good (morning|afternoon|evening)/ },
  { path: '/goal', heading: /^Goals$/ },
  { path: '/net-worth', heading: /^Net Worth$/ },
  { path: '/budget', heading: /^Budget$/ },
  { path: '/taxes', heading: /^Taxes$/ },
]
