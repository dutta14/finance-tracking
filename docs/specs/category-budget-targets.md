# Category Budget Targets

- **Status:** Proposed
- **Owner:** Anindya
- **Last updated:** 2026-11-08
- **Priority:** 4 of 5 in the next-features list
- **Effort:** M

## 1. Summary and goal

**Problem.** The Budget page (nav label "Cashflow") shows what was spent per category group, but it never says what the user intended to spend. The README pitches it as "a year-based budgeting workspace", yet nothing in the data model or UI can express a limit, so "am I over or under on Dining?" means doing the subtraction by eye against a number held in the user's head. The author uses the page daily and does this by hand.

**Goal.** Let the user set a monthly target per expense group and see it against actuals in the Budget aggregated view and on Home, with every over/under signal readable without color.

**Success metrics (no telemetry; all verifiable by test or by hand).**
1. With a $500 Dining target and $620 net Dining spend in a completed month, the Dining row's "Vs target" cell reads exactly "$120 over" (unit test on the pure function plus component test plus e2e).
2. With the flag off, the DOM of the Budget and Home pages is byte-identical to today (existing tests pass unmodified; no read of `budget/targets.json` happens).
3. Groups with no target render no target indicator anywhere (component test asserts absence of the indicator elements, not just of text).
4. The target editor is operable with the keyboard alone and announces results (Playwright keyboard test plus RTL role/name assertions).
5. No new network request is made by the feature (Playwright test asserts that, with the flag on and targets edited, no request leaves the app origin other than the existing flag-config fetch; see 3.9).
6. Manual check: set a target, reload the page, close and reopen the browser, point a second tab at the same folder; the target persists and shows in both tabs. Open `budget/targets.json` in a text editor and read it.

## 2. Current behavior (verified)

Every item below was read in the code on 2026-11-08.

- **No target concept exists.** `src/pages/budget/types.ts` defines `CategoryGroup { id, name, categories: string[], type?: 'expense' | 'income' }`, `BudgetConfigData { version, years, categoryGroups }` and `BudgetStore`. There is no limit, target or goal field anywhere in `src/pages/budget/`.
- **Marketing vs reality.** `README.md` (Budget section, "A year-based budgeting workspace") and the in-app Guide (`src/pages/guide/sections/FeaturesByPage.tsx`, "A year-based cash flow workspace") describe analysis only. The page heading is "Cashflow" (`BudgetHeader.tsx`, `<h1 className="budget-title">`). `docs/specs/budget.md` is stale: it says "Budget" title, "Groups" button and an "Aggregated / Detailed / Cashflow" toggle; the code uses routes `/budget/cashflow`, `/budget/spreadsheet`, `/budget/groups` (`Budget.tsx`: `viewMode` is derived from `location.pathname`) and `CashflowTabs`.
- **Persistence.** Groups live in `budget/categories.json` as `{ version: 1, years, categoryGroups }`. Written by `saveBudgetStore` and `saveBudgetConfig` in `src/pages/budget/utils/budgetStorage.ts`; read by `loadBudgetConfig`/`loadBudgetStore`. `useBudget.ts` re-reads on `fileStore.subscribe('budget/categories.json', ...)`. Layout is documented in the CONTRIBUTING.md file-layout table.
- **The group model drops unknown fields.** `budgetStorage.ts` `cloneGroup()` copies only `id`, `name`, `categories` and `type`; `normalizeGroups`, `getExpenseGroups`, `getIncomeGroups` and `mergeGroupCollections` all go through it. A new field added to `CategoryGroup` would be silently erased on the next save unless `cloneGroup` changes. This drives decision D1.
- **Income vs expense.** `CategoryGroup.type === 'income'` (or id `income-others`) marks income groups (`getIncomeGroups`); all other groups are expense groups (`getExpenseGroups`). Reserved ids: `others`, `removed` ("Remove from Budget"), `income-others`. Categories in `removed` are excluded from `categorySums` in `useBudget.ts` (`allRemovedCategories`).
- **Group ids are stable.** `CategoryGroupManager.addGroup` creates `expense-group-<Date.now()>`; `renameGroup` is `{ ...g, name }` (id kept). `removeGroup` moves the group's categories into `others` and drops the group. There is no group merge; `mergeCategories` in `useBudget.ts` merges categories (rewrites CSV text and group membership), never groups. `others` and `removed` cannot be renamed or deleted (`isProtectedGroup`). New categories discovered on import or edit land in `others` (`uploadCSV`, `editCategory`, `addCategoriesToGroup`).
- **Aggregated view.** `src/pages/budget/components/BudgetAggregatedView.tsx` renders one table for the selected year: columns are `Group`, the period columns, and one `Total`/`%` column. Period columns come from `timePeriod` (`'month' | 'quarter' | 'half'`, the M/Q/H toggle in `BudgetHeader.tsx`): 12 months, Q1-Q4, or H1-H2. There is no "current month" selector, so "view period" means a column. Amounts are `Math.abs()`'d and formatted by a local `fmt` (en-US, USD, 0 fraction digits). A group row is hidden when it has no category with a negative month (`isTypeCategory`: expense iff the category has any negative month in the year; positives are refunds). A net-positive expense cell gets class `refund` (green via `--color-positive`, no text). Rows sort by absolute year total. `Grand Total` row sums displayed groups. Income tab uses `incomeCategoryGroups` and the same table.
- **Data inputs.** `useBudget()` exposes `categorySums: Record<category, Record<'yyyy-mm', signedNumber>>` (removed categories excluded; expenses negative), `monthsWithData: Set<'yyyy-mm'>` (months that have a CSV in the selected year), `categoryGroups` (expense, via `getGlobalCategoryGroups`), `incomeCategoryGroups`, `summary`.
- **Home.** `src/pages/home/SpendingPeek.tsx` loads the store once with `loadBudgetStore` (no subscription), sorts month keys descending and treats the newest month with data as "last month" (labelled "this month" when it is the current calendar month, `isCurrentMonthIncomplete`). `buildMonthSummary` sums `Math.abs(amount)` for every non-income, non-removed transaction, so a refund currently ADDS to Home spend, whereas the Budget table nets it. Home renders it via `Home.tsx` with props `fileStore`, `hasBudgetData`, `budgetDataLoaded`, `onNavigate` (navigates to `/budget`, which redirects to `/budget/cashflow`). The existing `SpendingPeek.test.tsx` mocks `../budget/utils/budgetStorage` (only `loadBudgetStore`, `getIncomeGroups`) and `../budget/utils/csvParser` (only `parseCSV`), and passes `{} as FileStore`.
- **FileStore.** `src/utils/fileStoreTypes.ts`: `readJSON(path, fallback)`, `writeJSON`, `exists`, `subscribe(path, cb)`. `FileSystemFileStore.readJSON` returns the fallback when JSON.parse fails, so a corrupt file is indistinguishable from a missing one unless `exists()` is also checked. Writes are debounced 300 ms and announced to other tabs on a BroadcastChannel. `FileStoreContext` defaults to a `MemoryFileStore`, so hooks work in tests without a provider.
- **Flags.** `src/flags/flagDefinitions.ts` holds one flag (`MODERN_DESIGN = defineFlag('modern-design', ...)`); `useFlag(FLAGS.X)` takes a definition object (CONTRIBUTING.md and copilot-instructions say `useFlag('name')`, which is doc drift). Resolution is override (`flag-overrides` in localStorage), then rollout percentage from `feature-flags.json`, then default. Without a provider, `useFlag` returns the default.
- **Existing a11y gaps nearby (not fixed by this spec, not to be copied).** (a) The `Total`/`%` `<th>` in `BudgetAggregatedView` toggles on click with no role, tabindex or key handler. (b) The `refund` state is conveyed by color only. (c) `.budget-group-input` uses `--color-border` (1.47:1 on `--color-surface`, below the 3:1 non-text minimum). (d) `--color-negative` on `--color-negative-light` is 4.41:1 in light mode, so do not put negative text on that fill.
- **Siblings.** The specs `import-wizard.md`, `annual-review.md`, `monthly-check-in.md` and `data-safety-net.md` were written alongside this one and are reconciled with it in section 8.

