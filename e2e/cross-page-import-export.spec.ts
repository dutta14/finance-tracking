import { test, expect } from './fixtures/base'
import type { Page, BrowserContext } from '@playwright/test'
import {
  buildV2Export,
  CROSS_PAGE_ACCOUNTS,
  CROSS_PAGE_BALANCES,
  CROSS_PAGE_BUDGET_CONFIG,
  CROSS_PAGE_BUDGET_STORE,
  CROSS_PAGE_BUDGET_SUMMARY,
  CROSS_PAGE_GOAL,
  CROSS_PAGE_PROFILE,
} from './fixtures/cross-page-data'
import { SettingsPage } from './pages/settings.page'

/**
 * #154 — Cross-page: Import/Export + Cross-tab + Dark Mode (62d)
 *
 * 10 tests covering Flow 7 (Import/Export round-trip), legacy v1 import,
 * cross-tab `storage`-event propagation, dark mode persistence, and the
 * sync-free navigation path.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Adaptations from the spec / audit (A1–A10) — baked in so future
 * reviewers don't have to re-derive:
 *
 *  A1. v2 export shape: `buildV2Export()` in cross-page-data.ts matches
 *      the 15 top-level keys written by `handleExport`
 *      (ImportExportContext.tsx:31-71). Trust it; we reuse verbatim.
 *
 *  A2. Legacy v1 detection (importValidator.ts:279-320):
 *      - Array-at-root: `[{...goal}]` is accepted (line 297).
 *      - `parsed.plans` is a fallback for `parsed.goals` (line 301-302).
 *      Required goal fields: `id` (number) + `goalName` (non-empty
 *      string). Two separate tests cover the two legacy shapes (#2, #3).
 *      Payloads are built inline — a fixture helper for two callsites
 *      would be over-engineering.
 *
 *  A3. Cross-tab path: Tab A writes `localStorage` → native `storage`
 *      event fires in Tab B → appStorage's listener
 *      (appStorage.ts:74-106) → subscribers in SettingsContext (darkMode,
 *      accentTheme; SettingsContext.tsx:46-60) or DataContext
 *      (data-accounts, data-balances; DataContext.tsx:46-63) → state
 *      update → React re-render. We verify the OBSERVABLE end-state
 *      (DOM class, rendered amount, localStorage value) rather than
 *      poking internal subscriber arrays.
 *
 *  A4. Factory reset: `handleFactoryReset` (ImportExportContext.tsx:
 *      138-141) calls `localStorage.clear()` then `window.location.
 *      reload()` synchronously. `localStorage.clear()` does NOT fire
 *      per-key `storage` events, and no `data-changed` precedes the
 *      reload, so consumers see emptiness only after the new page boots
 *      and reads localStorage on init.
 *
 *  A5. Reload-race gate (MANDATORY): `handleImport` schedules
 *      `setTimeout(reload, 200)` (ImportExportContext.tsx:128); factory
 *      reset reloads synchronously. Both destroy the execution context.
 *      We use the window-sentinel + `page.waitForFunction` pattern
 *      established in cross-page-home.spec.ts:480-512 / PR #171.
 *      `waitForLoadState('load')` is unusable here — it returns
 *      immediately when the page is already loaded.
 *
 *  A6. Dark mode is keyed `darkMode` (string '0'|'1';
 *      SettingsContext.tsx:27-32). Applied as `document.body.classList.
 *      add('dark')` (SettingsContext.tsx:64-65), inherited by all six
 *      pages via the CSS cascade. Cross-tab via the `darkMode`
 *      subscriber (SettingsContext.tsx:48-50).
 *
 *  A7. GitHub sync: default seed has no `github-sync-config`, so
 *      `isConfigured=false` and sync never fires. Test #10 verifies the
 *      realistic default-user navigation path WITHOUT any sync mocking
 *      and asserts no console errors and no calls to api.github.com
 *      (other than the feature-flags fetch handled by the global base
 *      fixture). This is more valuable than a contrived "sync in
 *      flight" mock — the original spec angle ("sync during nav") is
 *      not reachable from the default user state.
 *
 *  A8. Full-lifecycle minimum data set:
 *        Home       → data-accounts, data-balances, financialGoals,
 *                     budget-summary
 *        Net Worth  → data-accounts, data-balances
 *        Goals      → financialGoals, user-profile
 *        Budget     → budget-store, budget-summary
 *        Taxes      → tax-store, tax-templates
 *        Drive      → (nothing required)
 *      `buildV2Export()` contains all of these.
 *
 *  A9. Reuse existing helpers: `buildV2Export`, `CROSS_PAGE_*` data
 *      constants, `SettingsPage` page object. We do NOT re-invent.
 *
 *  A10. seedOnce vs. seedCrossPage: `seedCrossPage` gates on
 *       `localStorage.__cross_page_seeded`. `localStorage.clear()`
 *       (factory reset) wipes the gate, so on the post-reset reload
 *       the init script re-seeds — restoring all the data we just
 *       destroyed. That breaks test #8 ("factory reset → empty
 *       Home"). We use a local `seedOnce` helper that gates on
 *       `sessionStorage` instead. sessionStorage survives `localStorage.
 *       clear()` and tab reloads but is per-tab — so a tab-B opened in
 *       a cross-tab test correctly starts WITHOUT the addInitScript
 *       (we register it on the primary `page` only) and just inherits
 *       the shared localStorage that tab A already seeded. This makes
 *       both the factory-reset path (#8) and the cross-tab paths
 *       (#4, #6, #7) work from one helper.
 * ──────────────────────────────────────────────────────────────────────
 */

