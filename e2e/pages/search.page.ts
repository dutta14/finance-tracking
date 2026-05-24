import { Page, Locator, expect } from '@playwright/test'
import { hashUrl } from '../fixtures/nav-data'

/**
 * Page object for the Cmd+K SearchModal (#142, 61b).
 *
 * The global shortcut handler lives in `src/contexts/LayoutContext.tsx`
 * and triggers on `(metaKey || ctrlKey) && key === 'k'`, so `Control+k`
 * is cross-platform safe in Playwright (no need to branch on os).
 *
 * SearchModal renders into a portal at <body>, exposes `role="dialog"`
 * with `aria-label="Search"`, a `role="combobox"` input, and rows with
 * `role="option"` + `aria-selected` reflecting keyboard highlight.
 */
export class SearchPage {
  readonly page: Page

  readonly dialog: Locator
  readonly input: Locator
  readonly listbox: Locator

  constructor(page: Page) {
    this.page = page
    this.dialog = page.getByRole('dialog', { name: 'Search' })
    this.input = this.dialog.getByRole('combobox')
    this.listbox = this.dialog.getByRole('listbox', { name: 'Search results' })
  }

  /**
   * Navigate to the app root via the hash router and wait for the React
   * app to mount. The global Cmd+K listener is registered inside a
   * LayoutContext `useEffect`, so pressing the shortcut before the
   * sidebar appears is a race — waiting on the sidebar nav guarantees
   * the listener is attached.
   */
  async goto(path: string = '/'): Promise<void> {
    await this.page.goto(hashUrl(path))
    await this.page.waitForLoadState('domcontentloaded')
    await this.page.getByRole('navigation', { name: 'Main navigation' }).waitFor()
  }

  /**
   * Open the modal via the global shortcut. Caller picks `Control+k` for
   * hermetic cross-platform behavior; `Meta+k` is accepted by the source
   * handler too (the predicate is `metaKey || ctrlKey`).
   */
  async openWithShortcut(key: 'Control+k' | 'Meta+k' = 'Control+k'): Promise<void> {
    await this.page.keyboard.press(key)
    await expect(this.dialog).toBeVisible()
    // The input is focused via requestAnimationFrame inside SearchModal's
    // open effect; toBeFocused waits for that frame to land.
    await expect(this.input).toBeFocused()
  }

  /** All currently visible result rows (role="option"). */
  results(): Locator {
    return this.dialog.getByRole('option')
  }

  /**
   * Result row by visible accessible name. The button's accessible name
   * concatenates label + hint + category badge (e.g., "Budget Monthly
   * spending Pages"), so we substring-match the label rather than
   * requiring an exact accessible-name equality.
   */
  result(name: string | RegExp): Locator {
    return this.dialog.getByRole('option', { name, exact: false })
  }

  /** The currently highlighted row (`aria-selected="true"`). */
  activeResult(): Locator {
    // role=option with selected:true narrows to the active row.
    return this.dialog.getByRole('option', { selected: true })
  }

  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await expect(this.dialog).toBeHidden()
  }

  async arrowDown(times: number = 1): Promise<void> {
    for (let i = 0; i < times; i++) {
      await this.page.keyboard.press('ArrowDown')
    }
  }

  async arrowUp(times: number = 1): Promise<void> {
    for (let i = 0; i < times; i++) {
      await this.page.keyboard.press('ArrowUp')
    }
  }

  /**
   * Returns true iff `document.activeElement` is a descendant of the
   * search dialog. Used to verify the focus trap holds during Tab cycling.
   */
  async isFocusInsideDialog(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      return !!d && d.contains(document.activeElement)
    })
  }
}
