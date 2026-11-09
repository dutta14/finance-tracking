# Annual Review

- **Status:** Proposed
- **Owner:** Anindya
- **Last updated:** 2026-11-08
- **Priority:** 5 of 5 in the next-features list
- **Effort:** M

## 1. Summary and goal

**Problem.** At year-end the answer to "how did my year go?" is spread over four places: month-end balances in Wealth, the yearly Growth cards, spending by group in Cashflow, and goal progress in Planning. Nothing combines them, so the user rebuilds the picture by hand each January, and the Growth tab cannot be printed or handed to a partner or accountant. All the inputs already exist on disk; only the combined, read-only view is missing.

**Goal.** One page that shows a selected year in money (net worth change, savings rate, top spending groups, goal progress) that you can read, print, or save as a CSV.

**Success metrics (no telemetry; all verifiable by test or manual check).**

| ID | Metric | How to verify |
|---|---|---|
| M-1 | For every row in the worked-examples table (section 4.8) the selector returns the exact stated output. | Unit tests `selectAnnualReview.test.ts`, fixtures W1 to W10. |
| M-2 | For a fixture where Growth tab and Annual Review share a definition (no net-positive refund categories, no orphan balances), the two pages show identical net worth, income, expenses and savings. | Parity unit test calling the Growth tab pure helpers and the new selector on the same fixture. |
| M-3 | A user with 12 months of balances and transactions gets a full review in under 3 clicks from Home (Wealth, Review, pick year) and the page is readable with no setup. | Playwright test; manual stopwatch check against demo data. |
| M-4 | Printing (`emulateMedia({ media: 'print' })`) hides sidebar, tab bar and controls, forces a white background in dark mode, and never splits a figure or table row. | Playwright print test plus a manual Chrome print preview (US Letter). |
| M-5 | The CSV opens in a spreadsheet with the documented columns and no formula-injection. | Unit test on `buildReviewCsv`; manual open in Numbers/Excel. |
| M-6 | Zero network requests are made by the page. | Playwright `page.on('request')` assertion that no request leaves the app origin while the review loads. |

## 2. Current behavior (verified)

Everything below was checked in the repo on 2026-11-08. Nothing in this spec is implemented yet. The sibling specs `monthly-check-in.md`, `import-wizard.md`, `category-budget-targets.md` and `data-safety-net.md` were written alongside this one and have since been reconciled with it in section 8.

**IA and routing**
- The sidebar has Home, Planning (`goal`), Wealth (`net-worth`), Cashflow (`budget`), plus Drive, Settings and User Guide: `src/components/SidebarNavigation.tsx`.
- Router is `HashRouter` (`src/main.tsx`); the app is served at `/worth/` (`vite.config.js` `base`). Routes are declared in `src/App.tsx`; Wealth is `/net-worth/*` rendering `src/pages/data/Data.tsx`. `currentPage` is `net-worth` for any path that starts with `/net-worth`, so a new child route highlights Wealth with no `App.tsx` change.
- Wealth tabs are `NavLink`s in `<nav className="tab-bar" aria-label="Wealth sections">`: Dashboard, Allocation, Growth (`Data.tsx` around lines 497 to 506). Growth is `/net-worth/growth/savings` or `/income` and renders the lazy `src/pages/tools/components/SavingsGrowthTracker.tsx`. `activeTab` is derived from `location.pathname` (`Data.tsx` line 217).
- Planning uses `PlanningTabs` (`src/components/PlanningTabs.tsx`, `NavLink`s plus a focus-on-mount state flag). Cashflow uses `CashflowTabs` (button based, `aria-current`). Both reuse `src/styles/SectionTabs.css`. Wealth does not use `SectionTabs`.
- `.data-page` is `height: 100vh; overflow-y: hidden` and `.data-scroll-area` is the scroller (`src/styles/Data.css`). Anything under Wealth will be clipped to one screen when printed unless overridden.

**Print today.** The only print rule is `@media print { .navbar { display: none } body { background-color: white } }` in `styles/app.css` (line 114). `.navbar` is not rendered by the current sidebar (`nav.sidebar`, `position: fixed`), so printing any page today includes the sidebar. No component stylesheet in `src/styles` contains `@media print`.

**Net worth data**
- Accounts live in `accounts.json` and balances in `balances/{year}.csv` with columns `month,accountId,balance` (`src/utils/balanceStorage.ts`). `BalanceEntry.month` is `YYYY-MM`. `DataContext` (`src/contexts/DataContext.tsx`) exposes `accounts`, `balances`, `allMonths` and has no loaded flag: both start as `[]` until the async reads finish.
- Net worth for a month is a plain signed sum with no sign flip by `nature`: `netWorth: assets + liabilities` (`BalanceCharts.tsx` line 94) and `sumAccountBalances` over all accounts including inactive (`NetWorthSummary.tsx` line 22). Liabilities therefore only work if entered as negative numbers.
- Saving balances in the spreadsheet only writes entries for active accounts (`Data.tsx` `handleSaveMonth`), so a closed account stops getting entries. Deleting an account deletes its balances (`handleDeleteAccount`).
- Growth tab year-end net worth (`SavingsGrowthTracker.tsx` `getYearEndNetWorths`, line 18): per year it picks December if present, else the latest month of that year, and sums every balance in that month, even for account ids not in `accounts`. The "previous" year for the change is the previous year in the sorted list of years that have any data, not necessarily the adjacent year (lines 188 to 189). There is no completeness check, so a December missing one account silently lowers net worth.

**Income, expenses, savings**
- Transactions are `transactions/{year}/{YYYY-MM}.csv` (`budgetStorage.ts` `loadBudgetStore`). `parseCSV` (`src/pages/budget/utils/csvParser.ts` lines 125 and 165) skips any row with an empty Category, so blank-category rows are dropped from every total today.
- Classification: a category is income if it is in a group with `type: 'income'` or id `income-others` (`getIncomeGroups`). Categories in the `removed` group are excluded. All other categories are expenses.
- Budget page totals (`useBudget.ts` `summary`, line 525): income is the signed sum of income categories; expense is the signed sum of all other categories, with the absolute value taken once at the end, so refunds in an expense category reduce spending. `saveRate = totalIncome > 0 ? 1 - expense/income : 0`, so it shows 0 when income is 0.
- Growth tab totals (`getBudgetYearlyData`, lines 52 to 110) take `Math.abs(sum)` per expense category (line 99), so a category that nets positive adds to expenses instead of reducing them. This differs from the Budget page. Growth `netIncome` is just budget income; `savings = ov.savings ?? netIncome - totalExpense` (line 197); `growth = nwChange - savings`.
- The "manual yearly log" is `savings-tracker-overrides.json`, shape `Record<year, { grossIncome?, taxes?, netIncome?, savings? }>` (constant `OVERRIDES_PATH` and interface `YearOverrides` are private to `SavingsGrowthTracker.tsx`). The UI only allows editing `netIncome` and `savings` when the year has no budget data (`canEdit`, line 217), but the calculation lets an override win over budget data (`ov.netIncome ?? bd.netIncome`), so a stale override silently beats later-imported transactions. There is no manual expense field.
- `budget/summary-cache.json` is overwritten with whichever year the Budget page last displayed (`useBudget.ts` line 552). It is not a per-year source and must not be read by this feature.
- `delta(cur, prev)` returns `null` when `prev === 0`, else `(cur - prev) / Math.abs(prev) * 100` (`src/pages/tools/utils/savingsCalc.ts`).
- The PM claim "SavingsGrowthTracker already pulls budget income and expense; nothing combines them into one view" is correct, with the caveat that it also combines them with net worth per year; what it lacks is a single-year narrative, completeness checks, top groups, goals, print and export.

**Goals.** `FinancialGoal` (`src/types.ts`) has numeric `id`, `goalName`, `goalCreatedIn` (`YYYY-MM`, used with `split('-')` in `goalCalculations.ts`) and `createdAt` (a `toLocaleString()` string, not parseable reliably; `GoalForm.tsx` line 234). Home progress is `fiTotal / getFiTarget(...)` clamped 0 to 100 using only the latest month and only active accounts (`getTotalForMonth` and the `fiProgress` clamp in `useGoalMetrics.ts`). `getTotalForMonth` in `goalMath.ts` is the same sum without the active filter. Growth assumptions come from `localStorage` key `goal-growth-settings` (`useGrowthSettings.ts`). `getGwTargetForGoal` is module-private, so GW progress cannot be reused without exporting it.