## 3. Architecture

### 3.1 Decisions in one table

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Where is the target stored? | NEW file `budget/targets.json`, keyed by group id | `cloneGroup` strips unknown fields (2), so a field on `CategoryGroup` would be lost by any save from older code, and `categories.json` is rewritten wholesale on every transaction edit. A separate file survives app rollbacks, keeps the group model untouched and keeps `useBudget`/Transactions/Drive/search readers unchanged. |
| D2 | Time model | Per-group history of `{ from, monthly }` entries; v1 UI writes at most one new entry per change. First-ever target has `from: null` ("always"); later changes start at the current calendar month | Changing Dining from 500 to 600 in November must not turn March from "over" into "under". Per-month overrides can be added later as an extra key without a migration. |
| D3 | Zero | `0` is a valid target ("spend nothing here"). Blank clears the target | A cleared target and a zero target mean different things. Silent coercion of 0 to "no target" would hide a deliberate choice. |
| D4 | Scaling | Period target = sum of the monthly target in effect for each month in the period that has data. No x3/x6/x12 constants | Handles history, missing months and partial years with one rule; gives x3/x6/x12 for full periods automatically. |
| D5 | In-progress month | Compare actual with the full target; show "left" instead of "under"; no pace marker in v1 | Rent and annual bills land on day 1; a linear pace line would be wrong for most groups and adds a second visual state to make accessible. |
| D6 | Edit surface | Aggregated view only, in a "Monthly target" column | That is where the user sees the effect. CategoryGroupManager keeps one job (structure). Two editors double the test and a11y surface for M effort. |
| D7 | Home | One quiet line in SpendingPeek; absent when no targets apply | Home is a peek. A per-group list competes with the chart and needs a truncation story. |
| D8 | Rollout | Flag `category-budget-targets`, default off | Matches `src/flags/`. Off means no reads and no UI. |

### 3.2 File format (NEW): `budget/targets.json`

```json
{
  "version": 1,
  "groups": {
    "expense-group-1731100000000": {
      "label": "Dining",
      "history": [
        { "from": null, "monthly": 500 },
        { "from": "2026-11", "monthly": 600 }
      ]
    },
    "others": {
      "label": "Others",
      "history": [{ "from": null, "monthly": 0 }]
    },
    "expense-group-1731100000099": {
      "label": "Travel",
      "history": [
        { "from": null, "monthly": 300 },
        { "from": "2026-09", "monthly": null }
      ]
    }
  }
}
```

Rules:
- Keys are `CategoryGroup.id`. `label` is a human-readable snapshot of the name at last write; it is never used for matching (ids like `expense-group-1731100000000` are not readable, `label` keeps the file legible and recoverable).
- `from` is `"YYYY-MM"` or `null` (null = applies to every earlier month too). At most one `null` entry, and it must be first. Entries are sorted ascending by `from`, unique per `from`.
- `monthly` is a finite number >= 0 with at most 2 decimals, or `null` meaning "no target from this month on".
- Expense groups only. Ids of income groups, `removed` and `income-others` are never written; unknown or orphaned ids are ignored on read and pruned on the next write (3.6).
- Reserved for later, not built: `"overrides": { "2026-12": 900 }` per group for single-month changes. Absent key means none, so adding it needs no migration.
- Back-compat: a data folder without the file behaves as "no targets". Nothing in `categories.json` or the CSVs changes. App versions that predate the feature ignore the file. If the file is unreadable or `version > 1`, the UI goes read-only (3.7).

### 3.3 Pure calculation module (NEW): `src/pages/budget/utils/budgetTargets.ts`

No React, no I/O, deterministic via an injected `nowMonthKey`. This is the unit-test surface and the contract other specs consume.

Semantics (normative):
- `spendCents(month)` = `-round(sum(signed amounts of the group's categories) * 100)`; positive means spent, negative means net refund. Cents are integers to avoid float drift.
- A month counts for a period when it has data (`monthsWithData`) AND has an effective target (non-null). Both target and spend are summed over the same counted months only. A month with no CSV is "unknown", not "zero spend".
- `targetDollars` and `spendDollars` are rounded to whole dollars (half away from zero) before comparing, so the number the user reads always agrees with the verdict; `delta = spendDollars - targetDollars`.
- `status`: `delta > 0` over, `delta < 0` under, `delta === 0` on-target. `inProgress` is true when the counted months include `nowMonthKey`.
- Result is `null` when no month counts (no target, or no data): the UI renders nothing.

### 3.4 Data flow

```
budget/targets.json --loadBudgetTargets--> useBudgetTargets (NEW hook)
                                              |  targets, status, setTarget(groupId, label, value)
categorySums, monthsWithData, categoryGroups  |
(from useBudget, unchanged)                   v
Budget.tsx --props--> BudgetAggregatedView --> evaluatePeriod() per row/period/year
                                          \--> BudgetTargetCell (editor) --setTarget--> saveBudgetTargets --> writeJSON

Home: SpendingPeek --(flag on)--> loadBudgetTargets + store csvs of anchor month
      --> sumByCategory() --> summarizeTargets() --> one line
```

Edit sequence: user activates the target button, types, presses Enter; `parseTargetInput` validates; `setGroupTarget` returns a new file object (never mutates the cached object from `readJSON`); the hook updates state first, then `writeJSON`; on rejection the hook restores the previous state and the cell shows the save error (4.5). Other tabs refresh through `fileStore.subscribe('budget/targets.json', ...)`.