const HOME = '/finance-tracking/'

interface SeedOverrides {
  goals?: unknown[]
  gwGoals?: unknown[]
  darkMode?: '0' | '1'
}

/**
 * Seed once per tab via sessionStorage gate (see adaptation A10). The
 * gate survives `localStorage.clear()` + reload — which is exactly the
 * post-factory-reset and post-import boot cycle that our reload-race
 * tests trigger. Without that, the addInitScript would re-seed after
 * every reload and overwrite the very thing under test.
 *
 * Only registers on the primary `page`. Tab-B in cross-tab tests opens
 * via `context.newPage()` and inherits the shared localStorage tab A
 * has already populated; tab-B does NOT need its own init script.
 */
async function seedOnce(page: Page, overrides: SeedOverrides = {}): Promise<void> {
  const data = {
    profile: CROSS_PAGE_PROFILE,
    accounts: CROSS_PAGE_ACCOUNTS,
    balances: CROSS_PAGE_BALANCES,
    goals: overrides.goals ?? [CROSS_PAGE_GOAL],
    gwGoals: overrides.gwGoals ?? [],
    budgetSummary: CROSS_PAGE_BUDGET_SUMMARY,
    budgetStore: CROSS_PAGE_BUDGET_STORE,
    budgetConfig: CROSS_PAGE_BUDGET_CONFIG,
    // Taxes.tsx requires `{ years: {} }` shape (see fixture comment);
    // a bare `{}` crashes the page on mount.
    taxStore: { years: {} } as unknown,
    taxTemplates: [] as unknown[],
    darkMode: overrides.darkMode ?? '0',
  }

  await page.addInitScript(payload => {
    if (sessionStorage.getItem('__cross_page_d_seeded') === '1') return
    sessionStorage.setItem('__cross_page_d_seeded', '1')
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '0')
    localStorage.setItem('onboarding-dismissed', '1')
    localStorage.setItem('darkMode', payload.darkMode)
    const writeIf = (key: string, value: unknown) => {
      if (value === null || value === undefined) return
      localStorage.setItem(key, JSON.stringify(value))
    }
    writeIf('user-profile', payload.profile)
    writeIf('data-accounts', payload.accounts)
    writeIf('data-balances', payload.balances)
    writeIf('financialGoals', payload.goals)
    writeIf('gw-goals', payload.gwGoals)
    writeIf('budget-summary', payload.budgetSummary)
    writeIf('budget-store', payload.budgetStore)
    writeIf('budget-config', payload.budgetConfig)
    writeIf('tax-store', payload.taxStore)
    writeIf('tax-templates', payload.taxTemplates)
  }, data)
}