**Search.** `STATIC_PAGES` in `src/search/searchIndex.ts` already has `page-growth` (`/net-worth/growth`, icon `trending`). `buildIndex(data)` concatenates static arrays; `search()` with an empty query returns only `STATIC_PAGES` and `STATIC_COMMANDS`. Existing tests assert presence of specific ids, not counts of pages.

**Flags.** `src/flags/flagDefinitions.ts` defines only `MODERN_DESIGN` via `defineFlag`. Resolution is override (`localStorage` `flag-overrides`), then rollout percentage from `feature-flags.json`, then default (`FlagContext.tsx` `resolveFlag`). `FlagProvider` is mounted with no admin token (`App.tsx` `InnerProviders`), so `isAdmin` is always false and the Settings flag pane (`SettingsModal.tsx` line 274, `isAdmin` only) is unreachable; local enabling is via `flag-overrides` in `localStorage`, as in `CONTRIBUTING.md`.

**UI patterns to reuse.** Tokens in `src/styles/colorThemes.css`: `--color-text`, `--color-text-muted`, `--color-surface`, `--color-surface-alt`, `--color-bg`, `--color-border`, `--accent`, `--chart-nw-line`, `--fs-xs` to `--fs-2xl`, `--fw-*`, `--radius`, `--max-width`. `--radius-lg` is used in several stylesheets but defined nowhere (grep found no declaration); use `--radius`. There is no spacing token scale; `SavingsGrowthTracker.css` uses 12/16/20/24px literals. `.sr-only` is in `src/styles/utilities.css`. `YearNav` (`src/components/YearNav.tsx`) is a prev/next stepper styled by `Budget.css`; its buttons carry `title` only. Custom SVG chart with a text alternative: `TrajectorySparkline.tsx` (`role="figure"`, `aria-label`, `figcaption.sr-only`, `svg aria-hidden`). `useChartColors` reads computed colors once per render, so Recharts colors cannot follow a print media query. Existing CSV export: `src/pages/data/csvExport.ts` (Blob plus anchor click; its private `escapeCell` does not quote newlines); `serializeCSV` in `src/utils/csvUtils.ts` does (RFC 4180).

**Demo mode** seeds balances from 2016 to now, goals, and budget CSVs (`src/pages/settings/demoMode.ts`), so the demo is a ready fixture for e2e and screenshots. E2E seeds files with `seedFileStore` (`e2e/fixtures/seed-filestore.ts`).

## 3. Architecture

### 3.1 Placement (decision)

**A new tab "Review" under Wealth, route `/net-worth/review/:year?` (browser URL `https://anindya.dev/worth/#/net-worth/review/2025`).** Tab order: Dashboard, Allocation, Growth, Review.

Why not the alternatives:
- Top-level sidebar item: the IA was just reduced to Planning, Wealth, Cashflow. A fifth primary item for a once-a-year page dilutes it.
- Planning tab: Planning is forward-looking (Goals, Leverage, Pay Down, FIRE Calculator, Taxes). A backward-looking review belongs with history.
- Cashflow tab: the review is mostly net worth, and Cashflow tabs are all monthly detail views.
- Home card only: not linkable or printable, and Home is a glance surface. A year-end Home nudge is OUT for v1 (monthly-check-in owns prompts).
- Wealth already hosts Growth, the nearest sibling (yearly, savings, income). Search and `currentPage` need no new page type.

`/net-worth/review` with no year redirects (replace) to `/net-worth/review/{defaultYear}`. A non-4-digit param redirects to `/net-worth/review`. Flag off: `/net-worth/review*` redirects to `/net-worth/dashboard`.

### 3.2 Modules (all NEW unless marked)

```
src/pages/review/
  AnnualReview.tsx            page (lazy). Header, live region, sections, print footer
  types.ts                    all review types (3.3)
  hooks/useAnnualReview.ts    loads budget + manual log, subscribes, calls selector
  utils/netWorth.ts           month totals, coverage, anchors, change
  utils/cashflow.ts           source choice, totals, savings rate, mismatch
  utils/spending.ts           group spend, top 5, shares
  utils/goals.ts              goal snapshot at two anchors
  utils/availableYears.ts     year list and default year
  utils/selectAnnualReview.ts pure composition: inputs -> AnnualReview
  utils/format.ts             money, percent, points, signed wording, lists
  utils/reviewCsv.ts          buildReviewCsv, downloadReviewCsv
  components/ReviewHeader.tsx ReviewNetWorth.tsx NetWorthChart.tsx ReviewCashflow.tsx
             ReviewSpending.tsx ReviewGoals.tsx ReviewNotes.tsx ReviewEmpty.tsx
src/pages/tools/utils/savingsOverrides.ts   OVERRIDES_PATH, ManualYearLog, loader (shared with Growth tab)
src/styles/AnnualReview.css
```

### 3.3 Selector layer (pure, no React, no I/O, no `Date.now()`)

```ts
export type AnchorStatus = 'exact' | 'nearest' | 'incomplete' | 'missing'
export interface AccountRef { id: number; name: string }

export interface NetWorthAnchor {
  month: string | null          // YYYY-MM actually used
  total: number | null          // null when status is 'missing'
  status: AnchorStatus
  missing: AccountRef[]         // only for 'incomplete'
}
export interface MonthPoint { month: string; total: number | null; complete: boolean } // always 12, Jan..Dec

export interface NetWorthReview {
  start: NetWorthAnchor
  end: NetWorthAnchor
  change: number | null         // null unless both anchors are exact/nearest and months differ
  changePct: number | null      // null when start.total === 0 or change is null
  startNegative: boolean
  series: MonthPoint[]
}

export type CashflowSource = 'budget' | 'manual' | 'budget-partial' | 'none'
export interface ManualYearLog { grossIncome?: number; taxes?: number; netIncome?: number; savings?: number }
export interface CashflowReview {
  source: CashflowSource
  income: number | null
  expenses: number | null
  savings: number | null
  savingsRate: number | null    // percent, e.g. 35 for 35%
  monthsCovered: string[]       // YYYY-MM with a readable CSV
  gapMonths: string[]           // expected but missing
  unreadableMonths: string[]
  mismatch: { manualIncome: number | null; manualSavings: number | null; budgetIncome: number; budgetSavings: number } | null
}

export interface GroupSpend { id: string; name: string; amount: number; share: number } // share is percent of positive spend
export interface SpendingReview {
  top: GroupSpend[]                  // up to 5
  other: { count: number; amount: number; share: number } | null
  refundOnlyTotal: number            // sum of groups with net negative spend (a credit), as a positive number
  uncategorizedShare: number | null
}

export interface GoalSnapshot { goalId: number; name: string; target: number; startBalance: number | null; endBalance: number | null; startPct: number | null; endPct: number | null }

export type ReviewNote =
  | { code: 'anchor-incomplete'; which: 'start' | 'end'; month: string; accounts: AccountRef[] }
  | { code: 'anchor-nearest'; which: 'start' | 'end'; month: string }
  | { code: 'in-progress'; throughMonth: string }
  | { code: 'single-month' }
  | { code: 'negative-start' }
  | { code: 'budget-partial'; gapMonths: string[]; covered: number; expected: number }
  | { code: 'unreadable'; months: string[] }
  | { code: 'source-manual' }
  | { code: 'mismatch' }
  | { code: 'income-zero' }
  | { code: 'refund-groups'; amount: number }
  | { code: 'uncategorized'; share: number }

export interface AnnualReview {
  year: number
  status: 'complete' | 'in-progress' | 'empty'
  netWorth: NetWorthReview
  cashflow: CashflowReview
  spending: SpendingReview | null    // null when no readable transactions
  goals: GoalSnapshot[]
  notes: ReviewNote[]                // ordered; UI and CSV render the same list
  prior: { netWorthChange: number | null; income: number | null; expenses: number | null; savingsRate: number | null } | null
}

export interface ReviewInputs {
  year: number
  today: Date                         // injected; only year and month are read
  accounts: Account[]; balances: BalanceEntry[]
  transactionsByMonth: Record<string, Transaction[]>   // built by the hook from BudgetStore via parseCSV
  unreadableMonths: string[]
  categoryGroups: CategoryGroup[]                       // full list from BudgetStore
  manual: Record<number, ManualYearLog>
  goals: FinancialGoal[]; profileBirthday: string; growth: GrowthSettings // from useGrowthSettings
}

export function selectAnnualReview(i: ReviewInputs): AnnualReview
export function getAvailableYears(i: Pick<ReviewInputs, 'balances' | 'transactionsByMonth' | 'manual' | 'today'>): { years: number[]; defaultYear: number }
```