### 3.5 Reuse vs create

Reuse: `FileStore`/`useFileStore`, `useFlag`, `categorySums`/`monthsWithData`/`categoryGroups` from `useBudget`, `buildMonthKey` and `parseCSV` from `csvParser.ts`, `.sr-only` from `utilities.css`, `.budget-table*` classes, `home-card-link`, color/type/radius tokens from `colorThemes.css`.
Create: `budgetTargets.ts` (pure), `budgetTargetsStorage.ts` (I/O), `useBudgetTargets.ts`, `BudgetTargetCell.tsx`, `BudgetTargetStatus.tsx`, `BudgetTargets.css`. Do NOT change `CategoryGroup`, `BudgetStore`, `cloneGroup`, `loadBudgetStore` or `useBudget` (keeps blast radius off Drive, Transactions, FI tools and the sibling specs).

### 3.6 Group lifecycle

| Event in CategoryGroupManager | Effect on target |
|---|---|
| Rename | Kept (id unchanged). `label` refreshed on the next write. |
| Delete group | Dropped. Its categories move to `others`; the target is not transferred, because that would distort Others. The orphan is ignored on read and removed on the next write. |
| Merge categories (`mergeCategories`) | No effect; merge is category-level. Spend moves with the categories. |
| Drag category to another group | Targets stay with the group; actuals shift. |
| Empty a group by dragging all categories out | Target kept; the row stays visible (3.7 visibility rule) so it can be cleared. |
| Delete then re-create a group with the same name | New id, no target. |
| Group moved between sections | Not possible in the UI today; if it becomes an income group its target is ignored and pruned. |

Pruning only runs after the budget store has loaded (`loaded` in `useBudget`) so an empty first render cannot wipe targets.

### 3.7 Integration points

- `Budget.tsx` (MODIFIED): `const targetsOn = useFlag(FLAGS.CATEGORY_BUDGET_TARGETS)`; `useBudgetTargets({ enabled: targetsOn, groups: categoryGroups, groupsLoaded })`; pass `targets`, `monthsWithData`, `onSetTarget`, `nowMonthKey` to `BudgetAggregatedView` only when `aggTab === 'expense'`. The existing `Budget.test.tsx` mocks `useBudget` and `BudgetAggregatedView`, so it keeps passing; the new hook falls back to the context's `MemoryFileStore`.
- `BudgetAggregatedView.tsx` (MODIFIED): new optional prop `targetsConfig?: {...}`. When absent (flag off, income tab) the render path is unchanged. Row visibility rule when present: show an expense group if it has any spend-bearing category (today's rule) OR it has any target in its history, so a group that emptied out stays editable.
- `SpendingPeek.tsx` (MODIFIED): when the flag is on, separately load targets inside a try/catch (the existing tests pass `{}` as the store) and compute the line from the anchor month's CSV. It filters expense groups itself (`type !== 'income' && id !== 'removed'`) instead of importing `getExpenseGroups`, so the existing module mock keeps working.
- `Home.tsx` (MODIFIED, one prop): `onOpenTargets={() => navigate('/budget/spreadsheet')}`.
- Known divergence (documented, not fixed here): Home's chart counts refunds as spend (`Math.abs`); the target line follows Budget semantics (refunds net). Also the Budget view classifies a category as expense by sign over the year, while the Home helper uses group membership. They differ only for a category that is positive all year and sits in an expense group. See section 9, Q9.

### 3.8 Performance

All evaluation is O(groups x months) on already-computed sums; no new parsing on Budget. Home parses one month CSV it already parses. Memoize evaluation per render with `useMemo` keyed on `categorySums`, `targets`, `timePeriod`.

### 3.9 Privacy and promises

Target amounts are user data. They are written only through `FileStore.writeJSON` to the user's folder. No telemetry, no new fetch, no `localStorage` copy of amounts (CONTRIBUTING says financial data never goes to localStorage). The only network call near this feature is the existing flag-config fetch in `FlagContext`, which carries no user data.

## 4. Product requirements

### 4.1 User stories

1. As a budgeter, I want a monthly target per expense group, so that I can see whether I am over or under.
2. As a returning user, I want my targets to persist in my data folder, so that nothing depends on a server or this browser.
3. As someone who changes a target mid-year, I want past months judged against the target that applied then, so that my history stays honest.
4. As a keyboard or screen-reader user, I want to set, change and clear a target and hear the result, so that I am not blocked by a mouse-only control.
5. As someone glancing at Home, I want one calm line that tells me whether any group is over, and nothing at all if I never set targets.

### 4.2 Acceptance criteria

Setting and storing
- **AC-1** With the flag on, the Expenses tab of Aggregated view shows two extra columns after Total: "Monthly target" and "Vs target". The Income tab, the Detailed view and the Cashflow view are unchanged.
- **AC-2** A group row with no target shows a "Set target" button in Monthly target and an empty Vs target cell, with no icon, no text and no color treatment anywhere in the row.
- **AC-3** Entering `500` in Dining's editor and pressing Enter stores `monthly: 500` with `from: null` when the group has no history, writes `budget/targets.json`, shows "$500" in the button and announces "Dining target set to $500 a month."
- **AC-4** Accepted input: digits with optional leading `$`, thousands commas, and up to two decimals (`$1,250.50`). Blank after trimming means clear (AC-6). Rejected: negatives, letters, exponent notation, more than two decimal places, and values above 9,999,999.99. A rejected value keeps the editor open, sets `aria-invalid="true"` and shows "Enter an amount from 0 to 9,999,999."
- **AC-5** `0` is accepted and stored as `monthly: 0`. The cell shows "$0", status rules in AC-12 apply.
- **AC-6** Clearing the field (blank) and pressing Enter removes the target: if the group has only a `from: null` entry its record is deleted; otherwise a `{ from: <current month>, monthly: null }` entry is appended. Announcement: "Dining target cleared."
- **AC-7** Changing an existing target adds an entry starting at the current calendar month. A second change within the same month replaces that month's entry. Consecutive entries with equal values are merged. Entries before the current month are never modified by the UI.
- **AC-8** Escape cancels, restores the previous value and announces nothing; focus returns to the button.
- **AC-9** Targets can be set on any expense group including `others`. No target control appears for income groups or for `removed`.
- **AC-10** Rename keeps the target; deleting the group removes it from the table and (on next write) from the file; merging categories keeps it; see 3.6.

Comparison
- **AC-11** Actual = net spend: refunds reduce spend; a net refund gives negative spend. Income groups are never compared.
- **AC-12** For any period, with `delta = round(spend) - round(target)` in whole dollars: delta > 0 renders "$N over"; delta < 0 renders "$N under" for completed periods and "$N left" when the period includes the current calendar month; delta = 0 renders "On target". `N` is `abs(delta)` formatted as whole dollars with thousands separators.
- **AC-13** Each status renders an icon plus the text plus a color: over = up-triangle + negative color, under/left = down-triangle + muted color, on target = check + positive color. Text is never omitted in the Vs target column. Color is never the only cue (WCAG 1.4.1).
- **AC-14** Period cells (month, quarter, half) in an over state also show a second line "$N over" with the up-triangle under the amount, using the period's own target (sum of monthly targets in effect for that period's months with data). Under, on-target and no-target period cells show nothing extra.
- **AC-15** The Vs target column always compares the whole selected year across months with data, independent of the M/Q/H toggle, and does not change when the Total/% toggle flips.
- **AC-16** A month without a CSV is excluded from both target and spend. When fewer than 12 months count in the Vs target cell, a caption "N of 12 months" appears under the verdict. A period with no counted month renders nothing.
- **AC-17** A past period is judged against the monthly target that applied in each of its months (history from `history[]`). The Monthly target column shows the target in effect for the current calendar month, and a note under the table says so.
- **AC-18** Uncategorized spend: new categories land in `others` today, so `others` spend is compared with the `others` target if one exists. No group other than a real group in `categories.json` can carry a target.
- **AC-19** The Grand Total row leaves Monthly target and Vs target empty.
- **AC-20** Rounding: 500.40 against 500 reads "On target"; 500.60 reads "$1 over"; sums are computed in integer cents.