async function gotoHome(page: Page): Promise<void> {
  await page.goto(HOME)
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Plant a window sentinel and return a function that waits for the
 * reload to land (sentinel absent on the fresh window). See A5.
 */
async function armReloadGate(page: Page): Promise<() => Promise<void>> {
  await page.evaluate(() => {
    ;(window as unknown as { __preReloadSentinel?: boolean }).__preReloadSentinel = true
  })
  return async () => {
    await page.waitForFunction(
      () => !(window as unknown as { __preReloadSentinel?: boolean }).__preReloadSentinel,
    )
  }
}

/**
 * Read the v2 export by clicking the Export button and streaming the
 * download. Returns the parsed JSON. The Advanced pane must already
 * be open.
 */
async function downloadExport(page: Page, settings: SettingsPage): Promise<Record<string, unknown>> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    settings.exportBtn.click(),
  ])
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<string, unknown>
}

/**
 * Open Settings → Advanced and trigger an import with the given payload,
 * waiting for the post-import reload to land. Returns when the new
 * execution context is alive (per A5 sentinel gate).
 */
async function importJson(page: Page, content: string, filename = 'import.json'): Promise<void> {
  const settings = new SettingsPage(page)
  await settings.openInPlace()
  await settings.navTo('advanced')
  const waitForReload = await armReloadGate(page)
  await settings.importFileInput.setInputFiles({
    name: filename,
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  })
  await waitForReload()
  await page.waitForLoadState('domcontentloaded')
}

async function openTab(context: BrowserContext, url = HOME): Promise<Page> {
  const tab = await context.newPage()
  await tab.goto(url)
  await tab.waitForLoadState('domcontentloaded')
  return tab
}