`prior` is the same selector run for `year - 1` (one level only; `prior.prior` is not computed), hidden when that year is `empty`.

### 3.4 Rules (the exact formulas)

**Month totals and coverage.** `total(M) = sum of balance for entries in month M whose accountId exists in accounts` (inactive accounts included, orphan ids ignored; this deliberately differs from the Growth tab only for orphans, which `handleDeleteAccount` normally prevents). An account is expected in month M when it has a first entry month `F <= M` and `M <= L`, where `L` is the latest month in all balances if the account is `active`, else the account's own last entry month. `missing(M)` = expected accounts with no entry in M. A month is complete when `missing(M)` is empty. Accounts with no entries are ignored. Limitation: a backfilled account opened earlier than its first entry is not flagged.

**Anchors.** Start target is `{year-1}-12`, end target is `{year}-12`.
1. Target month has entries and is complete: `exact`.
2. Target month has entries but is incomplete: `incomplete`; `total` is still reported but `change` is null (no silent substitution, no carry-forward).
3. Target month has no entries at all: `nearest`, resolved as follows. End: the latest month in `year` that has entries (for the in-progress year this is the normal case). Start: the latest month in `year-1` with entries, else the earliest month in `year`. The resolved month must itself be complete, else the anchor is `incomplete`. If nothing resolves: `missing`.
4. If start and end resolve to the same month: `change` null and note `single-month`.

**Net worth change.** `change = end.total - start.total`. `changePct = start.total === 0 ? null : change / |start.total| * 100` (same convention as `delta()` in `savingsCalc.ts`). When `start.total < 0`, `startNegative` is true and the UI footnotes that the percent is relative to the size of the starting figure. Contribution versus market growth is out of scope; the page never labels any part of the change as "returns".

**Status.** `year > today.year`: treated as `empty`. `year === today.year`: `in-progress`, note `in-progress` with the end anchor month. `year < today.year`: `complete`. `empty` when there is no resolvable anchor and `cashflow.source === 'none'`.