Home
- **AC-21** With the flag on and at least one expense group with a target in effect for the anchor month, SpendingPeek shows exactly one line under its controls (copy in section 6); otherwise it renders nothing extra and its DOM is unchanged.
- **AC-22** The anchor month is the same month the chart calls "last month"/"this month" (newest month with data). The line is prefixed with the month name and "so far" when that month is the current calendar month.
- **AC-23** The line includes an icon and is followed by a "See targets" link-style button that calls `onOpenTargets`.

Safety and states
- **AC-24** With the flag off: no read or write of `budget/targets.json`, no new DOM, no new CSS effects.
- **AC-25** If `budget/targets.json` exists but cannot be parsed or has `version > 1`, targets are not applied, editing is disabled, a `role="alert"` message explains it, and the file is never overwritten.
- **AC-26** If a write fails, the UI reverts to the previous value and shows the save error inside the cell's live region.
- **AC-27** Changes made in another tab appear without reload (subscription).
- **AC-28** Keyboard and screen-reader behavior per 4.5 and 5.7; axe-style checks and the contrast e2e pattern (section 7.4) pass in light and dark mode.

### 4.3 Scope

**IN:** monthly target per expense group; effective-from history; Aggregated view columns and period markers; Home line; flag; docs; file format; pure API for sibling specs.

**OUT, and why:**
- Rollovers and envelope budgeting: change the meaning of "target" into a ledger and need carried state; the PM scoped them out.
- Alerts, notifications, banners, nudges on other pages: no backend, and a calm tone matters; the Home line is passive.
- Per-month overrides: designed (3.2) but deferred; history covers the common case.
- Targets on categories, income groups, Detailed view and Cashflow charts: groups are the unit the user asked for; Detailed view can reuse the pure API later.
- Editing in CategoryGroupManager: one editor is enough for v1 (D6).
- Backfilling or auto-suggesting targets from past spend: tempting and useful, but it is a separate decision about defaults.
- Fixing the three pre-existing a11y gaps in section 2: separate PR; file a follow-up.
- Pace marker for in-progress months (D5).
- Multiple currencies: the app hard-codes USD/en-US everywhere (`fmt` in `BudgetAggregatedView.tsx`, `formatCurrency` in `src/pages/data/types.ts`); this feature follows suit.

### 4.4 States

| State | Behavior |
|---|---|
| First-time, flag on, zero targets anywhere | Intro line above the Expenses table (section 6). "Set target" in every row. |
| First-time, no budget data for the year | Existing empty year state; the feature adds nothing. |
| Loading | New columns are not rendered until targets have loaded, so the table does not shift; Home shows no target line until loaded. |
| Returning, some targets | Populated cells, caption note under the table. |
| Group with target but no spend this year | Row stays visible with spend empty and verdict "$N under" (or "$N left"). |
| Error: unreadable file | Alert above the table (section 6); editors disabled; no targets are applied, so every button reads "Set target" and is `aria-disabled`. |
| Error: write failed | Inline error in the cell, previous value restored. |
| Future year | Existing empty state; no counted months, so nothing renders. |

### 4.5 Keyboard and screen reader behavior

- The cell contains a real `<button>`: name "Set monthly target for Dining" or "Dining monthly target $500, edit". Enter/Space opens the editor.
- The editor is a text `<input inputmode="decimal">` with a programmatic label "Monthly target for Dining" and `aria-describedby` pointing at the format hint and (when invalid) the error. It receives focus with its content selected.
- Enter saves and returns focus to the button. Escape cancels and returns focus. Tab or blur saves if valid; if invalid it keeps the editor open with the error and does not trap focus (the user can Shift+Tab or Tab away; the invalid editor stays until fixed or cancelled).
- One polite live region (`role="status"`, `.sr-only`) per table announces set, clear and save failures. Verdicts are read as table-cell text, so "$120 over" is read in place; the icon is `aria-hidden`.
- The editor adds no new tab stops beyond one input and the button per row.

### 4.6 Edge cases

- Group name very long: the name cell already truncates with ellipsis at 150 px (`.budget-td--category`); the new aria-labels carry the full name and the name cell gets `title`.
- Target in a month with no data and a later change: handled by counting rules (3.3).
- Entering the same value as today: no write, no announcement beyond "Dining target is already $500 a month."
- Whitespace, full-width digits, pasted "USD 500": rejected with the standard error; do not guess.
- Two tabs edit the same group at once: last write wins; the subscription refreshes the other tab.
- Target for a group whose spend is entirely net refund: handled (AC-11), see example 8.
- Year navigation with no change to targets: values are recomputed, not refetched.
- `monthsWithData` contains only the selected year's months (it is derived from `selectedYear` in `useBudget`); periods are only evaluated within the year, which matches the table.
- Daylight/timezone: `nowMonthKey` comes from local `new Date()`, same as `SpendingPeek`.

### 4.7 Worked examples