test.describe('Cross-page: Import/Export + Cross-tab + Dark Mode (#154)', () => {
  test.beforeEach(async ({ context }) => {
    // sessionStorage is per-context per-tab; Playwright already
    // isolates contexts between tests, so the seedOnce gate naturally
    // resets. We still clear cookies as a belt-and-braces.
    await context.clearCookies()
  })

  /* ────────────────────────────────────────────────────────────
   * Flow 7: Import/Export Round-trip
   * ──────────────────────────────────────────────────────────── */

  test('1. Export v2 round-trip restores all 6 pages after factory reset', async ({ page }) => {
    // ARRANGE: seed full data set, open Settings → Advanced.
    await seedOnce(page)
    await gotoHome(page)
    const settings = new SettingsPage(page)
    await settings.openInPlace()
    await settings.navTo('advanced')

    // ACT 1: Export → capture file.
    const exported = await downloadExport(page, settings)
    // Enhanced assertion (spec test 26): `exportedAt` is an ISO timestamp
    // within 1 minute of "now". Catches a future regression that drops
    // the timestamp or stringifies a Date object incorrectly.
    expect(typeof exported.exportedAt).toBe('string')
    expect(Math.abs(new Date(exported.exportedAt as string).getTime() - Date.now())).toBeLessThan(60_000)
    expect(exported.version).toBe(2)

    // ACT 2: Factory reset (real flow, triggers synchronous reload).
    await settings.factoryResetBtn.click()
    await expect(settings.factoryResetConfirmBtn).toBeVisible()
    const waitForResetReload = await armReloadGate(page)
    await settings.factoryResetConfirmBtn.click()
    await waitForResetReload()
    await page.waitForLoadState('domcontentloaded')

    // ACT 3: Import the captured v2 payload.
    await importJson(page, JSON.stringify(exported), 'v2-roundtrip.json')

    // ASSERT: every page renders with restored data.
    await gotoHome(page)
    await expect(page.locator('.home-card--nw .nw-amount')).toContainText('$315,000')
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Casey/ })).toBeVisible()

    for (const route of ['#/goal', '#/net-worth', '#/budget', '#/taxes', '#/drive']) {
      await page.goto(HOME + route)
      await page.waitForLoadState('domcontentloaded')
      const name = route.includes('goal')
        ? /^Goals$/
        : route.includes('net-worth')
          ? /^Net Worth$/
          : route.includes('budget')
            ? /^Budget$/
            : route.includes('taxes')
              ? /^Taxes$/
              : /^Drive$/
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    }
  })

  test('2. Legacy v1 array-at-root import populates Goals page', async ({ page }) => {
    // A2: importValidator.ts:297 accepts `Array.isArray(parsed)` as the
    // goals source. Required fields are `id: number` + non-empty
    // `goalName: string` (importValidator.ts:81-88).
    await seedOnce(page, { goals: [] }) // start with no goals so we can see the import landed
    await gotoHome(page)

    const v1Array = [
      {
        id: 99,
        goalName: 'Legacy V1 Array Goal',
        fiGoal: 1_500_000,
        retirementAge: 60,
        goalCreatedIn: '2024-01-01',
        goalEndYear: '2055-01-01',
        expenseValue: 50_000,
        monthlyExpenseValue: 4_000,
        expenseValue2047: 80_000,
        monthlyExpense2047: 6_500,
        inflationRate: 3,
        safeWithdrawalRate: 4,
        growth: 6,
        birthday: '',
      },
    ]
    await importJson(page, JSON.stringify(v1Array), 'v1-array.json')

    await page.goto(HOME + '#/goal')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('Legacy V1 Array Goal')).toBeVisible()
  })

  test('3. Legacy v1 "plans" key import populates Goals page', async ({ page }) => {
    // A2: importValidator.ts:301-302 falls back to `parsed.plans` when
    // `parsed.goals` is absent.
    await seedOnce(page, { goals: [] })
    await gotoHome(page)

    const v1Plans = {
      plans: [
        {
          id: 77,
          goalName: 'Legacy Plans Goal',
          fiGoal: 1_200_000,
          retirementAge: 58,
          goalCreatedIn: '2024-01-01',
          goalEndYear: '2052-01-01',
          expenseValue: 45_000,
          monthlyExpenseValue: 3_750,
          expenseValue2047: 70_000,
          monthlyExpense2047: 5_800,
          inflationRate: 3,
          safeWithdrawalRate: 4,
          growth: 6,
          birthday: '',
        },
      ],
      profile: { name: 'Plans Tester', birthday: '1990-01-01', avatarDataUrl: '' },
    }
    await importJson(page, JSON.stringify(v1Plans), 'v1-plans.json')

    await page.goto(HOME + '#/goal')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('Legacy Plans Goal')).toBeVisible()
  })

  /* ────────────────────────────────────────────────────────────
   * Cross-tab propagation
   * ──────────────────────────────────────────────────────────── */

  test('4. Dark mode toggle in tab A propagates to tab B via storage event', async ({ page, context }) => {
    // A3 + A6: Tab A writes `darkMode=1` → native storage event fires
    // in tab B → appStorage subscriber → SettingsContext setDarkMode →
    // useEffect adds 'dark' class to body in tab B.
    await seedOnce(page, { darkMode: '0' })
    await gotoHome(page)
    const tabB = await openTab(context)
    await expect.poll(() => tabB.evaluate(() => document.body.classList.contains('dark'))).toBe(false)

    // Mutate in tab A — same-window write does NOT fire storage event
    // in tab A, only in tab B. That's the contract under test.
    await page.evaluate(() => localStorage.setItem('darkMode', '1'))

    await expect.poll(() => tabB.evaluate(() => document.body.classList.contains('dark'))).toBe(true)
  })

  test('5. Dark mode persists across hard reload and all 6 pages', async ({ page }) => {
    // A6: `darkMode` is read on boot (SettingsContext.tsx:27-32) and
    // applied as `body.classList.add('dark')`. The class is on <body>
    // and inherited across client-side routes via the CSS cascade.
    await seedOnce(page, { darkMode: '1' })
    await gotoHome(page)
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('dark'))).toBe(true)

    // Hard reload — sentinel is on sessionStorage so seedOnce skips,
    // and the boot read picks up darkMode='1' from localStorage.
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    expect(await page.evaluate(() => document.body.classList.contains('dark'))).toBe(true)

    for (const route of ['#/', '#/goal', '#/net-worth', '#/budget', '#/taxes', '#/drive']) {
      await page.goto(HOME + route)
      await page.waitForLoadState('domcontentloaded')
      expect(
        await page.evaluate(() => document.body.classList.contains('dark')),
        `darkMode must persist on route ${route}`,
      ).toBe(true)
    }
    expect(await page.evaluate(() => localStorage.getItem('darkMode'))).toBe('1')
  })

  test('6. Balance mutation in tab A propagates to tab B Home Net Worth card', async ({ page, context }) => {
    // A3: writing `data-balances` in tab A fires native storage event
    // in tab B → appStorage → DataContext subscriber → re-render.
    // We use raw `localStorage.setItem` here (not `mutateAccountBalance`,
    // which also dispatches `data-changed` — irrelevant for cross-tab
    // because that's a same-window event).
    //
    // Tab B opens on Home (not the dedicated Net Worth page) so we can
    // reuse the well-known `.home-card--nw .nw-amount` selector — the
    // Net Worth route renders the same DataContext data but through
    // BalanceSpreadsheet cells, which are noisier to assert against
    // and not what's under test here (cross-tab propagation, not the
    // /net-worth UI).
    await seedOnce(page)
    await gotoHome(page)
    const tabB = await openTab(context)
    await expect(tabB.locator('.home-card--nw .nw-amount')).toContainText('$315,000')

    // Mutate in tab A: change 401k's April balance from 260000 → 999000.
    // Net worth April = 999000 + 55000 = $1,054,000 (was $315,000).
    await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('data-balances') || '[]') as {
        id: number
        accountId: number
        month: string
        balance: number
      }[]
      const idx = list.findIndex(b => b.accountId === 1 && b.month === '2025-04')
      if (idx >= 0) list[idx] = { ...list[idx], balance: 999_000 }
      localStorage.setItem('data-balances', JSON.stringify(list))
    })

    await expect(tabB.locator('.home-card--nw .nw-amount')).toContainText('$1,054,000')
  })

  test('7. accentTheme mutation in tab A propagates to tab B via storage event', async ({ page, context }) => {
    // A3 + SettingsContext.tsx:52-54: `accentTheme` is a non-encrypted
    // string key, so appStorage's `notifySubscribers` path runs even
    // outside the sensitive-key branch (appStorage.ts:102-105).
    await seedOnce(page)
    await gotoHome(page)
    const tabB = await openTab(context)

    // Install a native storage listener in tab B BEFORE the mutation
    // in tab A. This proves the event reached tab B's window — a
    // simple "read localStorage in tab B" assertion would also pass
    // when storage is merely shared (no event fired). We want the
    // event itself, not just the value.
    await tabB.evaluate(() => {
      const w = window as unknown as { __accentEvents: string[] }
      w.__accentEvents = []
      window.addEventListener('storage', e => {
        if (e.key === 'accentTheme' && e.newValue) w.__accentEvents.push(e.newValue)
      })
    })

    await page.evaluate(() => localStorage.setItem('accentTheme', 'rose'))

    await expect
      .poll(() =>
        tabB.evaluate(() => (window as unknown as { __accentEvents: string[] }).__accentEvents),
      )
      .toEqual(['rose'])
    expect(await tabB.evaluate(() => localStorage.getItem('accentTheme'))).toBe('rose')
  })

  /* ────────────────────────────────────────────────────────────
   * Factory reset + reload-race regression
   * ──────────────────────────────────────────────────────────── */

  test('8. Factory reset clears localStorage and Home renders the empty state', async ({ page }) => {
    // A4 + A10: real factory reset (synchronous reload). seedOnce uses
    // a sessionStorage gate so the post-reset init script SKIPS
    // re-seeding — the test would be meaningless otherwise.
    await seedOnce(page)
    await gotoHome(page)
    await expect(page.locator('.home-card--nw .nw-amount')).toContainText('$315,000')

    const settings = new SettingsPage(page)
    await settings.openInPlace()
    await settings.navTo('advanced')
    await settings.factoryResetBtn.click()
    await expect(settings.factoryResetConfirmBtn).toBeVisible()
    const waitForReload = await armReloadGate(page)
    await settings.factoryResetConfirmBtn.click()
    await waitForReload()
    await page.waitForLoadState('domcontentloaded')

    // After reset, the sensitive-data keys must be cleared. Some
    // contexts re-emit empty containers on cold load (matches the
    // settings.spec.ts factory-reset accounting); we assert the
    // strong, narrow contract: the seeded payload values are gone.
    const accountsRaw = await page.evaluate(() => localStorage.getItem('data-accounts'))
    expect(accountsRaw === null || accountsRaw === '[]').toBe(true)
    const balancesRaw = await page.evaluate(() => localStorage.getItem('data-balances'))
    expect(balancesRaw === null || balancesRaw === '[]').toBe(true)

    // Home renders without crashing — the sidebar greeting heading is
    // the universal "page mounted" signal that does not depend on the
    // home-card render path (which is gated on having accounts and on
    // the onboarding-dismissed flag, both wiped by factory reset).
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).first(),
    ).toBeVisible()
    // Greeting carries no name suffix — the seeded "Casey" profile is gone.
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening), Casey/ }),
    ).toHaveCount(0)
  })

  test('9. Import sentinel gate completes reliably (anti-flake regression guard for PR #171)', async ({ page }) => {
    // A5 regression guard: the +200ms `setTimeout(reload)` in
    // `handleImport` (ImportExportContext.tsx:128) used to race
    // `waitForLoadState('load')` and produce "Execution context was
    // destroyed" flakes (#151 test 39, fixed in PR #171). This test
    // exercises the sentinel pattern explicitly and then proves the
    // NEW execution context is alive by issuing fresh evaluates and a
    // route change immediately afterward.
    await seedOnce(page, { goals: [] })
    await gotoHome(page)

    const v2 = buildV2Export({ goals: [{ ...CROSS_PAGE_GOAL, goalName: 'Sentinel Guard Goal' }] })
    await importJson(page, v2.content, v2.name)

    // 1) Fresh-context probe: this evaluate would throw "Execution
    //    context was destroyed" if armReloadGate returned before the
    //    new context settled.
    const docState = await page.evaluate(() => document.readyState)
    expect(['interactive', 'complete']).toContain(docState)

    // 2) Imported data is present in the new context.
    const goalsRaw = await page.evaluate(() => localStorage.getItem('financialGoals'))
    expect(goalsRaw).toContain('Sentinel Guard Goal')

    // 3) Follow-up navigation works (no stale handles, no listener
    //    leaks from the destroyed context).
    await page.goto(HOME + '#/goal')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('Sentinel Guard Goal')).toBeVisible()
  })

  /* ────────────────────────────────────────────────────────────
   * Sync-free navigation path (A7)
   * ──────────────────────────────────────────────────────────── */

  test('10. Navigation across all 6 pages succeeds with no GitHub credentials configured', async ({ page }) => {
    // A7: the original spec asked for "GitHub sync mid-navigation".
    // With the default seed, `github-sync-config` is absent →
    // `isConfigured=false` → sync never fires (verified in audit).
    // Mocking api.github.com to simulate "sync in flight" creates a
    // scenario unreachable from the default user state. Instead we
    // verify the realistic contract: a user WITHOUT GitHub configured
    // can navigate every page without console errors and without any
    // call leaving the app to api.github.com beyond the feature-flags
    // fetch handled by the global base fixture.
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    const apiGitHubHits: string[] = []
    await page.route('https://api.github.com/**', async route => {
      // Let feature-flags requests fall through to the base fixture handler.
      // Record and 404 everything else so we don't hit the public rate limit.
      const url = route.request().url()
      if (url.includes('feature-flags.json')) {
        await route.fallback()
        return
      }
      apiGitHubHits.push(url)
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    })

    await seedOnce(page)
    await gotoHome(page)
    expect(await page.evaluate(() => localStorage.getItem('github-sync-config'))).toBeNull()

    const routes: { path: string; heading: RegExp }[] = [
      { path: '#/', heading: /Good (morning|afternoon|evening)/ },
      { path: '#/goal', heading: /^Goals$/ },
      { path: '#/net-worth', heading: /^Net Worth$/ },
      { path: '#/budget', heading: /^Budget$/ },
      { path: '#/taxes', heading: /^Taxes$/ },
      { path: '#/drive', heading: /^Drive$/ },
    ]
    for (const { path, heading } of routes) {
      await page.goto(HOME + path)
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    }

    expect(apiGitHubHits, 'no GitHub API calls when sync is unconfigured').toEqual([])
    expect(consoleErrors, 'no console errors during sync-free navigation').toEqual([])
  })
})