**Cashflow.** Expected months: `01..12` for a past year; for the current year `01..M` where M is the latest month that has a CSV (trailing months are not gaps; interior gaps are). `gapMonths` = expected months with no readable CSV. Per-month sums use the CSV file's month key, the same as Budget and Growth.
- Budget figures: `income` = signed sum of amounts in income-group categories; `expenses = -(signed sum of amounts in all other categories not in the removed group)`; both exclude removed categories (matches `useBudget` `summary`, not Growth's per-category `abs`). `savings = income - expenses`.
- Source precedence: (1) `budget` when at least one month is covered and `gapMonths` is empty. (2) else `manual` when the manual log has `netIncome`: `income = netIncome`; `savings = log.savings` if present, else null; `expenses = netIncome - savings` when both exist, else null. (3) else `budget-partial` when some months are covered (figures cover only those months; note `budget-partial`). (4) else `none`. Sources are never mixed field by field.
- `savingsRate = income > 0 && savings != null ? savings / income * 100 : null`. Savings may be negative, so the rate may be negative. Not annualized for partial years.
- `mismatch` is set only when source is `budget` and the manual log has `netIncome` or `savings`, and `|budgetIncome - manualIncome| > max(100, 0.01 * budgetIncome)` or the same test on savings. Budget wins; the note shows both. This differs from the Growth tab only for stale overrides, on purpose (see O-1).

**Spending.** Groups come from `getExpenseGroups(categoryGroups)` excluding id `removed`. A category in several groups counts in the first group in list order. For each group, `amount = -(signed sum over its categories for the year)`. Categories present in transactions but in no group, and not income or removed, go to a synthetic group named `Uncategorized`. Groups with `amount > 0` are ranked descending, ties by name ascending; `top` is the first 5; `other` aggregates the rest. `share = amount / sum of positive group amounts * 100`, so top plus other sums to 100. Groups with `amount <= 0` are not listed; their total credit is `refundOnlyTotal` (note `refund-groups`). Income groups are never listed. `uncategorizedShare` is the spend in the category named `Uncategorized` (the Import Wizard's `UNCATEGORIZED_EXPENSE`, which lives inside the `others` group, plus the synthetic group of the same name above), divided by the sum of positive group amounts. It is set when that share is 20% or more. The category is measured by name, not by group, because the wizard files it under `others` rather than in a group of its own. `Uncategorized income` (`UNCATEGORIZED_INCOME`) is an income category and never counts here.

**Goals.** For each goal with `goalCreatedIn` year `<=` the review year (unparseable counts as existing), `target = getFiTarget(goal, profileBirthday, growth.preBoundaryGrowth, growth.postBoundaryGrowth, growth.ageBoundary, growth.inflation)`; skip goals with `target <= 0`. `balance(M)` = sum of entries in month M for FI accounts, active or not (a historical snapshot must not depend on today's status; Home differs here). `pct = clamp(balance / target * 100, 0, 100)` at each anchor month; null when the anchor is `missing` or `incomplete`. The target is today's target; the UI says so. GW progress is deferred (`getGwTargetForGoal` is private).

**Available years.** Union of years from balance months, transaction month keys, and manual log keys, plus the current year; drop years with no data of any kind except the current year; sort descending. `defaultYear` is the latest year whose December has balances; else the latest year with any data; else the current year.

### 3.5 Flow

1. Route renders `AnnualReview` (lazy chunk, wrapped like other routes in `ErrorBoundary variant="card"`, which already exists in `App.tsx` for `/net-worth/*`).
2. `useAnnualReview(year)` reads `accounts`, `balances` from `useData()`, goals and profile from `useGoals()`, growth settings from `useGrowthSettings`, and loads (a) `loadBudgetStore(fileStore)` and (b) `savings-tracker-overrides.json` once on mount, then again on window events `budget-changed` and `tools-changed` and on `fileStore.subscribe('budget/categories.json', ...)` (the same triggers `useBudget` uses). It parses the CSVs for `year` and `year-1` only, with try/catch per month feeding `unreadableMonths`.
3. `selectAnnualReview` runs in `useMemo`; `today` comes from one `new Date()` created in the hook so tests can fake timers.
4. The page renders `loading` until the budget load settles; the net-worth section waits on the same flag so an empty `DataContext` is not mistaken for no data (see risk R-1).
5. Print uses the browser (`window.print()`); CSV is built from the same `AnnualReview` object, so screen, print and file cannot disagree.

### 3.6 Reuse versus new

Reuse: `useData`, `useGoals`, `useFileStore`, `loadBudgetStore`, `getExpenseGroups`, `getIncomeGroups`, `parseCSV` (budget), `getFiTarget`, `useGrowthSettings`, `formatMonth` and `formatCurrency` (`src/pages/data/types.ts`), `serializeCSV`, `.sr-only`, `.tab-bar`/`.tab-btn`, `ErrorBoundary`. New: everything in 3.2. Not reused: Recharts (colors cannot follow print media), `YearNav` (gaps in years make prev/next awkward; a native select lists real years), `csvExport.ts` `escapeCell` (private, no newline quoting).

### 3.7 Rollout and storage

New flag `ANNUAL_REVIEW = defineFlag('annual-review', { type: 'boolean', default: false, description: 'Shows the Annual Review tab under Wealth', temporary: true })` plus `"annual-review": { "percentage": 0 }` in `feature-flags.json`. Owner enables it with `localStorage` `flag-overrides` `{"annual-review": true}`; later 100%; then delete the flag in a cleanup PR. **No new on-disk data**: the selected year lives in the URL, nothing is cached, and the CSV is a browser download. The only read of a non-obvious file is `savings-tracker-overrides.json`, already in the folder.

## 4. Product requirements

### 4.1 User stories
- As a user at year-end, I want net worth, savings rate and top spending for a year on one page, so that I can review it without assembling it myself.
- As a user, I want to print it or save it as a PDF from the browser, so that I can keep it with my tax papers or share it with a partner.
- As a user, I want a CSV of the same numbers, so that I can drop them into my own spreadsheet.
- As a user with gaps in my data, I want the page to say exactly what is missing instead of showing a wrong number.
- As a keyboard or screen-reader user, I want every figure available as text and every control reachable in a sensible order.

### 4.2 Acceptance criteria

Navigation and years
- AC-1: With the flag on, Wealth shows a fourth tab "Review" after Growth; it links to `/net-worth/review`, and Wealth stays highlighted in the sidebar. With the flag off there is no tab, no search entry, and `/net-worth/review/2025` redirects to `/net-worth/dashboard`.
- AC-2: `/net-worth/review` redirects (replace) to `/net-worth/review/{defaultYear}` per 3.4. A param that is not exactly four digits redirects to `/net-worth/review`.
- AC-3: The year `<select>` lists `getAvailableYears` descending, shows the route year as selected, and changing it navigates with replace and announces "Showing the review for {year}." in a polite live region. A route year that is not in the list is still rendered (and typically shows the empty state).
- AC-4: The selected year survives reload and is part of the copied URL.

Net worth
- AC-5: For a complete year, start is the December `year-1` total and end is the December `year` total, and "Net worth change" equals end minus start (W1).
- AC-6: Percent change is `change / |start| * 100`, one decimal; hidden with the text "Percent change not available" when start is exactly 0 (W3); footnoted when start is negative (W2).
- AC-7: If a target December is absent, the nearest-month rules in 3.4 apply and the period label names the real months (W4). A note says which months were used.
- AC-8: If a target month exists but an expected account has no entry, the change is not shown; the page names the month and the missing accounts and links to `/net-worth/dashboard/spreadsheet` (W7).
- AC-9: For the current calendar year the page says it is in progress, uses the latest month with balances as the end, and shows no annualized figures (W5).
- AC-10: Accounts opened mid-year are not reported as missing before their first entry; accounts closed (inactive) are not reported as missing after their last entry.
- AC-11: The net worth chart shows 12 monthly points, leaves gaps (no interpolation) for months without entries, and marks incomplete months with a hollow point. A table of the same 12 values is available to assistive tech and via a "Show monthly values" button.

Cashflow
- AC-12: Income, expenses, savings and savings rate follow 3.4. Savings rate is shown as "Not available" when income is 0 or missing (W8), never as 0%.
- AC-13: Negative savings render as a negative dollar value and a negative rate, with neutral wording (W9).
- AC-14: When source is `manual`, the page says so and omits the spending breakdown (W10). When source is `budget-partial`, the page names missing months and the count covered.
- AC-15: When budget is complete and the manual log disagrees beyond the threshold, the page shows the `mismatch` note with both values and a link to `/net-worth/growth/savings`; the budget figures are the ones displayed (W6).
- AC-16: Unreadable transaction files are listed and excluded; the page still renders.

Spending
- AC-17: "Top spending groups" lists up to 5 expense groups by net spend with amount and share; an "All other groups" row appears when more than 5 groups have positive spend; shares sum to 100% within rounding (W1).
- AC-18: Refunds reduce the group they belong to; a group with net credit is not listed, and its credit is mentioned (W11). Income and removed categories never appear.
- AC-19: Spend in the `Uncategorized` category or synthetic group is shown inside its group like any other spend, and a note appears when it is 20% or more of positive spend. `Uncategorized income` never triggers the note.

Goals and prior year
- AC-20: Goal progress shows, for each goal that existed by year-end, progress at the start and end anchors (percent and "Up/Down N points"), computed against today's target; goals whose anchors are missing or incomplete show "Not available".
- AC-21: Under net worth change, income, expenses and savings rate the page shows "vs. {year-1}: ..." when the prior year is not empty, and nothing otherwise. No other year-over-year comparison exists.

States
- AC-22: Empty year shows "Not enough data for {year}" with links to Wealth and Cashflow, and Print and CSV are disabled.
- AC-23: While loading the page shows a `role="status"` "Loading your review..." and no numbers.
- AC-24: A thrown error shows the existing card `ErrorBoundary` fallback; the page never writes to the data folder.

Print and CSV
- AC-25: In print media the sidebar, sidebar overlay and toggle, skip link, demo banner, Wealth header and tabs, year select, buttons, and in-app links are hidden; the review title, period and all sections remain (M-4).
- AC-26: In print media the background is white and text is dark even when `body.dark` is set, and chart strokes use the light palette.
- AC-27: No section, figure, or table row is split across pages; table headers repeat.
- AC-28: "Download CSV" saves `worth-annual-review-{year}.csv` with the layout in 4.9; the file round-trips through `parseCSV` (`csvUtils`) into the same cells; text cells that start with `=`, `+`, `-` (non-numeric), `@`, tab or CR are prefixed with a single quote.
- AC-29: The page issues no network requests (M-6).

Accessibility
- AC-30: Every control is reachable by keyboard in the order in 5.7; focus indicators come from the global `:focus-visible` rule in `styles/app.css`.
- AC-31: Each section is a `<section>` labelled by its heading; headline numbers are in a `<dl>`; change direction is conveyed by words ("Up", "Down"), never by color or glyph alone.
- AC-32: The chart has a text summary and a data table; the spending bars are backed by a real `<table>`.

### 4.3 Scope IN
Single-year read-only page; net worth start and end with a 12-month chart; income, expenses, savings, savings rate; top 5 spending groups; FI goal progress at year start and end; one-level prior-year delta on four numbers; notes for data problems; print stylesheet; CSV; flag, search entry, Guide and README updates.

### 4.4 Scope OUT (and why)
- PDF library, server rendering, share links: breaks "no backend, nothing leaves your device"; the browser's Save as PDF covers it.
- Multi-year trends and year-over-year tables: the Growth tab already does this; the review is one year plus a single prior-year delta.
- Contribution versus market growth split: not derivable honestly from balances plus a savings figure (transfers, fees, valuation changes); the Growth tab's "Growth" column is already a rough version.
- Budget versus actual per category: depends on `category-budget-targets`; defer (see 8 and O-4).
- AI narrative, tax computations, gross income and tax rate (user-entered in Growth; not needed for the story).
- GW goal progress (target helper is private); Home nudge; persisted year preference; carry-forward of missing balances (O-3).

### 4.5 States
| State | Behavior |
|---|---|
| First-time (no data anywhere) | `getAvailableYears` returns only the current year; page shows "Nothing to review yet" with links; controls disabled. |
| Returning, full data | Default year per 3.4; all sections. |
| Loading | Status text, no numbers, controls disabled. |
| Partial data | Sections render what exists; each gap has a note; unavailable values read "Not available". |
| Error | Card fallback from `ErrorBoundary`; "Try again" resets. |

### 4.6 Keyboard and screen reader
Native `<select>` and `<button>`s only. The live region (`role="status"`) announces year changes and loading completion ("Review for 2025 is ready."). Notes are a `<ul>` under a "Things to know" heading and they follow the headline stats in DOM order. The headline block includes an SR-only sentence "{n} notes about this data follow." when `notes.length > 0`, so the reader knows to continue.

### 4.7 Edge cases
Year with only transactions (no balances): net worth card shows "Not available" with a link to Wealth; cashflow and spending render. Year with only balances: cashflow shows "No income or expense data for {year}" with a link to Cashflow. Leap-year and time zones are irrelevant (month keys only). Very long group or goal names wrap and never truncate in print. Hundreds of accounts: the selector is O(entries). Demo mode works unchanged. A transaction CSV dated outside its file month is counted by file month, as everywhere else.

### 4.8 Worked examples (selector contract, used as unit fixtures)
`today` is 2026-11-08 unless stated.

| ID | Scenario (year) | Inputs | Net worth output | Cashflow and spending output |
|---|---|---|---|---|
| W1 | Clean complete year (2025) | Dec 2024 total 400,000; Dec 2025 total 460,000; both complete. 12 CSV months: income 120,000. Group spend: Housing 30,000, Food 15,000, Transport 9,000, Travel 8,000, Health 6,000, Shopping 5,000, Entertainment 5,000. FI goal target 2,000,000; FI balances 300,000 (Dec 2024) and 380,000 (Dec 2025). | start 400,000 exact, end 460,000 exact, change +60,000, +15.0%. Goal 15.0% to 19.0%, Up 4.0 points. | source budget; expenses 78,000; savings 42,000; rate 35.0%. Top: Housing 38.5%, Food 19.2%, Transport 11.5%, Travel 10.3%, Health 7.7%; other (2 groups) 10,000 = 12.8%. |
| W2 | Negative start (2025) | Dec 2024 -20,000; Dec 2025 -5,000. | change +15,000; pct +75.0% (15,000 / 20,000); `startNegative` true. | n/a |
| W3 | Zero start (2025) | Dec 2024 0; Dec 2025 8,000. | change +8,000; pct null ("Percent change not available"). | n/a |
| W4 | First year of tracking (2025) | No 2024 months; first entry Mar 2025 = 50,000; Dec 2025 = 62,000; complete. | start nearest Mar 2025, end exact, change +12,000, +24.0%; note anchor-nearest (start). | n/a |
| W5 | Year in progress (2026) | Dec 2025 460,000; latest 2026 balances Oct = 483,000 (complete). CSVs Jan to Oct: income 100,000, expenses 70,000. | start exact, end nearest Oct 2026, change +23,000, +5.0%; status in-progress. | source budget (trailing Nov/Dec not gaps); savings 30,000; rate 30.0%, not annualized. |
| W6 | Source mismatch (2025) | Budget complete: income 120,000, expenses 78,000. Manual log: netIncome 118,000, savings 40,000. | n/a | Displays budget: savings 42,000, rate 35.0%; `mismatch` set (2,000 > max(100, 1,200)); note mismatch. With manual netIncome 119,500 and savings 41,800 no mismatch (500 <= 1,200 and 200 <= 420). |
| W7 | Incomplete December (2025) | Accounts: Checking (active), 401k (active). Dec 2025 has Checking 30,000 only; 401k has Nov 100,000 and Jan 2026 102,000. Dec 2024 complete 380,000. | end incomplete, missing [401k], change null, pct null; note anchor-incomplete (end). Chart shows hollow Dec point. | independent. |
| W8 | Zero income (2025) | Budget income 0, expenses 5,000. | n/a | savings -5,000; rate null ("Not available"); note income-zero. |
| W9 | Overspent year (2025) | Income 60,000; expenses 66,000. | n/a | savings -6,000; rate -10.0%. |
| W10 | Manual only (2025) | No CSVs. Manual netIncome 90,000, savings 18,000. | n/a | source manual; income 90,000; expenses 72,000; savings 18,000; rate 20.0%; `spending` null; note source-manual. With savings missing: expenses null, savings null, rate null. |
| W11 | Refunds (2025) | Travel: -8,000 spend and +500 refund; Gifts net +300 (credit only); other groups 70,000 spend. Income 120,000. | n/a | Travel amount 7,500; Gifts not listed; `refundOnlyTotal` 300; expenses = 77,500 + 70,000 - 300 = 147,200? No: expenses = 7,500 + 70,000 - 300 = 77,200; savings 42,800; rate 35.7%. Shares use positive total 77,500. |
| W12 | Empty year (2024) | No balances in 2023 or 2024, no CSVs, no manual log. | both anchors missing; status empty. | source none. UI: "Not enough data for 2024". |
| W13 | Closed account (2025) | Account X inactive, last entry Mar 2025. Dec 2025 has all other active accounts. | Dec 2025 complete (X not expected after Mar); X not in Dec total. | n/a |

### 4.9 CSV layout
File `worth-annual-review-{year}.csv`, UTF-8, comma separated, RFC 4180 quoting through `serializeCSV`, LF line endings, one trailing newline. Header is always `section,item,label,value,unit,share_percent,note`. Numbers use `.` decimals with no thousands separators and no currency symbols; money has 2 decimals, percent values are percent units with 2 decimals. Unavailable values are an empty `value` cell with the reason in `note`. Row keys are stable; only `spending`, `goals` and `notes` rows vary in count.

| section | item | value | unit | notes |
|---|---|---|---|---|
| report | `year`, `status` (`complete` or `in_progress`), `generated` (ISO date) | | year, text, date | |
| networth | `start_month`, `start`, `end_month`, `end`, `change`, `change_percent` | | month, usd, percent | `note` holds anchor status or reason |
| cashflow | `source`, `income`, `expenses`, `savings`, `savings_rate` | | text, usd, percent | `source` note is "12 of 12 months" style |
| spending | `group_1` to `group_5`, `other` | amount | usd | `label` is the group name, `share_percent` filled |
| goals | `goal_{id}_start`, `goal_{id}_end` | percent | percent | `note` is "FI balance 300000.00 usd of 2000000.00 usd target" |
| notes | `note_1`, `note_2`, ... | the note text | text | same sentences as the UI |

Sample for W1:

```
section,item,label,value,unit,share_percent,note
report,year,Year,2025,year,,
report,status,Review status,complete,text,,
report,generated,Generated on,2026-11-08,date,,
networth,start_month,Starting month,2024-12,month,,exact
networth,start,Starting net worth,400000.00,usd,,
networth,end_month,Ending month,2025-12,month,,exact
networth,end,Ending net worth,460000.00,usd,,
networth,change,Net worth change,60000.00,usd,,
networth,change_percent,Net worth change percent,15.00,percent,,
cashflow,source,Cashflow source,budget,text,,12 of 12 months
cashflow,income,Income,120000.00,usd,,
cashflow,expenses,Expenses,78000.00,usd,,
cashflow,savings,Savings,42000.00,usd,,
cashflow,savings_rate,Savings rate,35.00,percent,,
spending,group_1,Housing,30000.00,usd,38.46,
spending,group_2,Food,15000.00,usd,19.23,
spending,group_3,Transport,9000.00,usd,11.54,
spending,group_4,Travel,8000.00,usd,10.26,
spending,group_5,Health,6000.00,usd,7.69,
spending,other,All other groups,10000.00,usd,12.82,2 groups
goals,goal_12_start,Retire at 55,15.00,percent,,FI balance 300000.00 usd of 2000000.00 usd target
goals,goal_12_end,Retire at 55,19.00,percent,,FI balance 380000.00 usd of 2000000.00 usd target
```

## 5. Design spec

### 5.1 Component hierarchy
```
<div class="ar-page">                           (inside Data's .data-scroll-area)
  <div class="ar-live sr-only" role="status">Showing the review for 2025.</div>
  <header class="ar-header">
    <div class="ar-header__titles"><h2 class="ar-title">Annual Review <span>2025</span></h2><p class="ar-subtitle">...</p><p class="ar-period">January to December 2025</p></div>
    <div class="ar-controls">
      <label for="ar-year" class="ar-label">Year</label><select id="ar-year" class="ar-select">...</select>
      <button class="ar-btn" type="button">Print or save as PDF</button>
      <button class="ar-btn" type="button">Download CSV</button>
    </div>
  </header>
  <section class="ar-section ar-section--notes" aria-labelledby="ar-notes-h"><h3 id="ar-notes-h">Things to know</h3><ul class="ar-notes">...</ul></section>
  <section class="ar-section" aria-labelledby="ar-nw-h"><h3 id="ar-nw-h">Net worth</h3>
    <dl class="ar-stats"><div class="ar-stat"><dt>Net worth change</dt><dd class="ar-stat__value">Up $60,000</dd><dd class="ar-stat__sub">15.0% ...</dd></div> ... </dl>
    <figure class="ar-figure" role="figure" aria-labelledby="ar-nw-cap"><figcaption id="ar-nw-cap" class="sr-only">...summary...</figcaption>
      <svg class="ar-chart" viewBox="0 0 640 220" aria-hidden="true" focusable="false">...</svg>
      <button type="button" aria-expanded="false" aria-controls="ar-nw-table">Show monthly values</button>
      <table id="ar-nw-table" class="ar-table sr-only"><caption>Net worth at the end of each month, 2025</caption>...</table></figure></section>
  <section aria-labelledby="ar-cf-h">Income, Expenses, Savings, Savings rate in a .ar-stats list</section>
  <section aria-labelledby="ar-sp-h"><table class="ar-table"><caption>Spending by group, 2025</caption> Group | Spent | Share (+ inline bar span aria-hidden) </table></section>
  <section aria-labelledby="ar-goals-h"><ul class="ar-goals">...</ul></section>
  <p class="ar-print-footer">Prepared with worth on 2026-11-08. Your data stays on your computer.</p>
</div>
```
Headings: the existing `<h1>Wealth</h1>` stays; the page title is `h2`, sections are `h3`. The page sets `document.title = 'Annual Review 2025 - worth'` on mount and year change and restores the previous title on unmount (browsers use it as the default PDF file name).

### 5.2 Visual spec
Class prefix `ar-`. One stylesheet `src/styles/AnnualReview.css`, imported by `AnnualReview.tsx`. Colors only via variables from `colorThemes.css`; no hex except inside the print block (see 5.5). Spacing uses the multiples-of-4 literals already used in `SavingsGrowthTracker.css`.
- Page: `max-width: 880px` (about 70 characters at `--fs-md`), `margin: 0 auto`, `display: flex; flex-direction: column; gap: 24px`.
- Title `h2`: `--fs-2xl`, `--fw-bold`, `--color-text`, `letter-spacing: -0.3px` (the gradient `h1` style belongs to Wealth only). Subtitle and period: `--fs-sm`, `--color-text-muted`.
- Section card: `background: var(--color-surface)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius)`, `padding: 20px 24px`, internal `gap: 16px`. Section `h3`: `--fs-lg`, `--fw-semibold`.
- Stat: `dt` `--fs-sm` muted; `dd.ar-stat__value` `--fs-xl`, `--fw-bold`, `font-variant-numeric: tabular-nums`; `dd.ar-stat__sub` `--fs-sm` muted. Grid: `repeat(auto-fit, minmax(180px, 1fr))`, `gap: 16px`.
- Deltas: text color `--color-text` (neutral). No red or green fills for money direction; the direction is the word "Up" or "Down". The line stroke uses `stroke: var(--chart-nw-line)`, 2px, round joins; points `r=3` filled `var(--chart-nw-line)`, incomplete points hollow (`fill: var(--color-surface)`). Axis text `--fs-xs` `fill: var(--color-text-muted)`; gridlines `stroke: var(--color-border)`.
- Spending bar: a 6px high track `--color-surface-alt`, fill `--accent`, `aria-hidden`, width equal to share; the numbers are in the table cells.
- Notes: `--color-surface-alt` background, `--radius`, 12px 16px padding, `--fs-sm`; no icon colors; a leading stroke SVG info icon (`currentColor`, `aria-hidden`) per the repo icon rule. No emoji.
- Buttons `.ar-btn` follow `.budget-action-btn` (surface, `--color-border-light`, `--radius`, `--fs-md`, `--fw-medium`); the select inherits `body.modern-design select` styling.

### 5.3 States
| Element | default | hover | focus | active | disabled | loading | empty | error |
|---|---|---|---|---|---|---|---|---|
| `.ar-btn` | surface | `--color-surface-hover`, border `--color-text-muted` | global `:focus-visible` ring | same as hover | `opacity: 0.5; cursor: default` | disabled | disabled | disabled |
| `.ar-select` | per modern-design | border `--accent-border` | border `--accent`, ring from modern-design | n/a | disabled while loading | disabled | enabled (can pick another year) | enabled |
| Section | card | none | none | none | n/a | skeleton text only | hidden except empty card | card fallback |
| Table rows | none | none | none | none | n/a | n/a | n/a | n/a |

Empty card: centered, `--color-text-muted`, a heading, one sentence, two `.ar-btn` links. Error uses the existing `ErrorBoundary` card.

### 5.4 Responsive
Mobile-first. Below 480px: single column, `.ar-header` stacks, controls wrap to full-width buttons (min height 44px), chart `viewBox` unchanged but width 100% (axis labels thin to every third month), table cells `--fs-sm`. 480 to 767px: stats in 2 columns, controls on one row if they fit. 768 to 991px: page padding 24px, stats 2 or 3 columns by `auto-fit`. 992px and up: page centered at 880px, stats up to 4 columns. Touch targets on `.ar-btn` and `.ar-select` are 44px high at all widths (WCAG 2.5.5). The sidebar collapse at 900px is handled by the existing layout.

### 5.5 Print stylesheet (`@media print` in `AnnualReview.css`)
Scope every global rule with `body:has(.ar-page)` so other pages are unaffected (Chrome and Edge only, matching the app's support matrix).
- `@page { size: letter portrait; margin: 0.6in; }` (the app formats US dollars and en-US only).
- Hide: `.sidebar`, `.sidebar-overlay`, `.sidebar-toggle-wrapper`, `.skip-link`, `.demo-banner`, `.data-header`, `.ar-controls`, `.ar-live`, `.ar-link`, chart toggle buttons, and the undo toast.
- Layout resets: `.app-layout { display: block }`, `.main-content { margin: 0; padding: 0 }`, `.data-page { height: auto; overflow: visible; padding: 0; max-width: none }`, `.data-scroll-area { overflow: visible }`, `.ar-page { max-width: none; gap: 16px }`.
- Light palette forced even in dark mode: on `body:has(.ar-page)`, `.ar-page` redeclare `--color-text: #111827; --color-text-muted: #4b5563; --color-surface: #ffffff; --color-surface-alt: #f3f4f6; --color-border: #d1d5db; --accent: #2563eb; --chart-nw-line: #0f766e;` and set `body, .app-layout, .main-content { background: #ffffff !important; color: #111827 }`. These are the only literal hex values in the file, and they mirror the light values in `colorThemes.css`; the print block must also neutralize `body.modern-design` translucent borders (use `--color-border` above).
- Pagination: `.ar-section, .ar-figure, .ar-stat { break-inside: avoid }`; `h3 { break-after: avoid }`; `tr { break-inside: avoid }`; `thead { display: table-header-group }`; the monthly values table is shown (not `sr-only`) in print so the chart has numbers on paper; `-webkit-print-color-adjust: exact` on the bar fills only.
- Links and URLs: in-app links are hidden in print (hash routes mean nothing on paper); no `a[href]::after` URL expansion; the notes keep their text, minus "Open ..." link labels.
- `.ar-print-footer { display: block }` (hidden on screen): "Prepared with worth on {date}. Your data stays on your computer."
- No transitions or shadows in print.

### 5.6 Interaction and motion
Year change: content swaps immediately (no fade). Spending bar widths animate `width` 300ms `ease-out` on first paint only; `@media (prefers-reduced-motion: reduce)` and print disable it (matches the existing reduced-motion blocks). "Show monthly values" toggles the table with no animation. Print and CSV are one click; no confirmation. After Download CSV the live region says "Downloaded worth-annual-review-2025.csv." (no toast, no focus move).

### 5.7 Accessibility notes (WCAG 2.1 AA)
- Tab order: Wealth tabs, year select, Print, Download CSV, in-note links (spreadsheet, Growth, Cashflow Groups), "Show monthly values". Nothing else is focusable. Satisfies 2.1.1, 2.4.3, 2.4.7.
- Names and roles (4.1.2): select labelled by a visible `<label>`; buttons have visible text; `aria-expanded` and `aria-controls` on the toggle; the chart SVG is `aria-hidden` with the figcaption summary plus table (1.1.1, 1.3.1). Summary example: "Net worth rose from $400,000 in December 2024 to $460,000 in December 2025."
- Do not convey direction by color (1.4.1); text contrast 4.5:1 for normal text (1.4.3) using existing muted text tokens (light: `#6b7280` on `#ffffff` is 4.8:1; verify `--color-text-muted` on `--color-surface-alt` in dark mode during QA); non-text contrast 3:1 for the chart line and points against surface (1.4.11), checked in both modes.
- Live region `role="status"` for year change and download (4.1.3). Loading uses `role="status"`; the sections carry `aria-busy="true"` while loading.
- Reflow at 320px without horizontal scroll except inside `.ar-table` wrapper (1.4.10); text resizes to 200% (1.4.4).
- Headings are sequential (h2 then h3) under the existing h1 (1.3.1, 2.4.6).

## 6. Copy

Voice: plain, calm, direct. No exclamation marks, no praise, no shaming. Money is whole US dollars in the UI (`-$1,234` for negatives, matching `formatCurrency`), cents in the CSV. Percent: one decimal and `%`. Savings-rate change: "N.N points". Months: "Dec 2024" in compact places, "December 2024" in sentences. Deltas: "Up $X", "Down $X", "No change" (also when the rounded value is 0). Lists: "A, B, and C" (two items: "A and B"). Plurals: "1 month", "2 months"; "1 account", "2 accounts"; "1 point" only when exactly 1.0, else "points".

| Surface | String | Notes |
|---|---|---|
| Tab | Review | Wealth tab; aria name same |
| Search item | Annual Review (hint: "Your year in money: net worth, savings, spending") | keywords: annual review, year in review, year end, yearly, savings rate, top spending, print, csv |
| Page title | Annual Review {year} | `h2` |
| Subtitle | Your year in money, built from the files in your folder. | |
| Period (complete) | January to December {year} | |
| Period (in progress) | January to {Month} {year}, year in progress | |
| Period (nearest) | {Mon YYYY} to {Mon YYYY} | actual anchors |
| Year label | Year | select label |
| Live (year) | Showing the review for {year}. | |
| Live (ready) | Review for {year} is ready. | |
| Buttons | Print or save as PDF; Download CSV | |
| Live (CSV) | Downloaded worth-annual-review-{year}.csv. | |
| Loading | Loading your review... | |
| Notes heading | Things to know | |
| Notes lead-in | {n} notes about this data follow. | SR-only; singular "1 note about this data follows." |
| Net worth heading | Net worth | |
| Stat labels | Net worth change; Starting net worth; Ending net worth | |
| Stat value | Up $60,000 / Down $3,200 / No change | |
| Stat sub | 15.0% from $400,000 in Dec 2024 to $460,000 in Dec 2025 | |
| Percent n/a | Percent change not available | start is 0 |
| Unavailable | Not available | any null number |
| Chart caption | Net worth rose from $400,000 in December 2024 to $460,000 in December 2025. | "rose", "fell" or "was unchanged" |
| Toggle | Show monthly values / Hide monthly values | |
| Table caption | Net worth at the end of each month, {year} | |
| Table headers | Month; Net worth; Status | status: Complete, Incomplete, No data |
| Cashflow heading | Income and savings | |
| Cashflow labels | Income; Expenses; Savings; Savings rate | |
| Cashflow subs | Money in, from your transactions; Money out, after refunds; Income minus expenses; Savings as a share of income | manual source: "From your yearly log in Growth" |
| Prior-year line | vs. {year-1}: up $5,000 / down 2.1 points / no change | lower case after colon |
| Spending heading | Top spending groups | |
| Table caption | Spending by group, {year} | |
| Table headers | Group; Spent; Share | |
| Other row | All other groups ({n}) | |
| Goals heading | Goal progress at year end | |
| Goal row | {Name}: {p}% at the end of {year}; up 4.0 points from the start of the year | "down" when negative |
| Goals footnote | Progress is measured against each goal as it is set today. | |
| Goals none | You had no goals set by the end of {year}. | |
| Goals no plan | You have not set a goal yet. | link "Open Planning" |
| Note anchor-incomplete | {Month YYYY} is missing a balance for {accounts}. Add it in the spreadsheet to see the change for this year. | link "Open the spreadsheet" |
| Note anchor-nearest (start) | Your balances start in {Mon YYYY}, so the change covers {Mon YYYY} to {Mon YYYY}. | |
| Note anchor-nearest (end) | There are no balances for December {year}. The change runs to {Mon YYYY}. | |
| Note in-progress | {year} is still in progress. This review covers January to {Month}. | |
| Note single-month | Only one month of balances is recorded, so there is no change to show. | |
| Note negative-start | Net worth was negative at the start of the year, so the percent is relative to the size of that figure. | |
| Note budget-partial | Transactions are missing for {months}. Income and expenses cover {n} of {m} months. | link "Open Cashflow" |
| Note unreadable | {n} transaction files could not be read and are left out: {months}. | |
| Note source-manual | Income and savings come from the yearly log in Growth. Add transactions in Cashflow for a breakdown by group. | link "Open Growth" |
| Note mismatch | Your Growth log shows {manual} of income and your transactions add up to {budget}. This review uses your transactions. | link "Open Growth" |
| Note income-zero | Savings rate is not available because no income is recorded for {year}. | |
| Note refund-groups | Refunds in groups with no net spending reduced expenses by {amount}. | |
| Note uncategorized | {share}% of spending is in Uncategorized. You can sort it in Cashflow, Groups. | link "Open Groups" |
| Empty heading | Not enough data for {year} | |
| Empty body | Add month-end balances in Wealth or import transactions in Cashflow, then come back. | |
| Empty links | Go to Wealth; Go to Cashflow | |
| Empty (no data at all) | Nothing to review yet | same body |
| No cashflow | No income or expense data for {year} | |
| No balances | No balances for {year} | |
| Error | The review could not be built. Your files were not changed. | existing card fallback plus "Try again" |
| Print footer | Prepared with worth on {YYYY-MM-DD}. Your data stays on your computer. | print only |
| Doc title | Annual Review {year} - worth | |
| Guide blurb | Review: a one-page summary of any year, with net worth change, savings rate, top spending groups and goal progress. Print it or download a CSV. | FeaturesByPage |

## 7. Engineering plan

### 7.1 Files
| File | Status | Change |
|---|---|---|
| `src/pages/review/**` (3.2) and their `*.test.ts(x)` | NEW | One test file per source file (repo convention). |
| `src/styles/AnnualReview.css` | NEW | Screen and print styles. |
| `src/pages/tools/utils/savingsOverrides.ts` (+ test) | NEW | `OVERRIDES_PATH`, `ManualYearLog`, `loadSavingsOverrides(fileStore)` that keeps only finite numbers. |
| `src/pages/tools/components/SavingsGrowthTracker.tsx` | MODIFIED | Import the path and type instead of declaring them; no behavior change. |
| `src/flags/flagDefinitions.ts`, `feature-flags.json` | MODIFIED | Add `ANNUAL_REVIEW` and a 0% rollout entry. |
| `src/pages/data/Data.tsx` | MODIFIED | Lazy import, `activeTab` gains `'review'`, fourth `NavLink` when flag on, route `review/:year?` (with `/review` redirect) and flag-off redirect. Owns no header-right controls for this tab. |
| `src/search/searchIndex.ts`, `src/search/useSearchIndexData.ts` | MODIFIED | `SearchIndexData.annualReviewEnabled?: boolean`; `buildIndex` appends `page-annual-review` (route `/net-worth/review`, icon `chart`) when true; hook reads `useFlag`. |
| `src/contexts/DataContext.tsx` | MODIFIED (see O-5) | Add `isLoaded: boolean`, set after first accounts and balances reads settle. |
| `src/pages/guide/sections/FeaturesByPage.tsx`, `src/pages/guide/Guide.tsx` | MODIFIED | Review paragraph under Wealth and TOC keywords. |
| `README.md`, `CONTRIBUTING.md`, `docs/README.md` | MODIFIED | README Wealth section; CONTRIBUTING structure tree (`pages/review/`) and flag note; list this spec. |
| `e2e/annual-review.spec.ts`, `e2e/pages/annual-review.page.ts`, `e2e/fixtures/annual-review.fixtures.ts` | NEW | Seeded via `seedFileStore`. |

### 7.2 Key signatures
```ts
export const resolveAnchors = (year: number, totals: Map<string, MonthTotal>): { start: NetWorthAnchor; end: NetWorthAnchor }
export const buildMonthTotals = (accounts: Account[], balances: BalanceEntry[]): Map<string, { total: number; missing: AccountRef[] }>
export const chooseCashflow = (year: number, today: Date, budget: BudgetYear, manual: ManualYearLog | undefined): CashflowReview
export const rankGroups = (year: number, tx: Record<string, Transaction[]>, groups: CategoryGroup[]): SpendingReview
export const formatDelta = (n: number | null, kind: 'usd' | 'percent' | 'points'): string
export const buildReviewCsv = (r: AnnualReview, generatedOn: string): string
export const downloadReviewCsv = (csv: string, year: number): void   // Blob + anchor, same as csvExport.ts
export const useAnnualReview = (year: number): { status: 'loading' | 'ready' | 'error'; review: AnnualReview | null; years: number[]; defaultYear: number; retry: () => void }
```
Spec of `formatDelta`: rounds once with `Intl.NumberFormat` (not `toFixed`), returns "No change" when the rounded value is 0.

### 7.3 Implementation order (PR-sized slices, each green on the pre-commit checklist in `.github/copilot-instructions.md`)
1. **Selectors and types.** `types.ts`, `netWorth.ts`, `cashflow.ts`, `spending.ts`, `goals.ts`, `availableYears.ts`, `selectAnnualReview.ts`, `format.ts`, `savingsOverrides.ts` (+ SGT import swap), with tests for W1 to W13. No UI, no flag. Coverage stays above the 90% statements gate.
2. **Flag, route, data hook, empty/loading states.** Flag definition, `useAnnualReview`, `AnnualReview` shell with header, year select, live region, empty and loading states, Data tab and route, search entry, `DataContext.isLoaded`. Flag defaults off.
3. **Sections.** Net worth with SVG chart and table, cashflow, spending, goals, notes, prior-year lines.
4. **Print and CSV.** `AnnualReview.css` print block, document title handling, `reviewCsv.ts`, buttons.
5. **E2E, docs, enable.** Playwright specs, Guide, README, CONTRIBUTING, demo-data screenshot optional, then set the flag to 100% and schedule flag removal.

### 7.4 Test plan
- **Selector unit tests** (`vi.useFakeTimers` not needed because `today` is injected): one test per worked example W1 to W13 asserting the exact numbers in 4.8; plus boundary tests for mismatch (exactly at threshold is not a mismatch), tie-breaking in top groups, category in two groups, unparseable `goalCreatedIn`, orphan balance ids ignored, `year > today.year`, December exists only for inactive accounts.
- **Parity test (M-2):** fixture without net-positive refund categories; compare `netWorth` and `cashflow` with the Growth tab helpers (extract `getYearEndNetWorths` input/outputs by rendering `SavingsGrowthTracker` with a mocked store, or add a tiny export in slice 1 if rendering proves brittle).
- **Component tests** (Testing Library, role queries): header (label, select options, live announcement on change), each section's states, notes rendering for every `ReviewNote` code, empty and loading, "Show monthly values" toggles `aria-expanded` and visibility, buttons disabled when empty, Download calls the Blob path (mock `URL.createObjectURL`), print button calls `window.print`.
- **CSV tests:** exact string for W1 (the sample in 4.9), quoting of commas and newlines, injection prefix cases, empty-value rows for W3.
- **Tests that must be updated:** `src/pages/data/NetWorthTabs.test.tsx` and `Data.test.tsx` (tab list now varies by flag; add flag-on and flag-off cases and keep existing assertions on Dashboard/Allocation/Growth), `src/search/searchIndex.test.ts` (new flagged entry; no existing count assertions break), `src/search/useSearchIndexData` tests if present, `FlagAdminPane.test.tsx` (lists `FLAGS` entries; check it does not assume a single flag), `SavingsGrowthTracker.test.tsx` and `.branches.test.tsx` (import swap only), `Guide.test.tsx` (TOC), `DataContext.test.tsx` (isLoaded), `e2e/pages/net-worth.page.ts` tab helpers keep working.
- **Playwright:** (1) with flag override and seeded balances/CSVs, open Wealth, click Review, pick 2025, assert headline values; (2) empty year shows "Not enough data for 2024"; (3) incomplete December shows the missing account and no change value; (4) keyboard-only: Tab to the select, change year with arrow keys, Tab to Print and Download, assert order and that the download event filename is `worth-annual-review-2025.csv`; (5) print: `await page.emulateMedia({ media: 'print' })`, assert `.sidebar`, `nav[aria-label="Wealth sections"]`, `#ar-year`, and Print button are hidden, `h2` "Annual Review 2025" visible, and, with dark mode on, `getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)'`; also `page.pdf()` assertion is out (Chromium-only API, flaky); (6) no requests outside the origin (M-6).
- **A11y checks:** repo has no axe dependency; use role/name/`aria-expanded`/live-region assertions as other specs do. Manual VoiceOver pass (Safari is unsupported by the app, so Chrome plus VoiceOver) on: year change announcement, figure caption, table navigation. Adding `@axe-core/playwright` is a separate decision (O-9).
- **Docs:** README Wealth section and Guide paragraph; CONTRIBUTING tree and flag note; `docs/README.md` spec list.

### 7.5 Risks
| ID | Risk | Mitigation |
|---|---|---|
| R-1 | `DataContext` has no loaded flag, so the empty state could flash before balances load. | Add `isLoaded` (slice 2); fallback is to gate rendering on the budget load plus one `requestAnimationFrame`. |
| R-2 | Three existing definitions of net worth and spending (Growth, Budget, Home) already differ; a fourth could confuse. | Reuse Budget's spending definition, document differences in section 2, ship the parity test, and leave Growth unchanged. Follow-up (O-1) can align Growth. |
| R-3 | Print CSS depends on `:has()` and app layout classes that may change. | Print e2e test guards it; the selectors are listed in 5.5. |
| R-4 | Today's goal target applied to a past year can mislead. | Footnote copy; shown as progress against the current goal, not history. |
| R-5 | Strict incomplete-month rule may block users with sloppy data at year-end. | The note links straight to the spreadsheet; carry-forward is an open decision (O-3). |
| R-6 | `loadBudgetStore` reads every CSV of every year on each visit. | Same cost as the Growth tab today; only two years are parsed; optimize later if it shows. |
| R-7 | `.github/copilot-instructions.md` architecture notes (routing by page state, GitHub Sync, appStorage) predate the File System Access migration. | Follow `CONTRIBUTING.md` and the code cited here, not those notes. |

## 8. Cross-feature dependencies

This is one of five specs written at once. They were reconciled against each other on 2026-11-08; where a contract is still a proposal it is marked as such.

- **data-safety-net:** Annual Review is read-only and writes nothing, so it needs no protection and adds no files. The data-safety-net spec dispatches `data-changed` after Reload or Restore (its section 5G), the event `DataContext` already listens to, so an open review refreshes. Owner of any `DataContext` change that also touches reload semantics: data-safety-net; this spec only adds `isLoaded` (reconcile in O-5).
- **monthly-check-in:** The check-in defines when a month is "done". This spec defines coverage as "every expected account has an entry" (3.4) and refuses to compute change from an incomplete anchor. Recommendation: monthly-check-in owns the canonical completeness helper; Annual Review adopts it and deletes its own `buildMonthTotals` coverage logic. Until then this spec ships `src/pages/review/utils/netWorth.ts`. Overlapping file: none (both only read balances).
- **import-wizard:** Today blank-category rows are dropped by `parseCSV` (section 2), so imported uncategorized rows vanish from totals. The wizard stores them in two fallback categories, `Uncategorized` (expense, inside the `others` group) and `Uncategorized income` (income, inside `income-others`), so Annual Review counts them with no change, and the `uncategorizedShare` rule above matches the expense one by name. If the wizard changes those constants or the `parseCSV` behavior, import-wizard owns `csvParser.ts` and `constants.ts`, and this rule must be re-checked. Annual Review never parses CSV itself.
- **category-budget-targets:** Budget versus actual per group for the year is deferred (O-4). If targets ship first and expose a pure `getTargetsForYear(year)`, a later slice adds an optional "Target" column to the spending table and CSV; targets own that data model and file, this spec owns the table layout. No shared files in v1.
- **Shared touch points:** `src/pages/data/Data.tsx` (tab and route; owned here), `src/search/searchIndex.ts` (entry added here; other specs add their own, keep each entry in its own commit to avoid merge noise), `feature-flags.json` and `flagDefinitions.ts` (each spec adds its own flag key), `README.md` and Guide (each spec edits its own paragraph).

## 9. Open questions and decisions

| ID | Question | Recommended answer | Blocks implementation? |
|---|---|---|---|
| O-1 | When budget data and the Growth manual log disagree, which wins? | Budget wins when all expected months exist, and a visible note shows both; matches the intent of the UI, which blocks editing when budget data exists. Accept that Growth (override wins) can differ; optionally align Growth in a follow-up. | No |
| O-2 | Expense definition: Budget's signed net or Growth's per-category absolute value? | Budget's signed net (refunds reduce spend), because it is the number users see on Cashflow. Document the difference. | No |
| O-3 | Carry forward a missing account's last balance when an anchor month is incomplete? | No for v1 (strict, never invents a balance). Revisit if users hit the note often. | No |
| O-4 | Include budget-vs-actual per category now or defer? | Defer; depends on `category-budget-targets` and adds a second data source with its own gaps. | No |
| O-5 | Add `isLoaded` to `DataContext` (touches a shared file) or gate on the budget load? | Add `isLoaded`; it is 5 lines and removes a real flash. Needs agreement with data-safety-net before slice 2. | Slice 2 only |
| O-6 | Route form: `/net-worth/review/:year` or query string? | Path param, so the URL is clean and works with `NavLink`. | No |
| O-7 | Include gross income and tax rate from Growth? | No; user-entered, adds taxes to scope. | No |
| O-8 | Add a UTF-8 BOM to the CSV for Excel? | No, to match `csvExport.ts`; revisit only if a user reports garbled non-ASCII group names. | No |
| O-9 | Add `@axe-core/playwright`? | Yes in a separate chore PR; this feature does not depend on it. | No |
| O-10 | Show prior-year delta for net worth change only, or four numbers? | Four numbers (change, income, expenses, savings rate), one level deep. | No |
| O-11 | Paper size? | US Letter, because currency and formats are en-US only; users can change it in the print dialog. | No |
| O-12 | Should the Growth year cards link to the review for that year? | Yes, small follow-up after slice 5 (modifies `SavingsGrowthTracker.tsx`, no logic change). | No |
