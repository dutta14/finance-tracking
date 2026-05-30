import type { Page } from '@playwright/test'

/**
 * Navigation-resilient wait for a `window.location.reload()` triggered by an
 * in-page action (e.g. ImportExportContext.handleImport, factory reset).
 *
 * Why this exists: `page.waitForLoadState('load')` is unusable as a post-
 * reload gate — Playwright resolves it immediately when the page is already
 * in the `load` state and does NOT wait for any FUTURE navigation. That
 * lets the next `page.evaluate(...)` race the reload and throw
 * "Execution context was destroyed".
 *
 * The fix is a window-sentinel: plant a flag on `window` BEFORE the trigger
 * runs, then `page.waitForFunction` for its absence. `waitForFunction` is
 * navigation-resilient — it re-evaluates the predicate in the new execution
 * context after the reload and resolves only when the sentinel is missing.
 *
 * Originally inlined in cross-page-home.spec.ts test 39 (PR #171); extracted
 * here per #172 so settings.spec.ts and any other suite needing a post-reload
 * gate can use the same primitive.
 *
 * Usage:
 * ```ts
 * await waitForReload(page, async () => {
 *   await someFileInput.setInputFiles({ ... })
 * })
 * // Reload has fully settled; safe to evaluate, navigate, or assert.
 * ```
 */
export async function waitForReload(page: Page, trigger: () => Promise<void>): Promise<void> {
  const SENTINEL = '__preReloadSentinel'
  await page.evaluate(key => {
    ;(window as unknown as Record<string, boolean>)[key] = true
  }, SENTINEL)
  await trigger()
  await page.waitForFunction(key => !(window as unknown as Record<string, boolean>)[key], SENTINEL)
}