Assume today is 2026-11-18, USD, whole-dollar display. "Cell" is what the Vs target column (or the period cell's second line, as noted) renders after the icon.

| # | Situation | Target | Net spend | Where it renders | Rendered text |
|---|---|---|---|---|---|
| 1 | Under, completed year | $500/mo | $5,880 (12 months of data, 2025) | Vs target | "$120 under" |
| 2 | Over (PM example) | $500/mo | $620 in Jun 2026 | Jun period cell, second line | "$120 over" |
| 3 | Exactly on target | $500/mo | $6,000 (12 months, 2025) | Vs target | "On target" |
| 4 | No target | none | $400 | Monthly target / Vs target / period cells | "Set target" / empty / nothing extra |
| 5a | Zero target, nothing spent | $0 | $0 (12 months, 2025) | Vs target | "On target" |
| 5b | Zero target, small spend | $0 | $25 (12 months, 2025) | Vs target | "$25 over" |
| 6 | Quarterly view | $500/mo, so $1,500 for Q1 | $1,710 in Q1 2026 | Q1 period cell, second line | "$210 over" |
| 7a | In-progress month, under | $500/mo | $300; only Nov 2026 has data (today is 2026-11-18) | Vs target, caption below | "$200 left", caption "1 of 12 months" |
| 7b | In-progress month, over | $500/mo | $520; same data | Vs target | "$20 over" |
| 8 | Refund makes net spend negative | $500/mo | -$40 net credit; only Mar 2025 has data | Vs target (Total cell still shows "$40" as today) | "$540 under", caption "1 of 12 months" |
| 9 | Partial year | $500/mo | $2,300 across the 4 months that have data (2025) | Vs target | "$300 over", caption "4 of 12 months" |
| 10a | Rounding down | $500/mo | $500.40, one completed month | Vs target | "On target" |
| 10b | Rounding up | $500/mo | $500.60, one completed month | Vs target | "$1 over" |
| 11 | Target changed in Nov | $500 through Oct, $600 from 2026-11 | $1,000 across Oct and Nov 2026 (only these have data) | Vs target; Q4 cell shows nothing extra | Target = $1,100, "$100 left", caption "2 of 12 months" |
| 12 | Half-year view | $500/mo, so $3,000 for H1 | $3,400 in H1 2026 | H1 period cell, second line | "$400 over" |

Under, on-target and in-progress states never print in period cells (AC-14); they appear only in the Vs target column.

## 5. Design spec

Class prefix: `budget-target-` for table pieces, `spending-peek-targets` for Home. New stylesheet `src/styles/BudgetTargets.css` imported by the components (one CSS file per component/page, per CONTRIBUTING). Add `body.modern-design` variants only if the existing `budget-td`/`budget-th` modern rules (`modern-design.css` ~lines 338-412) need matching padding; otherwise inherit.

### 5.1 Component hierarchy

```
BudgetAggregatedView (Expenses, flag on)
 section.budget-table-section
  h3.budget-table-title "Expenses"
  p.budget-target-intro            (only when zero targets exist)
  div.budget-table-wrapper
   table.budget-table
    thead tr: th Group | th period... | th Total | th.budget-th--target[scope=col] "Monthly target" | th.budget-th--vs[scope=col] "Vs target"
    tbody tr.budget-tr--agg-row
      td.budget-td--category <strong>name</strong>   (title = full name)
      td.budget-td--number  amount
                            span.budget-target-delta (only if over)   <- BudgetTargetStatus variant="period"
      td Total
      td.budget-td--target  <BudgetTargetCell/>
      td.budget-td--vs      <BudgetTargetStatus variant="full"/>
    tr.budget-tr--grand-total: two empty cells
  p.budget-target-note             ("Past months...")
  div.sr-only[role=status][aria-live=polite]
  div.budget-target-alert[role=alert]   (unreadable file only)
```

`BudgetTargetStatus` renders `<span class="budget-target-status budget-target-status--over|under|on"><svg aria-hidden/> <span>$120 over</span></span>` plus optional `<span class="budget-target-caption">4 of 12 months</span>`.

### 5.2 Visual spec

| Element | Spec |
|---|---|
| Header cells | `.budget-th` look; `--target` width 104px, `--vs` width 140px; left border like `.budget-th--total` (2px `--color-border`) on the first new column only. |
| Target button | transparent background, `--fs-sm`, `--fw-medium`, `--color-text-heading`, min-height 32px (44px at <= 640px), padding 0.25rem 0.5rem, radius `--radius-sm`, dotted underline to signal editability. "Set target" uses `--accent` text (5.17:1 light, 4.53:1 dark on surface). |
| Editor input | width 100%, `--fs-sm`, `--radius-sm`, 1px border `--color-text-muted` (4.83:1 light, 6.57:1 dark, meets 3:1), background `--color-surface`, text `--color-text`, tabular-nums, right aligned. |
| Error text | `--fs-xs`, `--color-negative` on `--color-surface` (4.83:1 light, 6.03:1 dark), prefixed by an icon; never on `--color-negative-light` (4.41:1). |
| Verdict text | `--fs-sm`, `--fw-semibold`, tabular-nums. over: `--color-negative`; under/left: `--color-text-muted`; on target: `--color-positive` (5.48:1 light, 8.67:1 dark). All on `--color-surface`. |
| Icons | 12px inline SVG, `currentColor`, `aria-hidden`: up-triangle (over), down-triangle (under/left), check (on target). Shape differs per state. |
| Caption | `--fs-xs`, `--color-text-muted` (4.52:1 on `--color-surface-alt` if a row hover uses it, 4.83:1 on surface), margin-top 2px. |
| Period delta line | `--fs-xs`, `--fw-semibold`, `--color-negative`, right aligned under the amount, 2px gap. |
| Intro and note text | `--fs-sm`, `--color-text-secondary`, max-width 60ch, 0.75rem top margin; table wrapper spacing unchanged. |
| Spacing rhythm | follows the table (`padding: 1.1rem 0.7rem` cells); no new colors, no shadows. |
| Home line | `.spending-peek-targets` flex row, gap 0.5rem, `--fs-sm`, between `.spending-peek-controls` and chart, margin-bottom 0.5rem; link uses `.home-card-link` styling. |

### 5.3 States

| State | Treatment |
|---|---|
| Default | As above. |
| Hover (button) | background `--color-surface-hover`. Verdicts have no hover. |
| Focus | `:focus-visible` 2px solid `--accent`, offset 2px (matches `.budget-table-link:focus-visible`); same on the input. Never `outline: none` without replacement. |
| Active | background `--color-surface-alt`. |
| Disabled (unreadable file) | `aria-disabled`, text `--color-text-muted`, cursor default; the alert explains why. |
| Loading | columns not rendered. |
| Empty | "Set target" and empty verdict. |
| Error | input `aria-invalid="true"`, border stays `--color-text-muted`, error text with icon below the input; save-failed error uses the same pattern. |

### 5.4 Responsive

The repo's Budget breakpoints are 900px and 640px (`Budget.css`); the table lives in `.budget-table-wrapper { overflow-x: auto }`, with a sticky first column.
- >= 992px: all columns visible in M view at typical widths; verdict text on one line.
- 768px: wrapper scrolls horizontally; the sticky Group column stays; the two new columns are last, so the user scrolls to them. Do not hide them.
- 480px: same; hit areas become 44px tall; the editor input uses `font-size: 16px` to prevent iOS-style zoom. Intro and note text wrap.
- Home line wraps under the icon on <= 480px; the link goes on its own row.
- No hover-only information anywhere; the full status is always visible text.

### 5.5 Dark mode

Tokens swap via `body.dark` (`colorThemes.css`). Verified ratios above hold in dark mode. Triangles and check use `currentColor` so they follow. No opacity-based dimming of text (it would break contrast).

### 5.6 Interaction and motion

Button to editor swap is instant (no animation). The verdict updates without animation. If a transition is ever added: 150ms ease-out on background only, disabled under `prefers-reduced-motion: reduce` (the repo already has such blocks in `Home.css`).

### 5.7 Accessibility notes (WCAG 2.1 AA)

- 1.4.1 Use of Color: every state has an icon shape and text.
- 1.4.3 Contrast: all text combinations listed in 5.2 are >= 4.5:1; 1.4.11: input border and icons >= 3:1 (muted 4.83:1 light, 6.57:1 dark).
- 1.3.1 and 4.1.2: header cells use `scope="col"`; editor has a label; the status text lives in the cell; icons are decorative.
- 2.1.1 Keyboard and 2.4.7 Focus Visible: Enter, Space, Escape, Tab all defined (4.5).
- 3.3.1 and 3.3.3 Error Identification/Suggestion: error text names the allowed range.
- 4.1.3 Status Messages: single polite live region; the unreadable-file notice is `role="alert"`.
- 2.5.5 target size (AAA, adopted by the repo's mobile CSS): 44px tall on <= 640px.
- 1.4.10 Reflow and 1.4.4 Resize: horizontal scroll is confined to the existing table wrapper; the Home line wraps.

## 6. Copy

Voice: plain, calm, no exclamation marks, no judgment ("over" is a fact, not a failure). Currency: USD, `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })` for display; the editor accepts cents. Pluralization: "1 month", "N months"; "1 of 3 groups". Negative amounts are never printed with a minus; direction is carried by the words over/under/left.

| Surface | String | Notes |
|---|---|---|
| Column header | Monthly target | `scope="col"` |
| Column header | Vs target | Visible text; no abbreviation expansion needed |
| Button, no target | Set target | Accessible name: "Set monthly target for {group}" |
| Button, with target | {$500} | Accessible name: "{group} monthly target {$500}, edit" |
| Input label (SR) | Monthly target for {group} | |
| Input hint (`aria-describedby`) | Enter a monthly amount. Leave blank to clear. | Visible only on focus of the input, `--fs-xs` |
| Validation error | Enter an amount from 0 to 9,999,999. | Single message for every invalid input |
| Save error | Couldn't save the target. Check that your data folder is still available. | Cell-level, polite |
| Status: over | {$N} over | e.g. "$120 over" |
| Status: under | {$N} under | completed periods |
| Status: in progress | {$N} left | period includes the current month |
| Status: exact | On target | |
| Caption | {n} of 12 months | shown when n < 12; "1 of 12 months" |
| Live: set | {group} target set to {$500} a month. | |
| Live: cleared | {group} target cleared. | |
| Live: unchanged | {group} target is already {$500} a month. | |
| Intro (zero targets) | Set a monthly target on any group to see how each month compares. | Disappears once any target exists |
| Note under table | Targets are monthly. Changing one applies from this month on; earlier months keep the target that applied then. | Always shown when columns are shown |
| Unreadable file | Your targets file couldn't be read, so targets are turned off to keep it safe. The file is budget/targets.json in your data folder. | `role="alert"`; no instruction to delete |
| Home line, over, 2+ groups | {Month}: over target in {n} of {m} groups | e.g. "October: over target in 2 of 5 groups" |
| Home line, all within, m >= 3 | {Month}: within target in all {m} groups | |
| Home line, all within, m = 2 | {Month}: within target in both groups | |
| Home line, m = 1 | {Month}: {Group} is over target / {Month}: {Group} is within target | Group name may truncate by CSS ellipsis, full text stays in DOM |
| Home line, current month | {Month} so far: ... | Same rules, "so far" after the month name |
| Home link | See targets | Followed by the existing link arrow glyph |
| Flag description | Monthly targets per expense group on the Budget aggregated view and Home. | in `flagDefinitions.ts` |

Month name is the full English month (`Intl.DateTimeFormat('en-US', { month: 'long' })`), no year.

## 7. Engineering plan

### 7.1 Files

| File | Status | Change |
|---|---|---|
| `src/pages/budget/utils/budgetTargets.ts` | NEW | Types and pure functions (7.2). |
| `src/pages/budget/utils/budgetTargets.test.ts` | NEW | Unit tests. |
| `src/pages/budget/utils/budgetTargetsStorage.ts` | NEW | `TARGETS_PATH = 'budget/targets.json'`, `loadBudgetTargets`, `saveBudgetTargets`. |
| `src/pages/budget/hooks/useBudgetTargets.ts` (+ test) | NEW | State, subscription, prune, `setTarget`. |
| `src/pages/budget/components/BudgetTargetCell.tsx` (+ test) | NEW | Button/editor. |
| `src/pages/budget/components/BudgetTargetStatus.tsx` (+ test) | NEW | Icon + text + caption. |
| `src/styles/BudgetTargets.css` | NEW | Styles with tokens only. |
| `src/pages/budget/components/BudgetAggregatedView.tsx` | MODIFIED | Optional `targetsConfig` prop, new columns, visibility rule. Add `title` to the name cell. |
| `src/pages/budget/components/BudgetAggregatedView.test.tsx` | MODIFIED | Add cases; existing cases untouched. |
| `src/pages/budget/Budget.tsx` | MODIFIED | Flag, hook, props. |
| `src/pages/home/SpendingPeek.tsx` (+ `.test.tsx`) | MODIFIED | Targets line, optional `onOpenTargets`. |
| `src/pages/home/Home.tsx` | MODIFIED | Pass `onOpenTargets`. |
| `src/styles/Home.css` | MODIFIED | `.spending-peek-targets`. |
| `src/flags/flagDefinitions.ts` | MODIFIED | `CATEGORY_BUDGET_TARGETS`. |
| `feature-flags.json` | MODIFIED | `"category-budget-targets": { "percentage": 0 }`, bump `updatedAt`. |
| `e2e/fixtures/budget.fixtures.ts` | MODIFIED | `SeedOptions.targets` and `SeedOptions.flags` (the init script does `localStorage.clear()`, so flag overrides must be set after it). |
| `e2e/pages/budget.page.ts` | MODIFIED | Locators for the new cells. |
| `e2e/budget-targets.spec.ts` | NEW | Scenarios (7.4). |
| `src/pages/settings/demoMode.ts` | MODIFIED | Seed `budget/targets.json` for demo mode (harmless when the flag is off). |
| `README.md`, `src/pages/guide/sections/FeaturesByPage.tsx`, `CONTRIBUTING.md`, `docs/specs/budget.md` | MODIFIED | Docs (7.5). |

### 7.2 Key types and signatures

```ts
export type MonthKey = string // 'YYYY-MM'
export interface TargetEntry { from: MonthKey | null; monthly: number | null }
export interface GroupTargetRecord { label?: string; history: TargetEntry[] }
export interface BudgetTargetsFile { version: 1; groups: Record<string, GroupTargetRecord> }

export type TargetStatus = 'over' | 'under' | 'on-target'
export interface TargetResult {
  status: TargetStatus
  inProgress: boolean
  deltaDollars: number        // abs value shown to the user
  targetDollars: number
  spendDollars: number
  monthsCounted: number
  monthsInPeriod: number
}

export type ParsedTarget =
  | { ok: true; value: number | null }          // null = clear
  | { ok: false; reason: 'invalid' | 'negative' | 'too-large' }

export function parseTargetInput(raw: string): ParsedTarget
export function normalizeTargetsFile(raw: unknown): BudgetTargetsFile | null  // null = unreadable
export function monthlyTargetFor(rec: GroupTargetRecord | undefined, month: MonthKey): number | null
export function setGroupTarget(
  file: BudgetTargetsFile, groupId: string, label: string, value: number | null, nowMonth: MonthKey,
): BudgetTargetsFile
export function pruneTargets(file: BudgetTargetsFile, validGroupIds: ReadonlySet<string>): BudgetTargetsFile
export function evaluatePeriod(args: {
  record: GroupTargetRecord | undefined
  monthKeys: readonly MonthKey[]
  monthsWithData: ReadonlySet<MonthKey>
  signedNetFor: (month: MonthKey) => number      // sum of signed amounts for the group; expenses negative
  nowMonth: MonthKey
}): TargetResult | null
export function formatTargetStatus(r: TargetResult): { text: string; icon: 'up' | 'down' | 'check' }
export function summarizeGroups(results: ReadonlyArray<TargetResult | null>): { evaluated: number; over: number }
export function sumByCategory(
  txs: ReadonlyArray<{ category: string; amount: number }>, excluded: ReadonlySet<string>,
): Record<string, number>
```

`evaluatePeriod` is the contract for the monthly-check-in and annual-review specs: pass 12 month keys for a year, 3 for a quarter, 1 for a month.

```ts
// src/pages/budget/hooks/useBudgetTargets.ts
export function useBudgetTargets(opts: { enabled: boolean; groups: CategoryGroup[]; groupsLoaded: boolean }): {
  status: 'off' | 'loading' | 'ready' | 'unreadable'
  targets: BudgetTargetsFile
  setTarget: (groupId: string, label: string, value: number | null) => Promise<{ ok: boolean }>
  message: string            // live-region text
}
```

### 7.3 Implementation order (PR-sized slices)

1. **Pure core and flag.** `budgetTargets.ts` plus tests at ~100%, `budgetTargetsStorage.ts` plus tests, flag definition and `feature-flags.json`. No UI. Mergeable alone; coverage gate (90% statements, `vite.config.js`) unaffected.
2. **Hook.** `useBudgetTargets` with subscription, prune after `groupsLoaded`, unreadable-file handling, rollback on write failure. Tests with `MemoryFileStore`.
3. **Aggregated view UI.** `BudgetTargetCell`, `BudgetTargetStatus`, CSS, modifications to `BudgetAggregatedView` and `Budget.tsx`. Component tests including keyboard flows. Flag still default off.
4. **Home line.** `SpendingPeek`, `Home`, CSS, tests.
5. **E2E, a11y checks, demo data.** Playwright spec, fixtures, demoMode seed.
6. **Docs.** README, Guide, CONTRIBUTING file-layout row, `docs/specs/budget.md`; regenerate Budget and Home screenshots only if the flag is promoted (CONTRIBUTING screenshot rules).
7. **Promote and remove flag.** After the author has used it daily with the override on and slices 1-6 are green: raise rollout to 100, then delete the flag and the off-branches in a later cleanup PR (per the repo's "clean up dead code immediately" preference).

### 7.4 Test plan

Unit (`budgetTargets.test.ts`): `parseTargetInput` table (valid: `500`, `$1,250.50`, `0`, ` 12 `; clear: ``, `   `; invalid: `-5`, `abc`, `1e3`, `5.005`, `10000000`); `normalizeTargetsFile` (missing, wrong shape, version 2, bad entries dropped, unsorted entries sorted, duplicate `from` last wins); `monthlyTargetFor` (null entry first, before/after change, cleared); `setGroupTarget` (first target `from: null`, change adds current month, same-month replace, equal-value merge, clear single entry deletes record, clear with history appends null, never mutates input); `pruneTargets`; `evaluatePeriod` for every row of 4.7 plus: months without data excluded, net refund, in-progress flag, history across a change, period with no counted months returns null, float sums (0.1 + 0.2); `formatTargetStatus` strings; `summarizeGroups`.

Hook (`useBudgetTargets.test.ts`, `MemoryFileStore`): flag off performs no reads; loads existing file; subscription refresh; prune waits for `groupsLoaded`; unreadable file (exists but invalid JSON, and version 2) keeps the file bytes unchanged after attempted `setTarget`; write rejection rolls back.

Component (RTL, wrapped with `FlagContext.Provider` where needed): cell open/save/cancel via keyboard; focus return; error state has `aria-invalid` and the error text; live region text; status component shows text plus an element with `aria-hidden` icon for all three statuses; `BudgetAggregatedView` rows for 4.7 cases, absence of indicators for no-target rows, Income tab and Grand Total empty cells, group with target but no spend still rendered, `title` on name cell. SpendingPeek: no extra DOM when flag off or no targets; line copy for m = 1, 2, 3+, in-progress month; link calls `onOpenTargets`; `{}` store does not throw.

E2E (`e2e/budget-targets.spec.ts`, pin the clock with `page.clock.setFixedTime` as `cross-page-profile-tools.spec.ts` does): (1) set $500 on Dining with $620 spend, see "$120 over", reload, still there; (2) keyboard-only set/clear with Tab, Enter, Escape; (3) quarterly toggle shows the scaled period delta; (4) change target in the current month and verify an older month keeps its old verdict; (5) delete the group in `/budget/groups` and verify the target disappears; (6) corrupt file shows the alert and edits are disabled; (7) Home shows the line with targets, nothing without; (8) offline-promise check: record requests and assert none carry target data (mirror the existing network assertions if present; otherwise assert only same-origin and flag-config requests); (9) dark-mode contrast check reusing the computed-contrast helper pattern from `e2e/budget.spec.ts` ("budget table renders with real text/background contrast in dark mode") on the over, under and on-target verdicts, and a check that each verdict element contains non-empty text and an SVG, never color alone.

Existing tests that need changes: none expected with the flag off. `SpendingPeek.test.tsx` gains cases; its module mocks stay as they are because the new code does not import from the mocked modules beyond the pure `budgetTargets.ts`. If any test enumerates `FLAGS`, update it (none found outside `src/flags/`).

### 7.5 Docs to update

- `README.md` Budget section: one bullet "Set a monthly target per group and compare it with what you spent" (only when promoted); same in `FeaturesByPage.tsx`; and the file-layout row `budget/targets.json | Monthly targets per expense group` in CONTRIBUTING.md.
- `docs/specs/budget.md`: add the feature, and fix the stale route/title statements noted in section 2 while there (tiny, in the same PR as slice 6).
- In-app Guide: new bullet in the Budget "How to use it" list.
- `docs/filesystem-storage-architecture.html` mentions `categories.json`; add the new file there.
- CONTRIBUTING's flag usage example (`useFlag('modern-design')`) is wrong for this codebase; correct it opportunistically.

### 7.6 Risks and mitigations

| Risk | Mitigation |
|---|---|
| Group model strips new fields | Avoided: separate file keyed by id (D1). |
| Corrupt file silently reads as empty then gets overwritten | `exists()` plus null read marks `unreadable`; no writes in that state (AC-25). |
| Orphaned group ids after deleting groups | Ignored on read, pruned on write, only after groups load. |
| Home and Budget disagree on refunds | Documented, covered by a test that fixes the Budget semantics; Home chart left alone (Q9). |
| Extra columns crowd the table | They are last, the wrapper scrolls, sticky first column stays. |
| Fixed-width cells with 12 monthly columns | Period delta uses `--fs-xs` and only appears when over. |
| Existing tests mock modules that new code would import | New code isolated in `budgetTargets.ts` and a try/catch in SpendingPeek. |
| `th` toggle and other pre-existing a11y gaps | Not touched; follow-up issue filed. |
| Flag fetch is the only network call near the feature | Pre-existing; carries no user data. |

## 8. Cross-feature dependencies

The sibling specs were written in parallel and reconciled against each other on 2026-11-08.

- **data-safety-net.** `budget/targets.json` must be inside whatever snapshot, backup or restore set it defines; prefer "whole data folder minus caches" so no per-feature list is needed. This spec only writes through `FileStore.writeJSON`, so any write hook it adds applies automatically. data-safety-net owns any change to `fileStore.ts`/`fileStoreTypes.ts`; this spec owns the unreadable-file behavior for its own file.
- **monthly-check-in.** Should consume `evaluatePeriod` and `summarizeGroups` from `budgetTargets.ts` for "this month vs target" and must not re-implement scaling. If it adds Home UI, it coordinates with this spec on `SpendingPeek.tsx`; this spec owns the targets line there, check-in owns any new card. Setting targets stays in the aggregated view.
- **import-wizard.** The wizard's fallback is two categories, `Uncategorized` (expense) and `Uncategorized income`, filed in the existing `others` and `income-others` groups, not in groups of their own. Unmapped spend therefore counts against the `others` target, exactly as new categories do today, and no change is needed here. The wizard must keep group ids stable and must not create a virtual group outside `categories.json`. `Uncategorized income` sits in an income group and never carries a target. The wizard owns `Budget.tsx` menu entries and CSV ingestion; this spec owns only the hook call and props it adds.
- **annual-review.** Read-only consumer of `evaluatePeriod` with 12 month keys (and per-group results for a year summary). History semantics (3.2) are what make last year's review honest after a target change. annual-review owns its page and any new routes; this spec owns the contract in 7.2. Until annual-review lands, nothing here depends on it.
- **File overlap.** `Budget.tsx` (import-wizard, this spec), `SpendingPeek.tsx`/`Home.tsx` (monthly-check-in, this spec), `flagDefinitions.ts` and `feature-flags.json` (every spec adds one flag; trivially mergeable), README/Guide/CONTRIBUTING (every spec adds lines; each owns its own bullet). `BudgetAggregatedView.tsx`, `budgetTargets*.ts`, `useBudgetTargets.ts` are owned here.

## 9. Open questions and decisions

Items marked BLOCKING need approval before slice 1.

| # | Question | Recommendation | Blocking |
|---|---|---|---|
| Q1 | Store in new `budget/targets.json` or add a field to `categories.json`? | New file (D1): `cloneGroup` strips unknown fields, rollback-safe, no change to shared readers. | BLOCKING |
| Q2 | Is 0 a valid target? | Yes; blank clears (D3). The PM draft treated 0 as no target; I recommend against because it erases a deliberate choice. | BLOCKING |
| Q3 | Effective-from history or one rewritable value? | History with `from: null` for the first target (D2). Cost is one small pure function. | BLOCKING |
| Q4 | Edit inline, in CategoryGroupManager, or both? | Aggregated view only (D6). Revisit if users cannot find it. | No |
| Q5 | Pace marker for the in-progress month? | No; use "left" wording (D5). | No |
| Q6 | Home: one line or per-group list? | One line (D7) with a link to the table. | No |
| Q7 | Can `others` carry a target? | Yes; it is a real group in the table and the destination for uncategorized spend. | No |
| Q8 | Whole-dollar comparison or cents? | Whole dollars, matching the table's display, with cents accepted in input and summed as integer cents. | No |
| Q9 | Fix Home chart so refunds net like Budget? | Leave for a separate issue; note the divergence in code comments and tests. Align the target line with Budget. | No |
| Q10 | Should the Vs target total only count months with data? | Yes (3.3); label with "n of 12 months" so it is never misleading. | No |
| Q11 | Show groups that have a target but no spend? | Yes, so a target can always be edited or cleared (4.4). Groups with neither spend nor target stay hidden as today, so a brand-new group cannot get a target until it has spend in the viewed year. | No |
| Q12 | Rollout path? | Flag default 0%, author uses it via `flag-overrides`, promote after slice 6, then delete flag. | No |
| Q13 | Sibling specs (import-wizard, annual-review, check-in, data-safety-net) | Section 8 was reconciled against them on 2026-11-08. Re-check it if any sibling changes its file or flag names. | No |
