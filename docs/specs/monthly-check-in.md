# Monthly Check-in

- **Status:** Proposed
- **Owner:** Anindya
- **Last updated:** 2026-11-08
- **Priority:** 2 of 5 in the next-features list
- **Effort:** M (about 5 PR-sized slices; no new storage in the data folder)

## 1. Summary and goal

**Problem.** Balances are entered by hand once a month, and nothing in the app says whether that ritual is finished. A blank cell is silently skipped on save, the Home net worth card sums a missing balance as 0, and Home never states how old the data is. A forgotten account therefore shows up as a fake net worth dip, on Home and in the charts, with no hint that the number is incomplete.

**Goal.** Make the monthly balance update take minutes, and show clearly when the latest month is incomplete or the data is out of date.

**Success metrics (no telemetry; all verifiable by tests or by hand):**

| # | Metric | How to verify |
|---|---|---|
| M1 | With 9 active accounts and 7 balances in the latest month, Home reads "2 accounts missing for October" and lists the 2 names | Unit test of `getCheckInState` plus component test; Playwright scenario E2E-1 |
| M2 | The same state shows "Partial month" on the Home Net Worth card and hides the change figures | Component test on `NetWorthSummary` |
| M3 | A check-in with no changes (copy-forward, save as is) takes 2 activations from Home: "Start check-in", then "Save" | Playwright E2E-2 counts keyboard actions |
| M4 | The month-state table in section 3.3 passes as a table-driven unit test, including the 35-day boundary | `monthStatus.test.ts` |
| M5 | No new network request and no new file in the data folder | Playwright network assertion (E2E-7); a diff of the data folder before and after a check-in shows only `balances/{year}.csv` changed |
| M6 | Whole flow works by keyboard and passes the a11y assertions in section 7.4 | Playwright keyboard test |

## 2. Current behavior (verified)

Every item below was read in the code on 2026-11-08.

**Data model** (`src/pages/data/types.ts`)
- `Account.status` is `'active' | 'inactive'` (`AccountStatus`). There is no opened/closed date and no `closedAt`. `AccountForm.tsx` (status select, about line 194) and `AccountRow.tsx` (badge) call it Active/Inactive. So "closed" means `inactive`, and "opened mid-history" can only be inferred from the first balance entry.
- `BalanceEntry { id, accountId, month: 'YYYY-MM', balance }`. There is no entry timestamp. `balances/{year}.csv` has the columns `month,accountId,balance` (`src/utils/balanceStorage.ts`, `HEADER`). The `FileStore` interface (`src/utils/fileStoreTypes.ts`) exposes no modified time, so "days since the last entry" cannot be measured. This spec measures days since the end of the latest recorded month instead.
- `loadBalances` accepts any finite number for `accountId` and `balance` and does not validate the month string, so malformed month keys can reach the UI.

**Entry surfaces** (two different ones exist)
- Spreadsheet inline row: state `inlineEntry` is local to `Data.tsx` (line 31). `handleSaveInlineEntry` (lines 137-154) skips blank values (`if (!raw || raw.trim() === '') continue`, line 143) and never deletes. `handleConfirmAddEntry` (105-127) copies forward from `allMonths[0]` when "Copy from last month" is chosen (116-122) and rejects an existing month with "This month already exists." (112). `handleEditMonth` (184) is the only path that edits an existing month. In `BalanceSpreadsheet.tsx` the inline inputs have only a dash placeholder (line 414) and the save/cancel buttons only a `title` (line 372). Group columns are read-only in inline mode (comment at line 397) and groups start collapsed (`expandedGroups` starts empty), so grouped accounts cannot be entered until the user expands the group. Inline columns also follow the sheet's status filter.
- Details tab edit mode: `BalanceDetails.tsx` (`editMode`, line 250). `handleStartEditMode` (552) builds values for active accounts, copying from `latestMonth` when `copyFrom` is on, and also rejects an existing month. `handleSaveEditMode` (577) drops blanks and calls `onSaveMonth` -> `Data.tsx handleSaveMonth` (157), which writes only active accounts. Inputs have `aria-label="{name} balance"` (619), the banner is `aria-live="polite"` (709), Escape cancels, first input is focused, and groups always show their children. Home's Net Worth card "View Details" already routes here (`/net-worth/dashboard/details`, `Home.tsx` line 177).
- `DataContext.setBalances` updates state first, then `saveBalances(...).catch(console.error)` (`DataContext.tsx` line 44). A failed disk write is invisible to the user today.

**Net worth math** (missing balance counts as 0 or is skipped, so a forgotten account looks like a dip)
- `NetWorthSummary.tsx`: `sumAccountBalances` (lines 22-23) uses `balanceMap.get(id) ?? 0`. It sums all accounts and ignores `status`. The selected month is `allMonths[monthIdx]` (116) where `allMonths` comes from Home sorted descending, so the default is the maximum month, even a future one. The comparison month sums use the same function (about lines 238-245).
- `MiniCharts.tsx` (`sumForMonth`, 75) and `BalanceCharts.tsx` (73): all accounts, missing skipped, one point per month in `filteredMonths`.
- Active-only consumers that treat missing as 0 for the latest month: `BalanceDetails.tsx` (`netWorthTotal` 478, owner subtotals), `AllocationBreakdown.tsx` (55-61), `useAllocationData.ts` (15-20), `useGoalMetrics.ts` (`getTotalForMonth` 48), `goalMath.ts` (4-14, 22-30; this one ignores `status`), `GoalDetailedCard.tsx` (314-321), `FICalculator.tsx` (`getLatestBalancesByFilter` 54-69), `getLatestGoalTotals` in `types.ts`.
- `BalanceDetails.getChangeDisplay` (514-517) computes `(current ?? 0) - previous`, so an account missing this month shows a full-size drop.
- `useLeverage.ts` (56-71) and `SavingsGrowthTracker.getYearEndNetWorths` (18-40) sum every entry of a month; a partial December or latest month distorts them.

**Home** (`src/pages/home/Home.tsx`)
- Five cards, not four: Net Worth, Charts, Goals, Allocation, Spending (`cards` array, line 171). `docs/specs/home.md` still says four (pre-existing doc gap).
- Reorder: `localStorage['home-card-order']` holds card indices (`DEFAULT_ORDER = [0,1,2,3,4]`, line 18; `loadOrder` 20-33; saved on every move at 101/142/165). `storage.ts` validates it with `isCardOrder` (lines 62-64): length must be exactly 5 and values 0-4. Any other length fails validation and falls back to the default silently. The migration branch in `loadOrder` for a 4-entry order is unreachable for that reason.
- Every card sits in a `.home-grid-slot` with move buttons and `draggable`, so a card that returns `null` would leave an empty slot with live move buttons.
- Setup: `SetupProgress.tsx` (`h2#setup-heading`, steps accounts/balances/goals/budget, completes when `accounts.length > 0` and `balances.length > 0` for steps 1 and 2) renders above the grid when incomplete and not dismissed (`Home.tsx` 225-236). `WelcomeGuide.tsx` exists but is not imported by any non-test file.
- Announcements: one `aria-live="polite"` `.sr-only` region for card moves (line 282).
- Grep for reminder, lastUpdated, stale, snooze, and "Partial month" finds no user-facing feature. The PM finding is confirmed.

**Storage, flags, demo**
- UI preferences live in `localStorage` through `src/utils/storage.ts` (typed `StorageSchema`, validators, `JSON_KEYS`); `CONTRIBUTING.md` lists the keys (line 130). Financial data lives only in the folder.
- Flags: `src/flags/flagDefinitions.ts` (`FLAGS`, `defineFlag`), `useFlag(FLAGS.X)`, `feature-flags.json` (`modern-design` at 100). `FlagContext` default `resolveFlag` returns `flag.default`, and a local override (`flag-overrides` in localStorage) wins over rollout.
- Demo mode: `enterDemo` seeds a `MemoryFileStore` (`FileStoreContext.tsx`); `isDemoActive()` reads `_demoMode`. `demoBalances()` (`demoMode.ts`) generates balances for the 5 demo accounts (all `active`) through the current month, so demo data is always complete.
- Repo breakpoints used by Home are 1100px and 640px (`Home.css`), and 900px for the sidebar. There is no 480/768/992 rule in Home today.
- Quality gates: 90% statement coverage threshold (`vite.config.js`), `eslint --max-warnings=0`, prettier, `tsc`, Playwright, "exhaustive tests for every new file" (`.github/copilot-instructions.md`).

## 3. Architecture

### 3.1 Decisions

| Question | Decision | Why |
|---|---|---|
| Home card, modal, or Accounts-tab mode? | A full-width **Check-in strip on Home** (read-only status plus one CTA) that deep-links into the **existing Details-tab edit mode** | No new modal to build or trap focus in; entry mechanics already exist; Home stays a dashboard |
| Entry surface | **Details tab edit mode**, not the spreadsheet inline row (deviates from the PM draft) | The inline row has unlabeled inputs, no way to enter collapsed groups, and follows sheet filters. Details has labels, live banner, Escape, focus handling, and groups. Fixing the spreadsheet row is a larger change |
| In the reorder system? | **No in v1.** The strip renders above `.home-grid`, next to `SetupProgress` | It is a time-sensitive prompt that must not be buried by a user's order. It avoids touching `home-card-order`, the length-5 validator, and the empty-slot problem. Adding it later means index 5, a validator change to length 6, and a visible-order mapping |
| Partial month and deltas | Latest-month badge; deltas hidden while partial; partial latest month not plotted on trend charts | Never show a number that implies a loss that did not happen (section 3.5) |
| Snooze | `localStorage['checkin-snooze']`, browser-level UI preference | Same class as `onboarding-dismissed` and `home-card-order`; not financial data, so it stays out of the folder |
| Demo | No special case | Demo data is complete, so the strip shows "up to date"; saves go to `MemoryFileStore` as for every other edit |

### 3.2 Modules

| Module | New or modified | Responsibility |
|---|---|---|
| `src/pages/data/monthStatus.ts` | NEW | Pure functions: month key helpers, `getMonthStatus`, `getCheckInState`, constants. Shared by Home and Data pages. No React, no IO |
| `src/hooks/useNow.ts` | NEW | Returns a `Date` that refreshes on `visibilitychange` and window `focus` (no timers), so Home is right after midnight or a month change without a reload |
| `src/pages/home/CheckInCard.tsx` | NEW | Presentational strip for a `CheckInState`; owns the status live region and the snooze button |
| `src/pages/home/checkInSnooze.ts` | NEW | `loadSnooze`, `saveSnooze`, `isSnoozed` over `storage.ts` |
| `src/pages/data/components/PartialMonthBadge.tsx` | NEW | The "Partial month" chip with an accessible description; used by the Net Worth card and Details summary |
| `src/styles/CheckInCard.css`, `src/styles/PartialMonthBadge.css` | NEW | One CSS file per component |
| `src/pages/home/Home.tsx` | MODIFIED | Compute state once, render strip, pass partial info to `NetWorthSummary` and `MiniCharts` |
| `src/pages/home/NetWorthSummary.tsx` | MODIFIED | Optional `partial` prop: badge, hide change figures |
| `src/pages/home/MiniCharts.tsx`, `src/pages/data/BalanceCharts.tsx` | MODIFIED | Omit the partial latest month from plotted data; caption |
| `src/pages/data/BalanceDetails.tsx` | MODIFIED | Check-in start, blank flagging, copied captions, save announcement, partial badge, per-account change fix |
| `src/pages/data/Data.tsx` | MODIFIED | Read and clear router state, pass `startCheckInMonth` |
| `src/utils/storage.ts` | MODIFIED | New `checkin-snooze` key, validator, JSON key |
| `src/flags/flagDefinitions.ts`, `feature-flags.json` | MODIFIED | `monthly-check-in` flag |

Reused unchanged: `DataContext` (accounts, balances), `formatMonth`/`formatCurrency` in `types.ts`, `handleSaveMonth`, `ErrorBoundary` (variant `card`), `.sr-only` from `utilities.css`, `useFlag`.

### 3.3 Month state (pure, in `monthStatus.ts`)

Definitions. `C` is the current local calendar month; `P = C - 1`. A month key is valid only if it matches `^\d{4}-(0[1-9]|1[0-2])$`; invalid keys are ignored everywhere in this feature. The **reporting month `R`** is the latest valid month that is `<= C`. Future months are valid months `> C`; they never become `R`.

`getMonthStatus(accounts, balances, month, reportingMonth)`:
- **Expected** accounts are those with `status === 'active'` and either (a) at least one balance whose month is `<= month`, or (b) no balance at all and `month === reportingMonth` (a new account is expected to get its first balance in the month being checked in).
- **Present** is an expected account with an entry for `month`. A balance of 0 is present. Orphan entries (unknown `accountId`) and duplicates are ignored for counting.
- **Missing** is expected minus present. `isPartial = missing.length > 0`.
- Inactive accounts are never expected. If an inactive account has an entry, it still counts toward totals everywhere it did before.

`getCheckInState(accounts, balances, now)` returns `kind`:

| kind | When | CTA target month `T` |
|---|---|---|
| `hidden` | No accounts, no valid balances, or no active accounts | none |
| `future-only` | Valid balances exist but all are `> C` | none (link to spreadsheet) |
| `partial` | `R` exists and `getMonthStatus(R)` has missing accounts | `R` |
| `due` | `R` complete and `R < P` | `R + 1` (always `<= P`, so it does not exist yet) |
| `up-to-date` | `R` complete and `R >= P` | none (link to Details) |

Staleness: `d = whole local calendar days from the last day of R to today`. `isStale = d > 35` (`STALE_AFTER_DAYS = 35`). `d` is `null` while `R` is still the current month or on days before its last day. Boundary: last day of `R` plus 35 days is not stale; plus 36 days is stale. Month ends and "today" use local time (`new Date(y, m, 0)` and local getters, as `Data.tsx handleOpenAddEntry` already does); the difference is rounded to whole days so a DST change does not shift it. Month keys carry no timezone, so a timezone change simply moves "today".

Worked examples (today is 2026-11-08, so `C = 2026-11`, `P = 2026-10`):

| # | Data | Computation | Result |
|---|---|---|---|
| 1 | 9 active; Oct has 7 entries | `R = Oct`; expected 9, present 7 | `partial`, 2 missing, `d = 8`, not stale. Headline "2 accounts missing for October" |
| 2 | 9 active; Oct has 9 | `R = Oct >= P` | `up-to-date` |
| 3 | 9 active; Sep has 9; no Oct | `R = Sep < P`; `d = 39` | `due`, `T = Oct`, stale |
| 4 | Account #10 first balance 2026-06; others full | `getMonthStatus(2026-03)`: #10 not expected (no entry `<=` Mar). `getMonthStatus(2026-10)`: expected | Mar complete 8 of 8; Oct expects 9 |
| 5 | 8 active plus 1 inactive with entries through 2026-03; Oct has the 8 | Inactive never expected | `up-to-date`; inactive account excluded from "missing" |
| 6 | New active account, no entries; Oct has the other 8 | Rule (b): expected at `R` | `partial`, 1 missing (the new account) |
| 7 | 0 accounts, or accounts but 0 balances | Hidden; `SetupProgress` handles onboarding | `hidden` |
| 8 | Oct complete; 2026-12 has 3 of 9 | `R = Oct`; `futureMonths = [2026-12]` | `up-to-date` plus note about December; the Net Worth card still defaults to Dec and shows "Partial month" for it |
| 9 | Only 2026-12 entries | No month `<= C` | `future-only` |
| 10 | Account typed as 0 for Oct | Present | Not missing |
| 11 | Oct has entries only for an inactive account | Expected 9, present 0 | `partial`, 9 missing |
| 12 | Active account with Jan, Feb, Apr entries | `getMonthStatus(Mar)` | 1 missing (tested; not surfaced in the UI in v1) |
| 13 | Key `2026-1` or `2026-13` in a CSV | Invalid key | Ignored by this feature |
| 14 | Dec 5 vs Dec 6, `R = Oct` | `d = 35` vs `d = 36` | Not stale vs stale |

### 3.4 Flow

1. `Home` reads `accounts` and `balances` from `useData()`, `now` from `useNow()`, and the flag. It computes `checkIn = useMemo(() => getCheckInState(accounts, balances, now), [accounts, balances, todayKey])`, where `todayKey` is `YYYY-MM-DD`, so the work reruns only when data or the day changes.
2. If the flag is on, `dataLoaded` is true, `kind !== 'hidden'`, and the strip is not snoozed, Home renders `CheckInCard` after `SetupProgress` and before `.home-grid`, inside `ErrorBoundary variant="card"`.
3. The CTA calls `navigate('/net-worth/dashboard/details', { state: { checkIn: { month: T } } })`. `Data.tsx` validates the state (shape and month key), keeps it in a local `startCheckInMonth`, and immediately calls `navigate(location.pathname, { replace: true, state: null })` so reload and Back do not reopen the form.
4. `BalanceDetails` receives `startCheckInMonth` and, if it is not already editing, enters `editMode` for that month:
   - Month not in `allMonths` (the `due` case): every active account is prefilled from `latestMonth` (copy-forward, same rule as `handleStartEditMode`), and each prefilled field is tracked in a UI-only `copied` set.
   - Month in `allMonths` (the `partial` case): present accounts are prefilled with their saved value; missing accounts are blank.
5. The user edits and saves. `handleSaveEditMode` calls the existing `onSaveMonth`; `Data.handleSaveMonth` writes through `ctxSetBalances`. Blank fields are not written (unchanged).
6. Home recomputes from context on return. If `R` is now complete, the strip shows `up-to-date`.

### 3.5 Where a partial month changes what is shown

"Partial" is evaluated only for the latest month shown (Home's `allMonths[0]`, via `getMonthStatus(accounts, balances, latest, latest)`), never for historical months. Reason: an account abandoned years ago but left `active` would otherwise mark every later month partial and erase deltas and chart points for the user's whole history. Historical gaps keep today's behavior.

| Place (file) | Today | v1 behavior for a partial latest month |
|---|---|---|
| Home Net Worth headline and FI/GW rows (`NetWorthSummary.tsx`) | Missing as 0; delta vs comparison month | Amount stays. "Partial month" badge. All change figures hidden and replaced by "Change hidden until {Month} is complete." |
| Home Charts (`MiniCharts.tsx`) | One point per month | Latest partial month not plotted; caption names it |
| Wealth > Charts (`BalanceCharts.tsx`) | Same | Same as Home Charts |
| Wealth > Details summary and owner subtotals (`BalanceDetails.tsx`) | Active-only, missing as 0 | Badge next to "Net worth". Per-account change line is hidden for an account with no balance this month (fixes the fake drop at 514-517) |
| Wealth > Spreadsheet total column | Sums present entries | No change. Blank cells already show as blank |
| Allocation (`AllocationBreakdown.tsx`, `useAllocationData.ts`) | Mix of latest month, active only | No change. It shows a mix, not a total. Listed in open questions |
| Goals math (`useGoalMetrics.ts`, `goalMath.ts`, `GoalDetailedCard.tsx`, `GoalDetail.tsx`, `GwSection.tsx`, `FICalculator.tsx`, `getLatestGoalTotals`) | Missing as 0 | No change in v1. The strip on Home is the guard. Using the latest complete month here is a separate decision (open question) |
| Leverage (`useLeverage.ts`), PayDown (`PayDown.tsx`) | Per-month sums | No change |
| Year-end net worth (`SavingsGrowthTracker.tsx`) | December, else latest month | No change; owned by annual-review (section 8) |

### 3.6 Performance and failure modes

- Cost: one pass over `balances` (about 20 accounts times 12 months times 20 years is 4,800 rows) when data or the day changes. No file IO; everything derives from `DataContext`.
- Before `DataContext` loads, accounts and balances are empty, so the strip is hidden, then appears and pushes the grid down. Mitigation: gate on Home's existing `dataLoaded`, as `SetupProgress` does. Residual shift is accepted (`DataContext` has no loaded flag).
- Disk write failure: `DataContext.setBalances` swallows errors, so "Saved" can be shown when the write failed. This is pre-existing; surfacing it is owned by data-safety-net. The save announcement says "Saved" only after `onSaveMonth` returns.
- Abandoned account left active: it stays "missing" until the user enters 0 or marks it inactive. The strip carries an "Account closed? Mark it inactive" link to Accounts.
- Accounts that are only updated quarterly will show as missing in off months. Accepted for v1 (open question 5).
- Malformed month keys, orphan account ids, duplicate rows: handled by the rules in 3.3; covered by tests.
- Router state is untrusted: validated by `isMonthKey` and by "month is `<= C` and not already complete"; anything else is ignored.
- Two tabs: `DataContext` already refreshes on `data-changed`; the strip recomputes. No new cross-tab logic.

### 3.7 Rollout and back-compat

- New flag `FLAGS.MONTHLY_CHECK_IN = defineFlag('monthly-check-in', { type: 'boolean', default: false, description: 'Home check-in strip, partial-month indicators, and Details check-in mode', temporary: true })`; `feature-flags.json` gets `"monthly-check-in": { "percentage": 0 }`. Turn it on locally with `flag-overrides`, then raise the percentage. One flag gates every surface (strip, badge, chart omission, Details check-in). With it off, behavior is byte-for-byte today's.
- Unit tests that render without `FlagProvider` get `default: false`, so existing Home and Details tests stay valid.
- Data folder: no new files and no format change. The only new persisted value is `localStorage['checkin-snooze']`:

```json
{ "month": "2026-10", "until": "2026-11-15" }
```

  Snoozed while `todayKey < until` and `month === R`. Different `R` means not snoozed, so recording a new month clears it. Invalid JSON or shape falls back to "not snoozed" through the validator.
- `home-card-order` is untouched.

## 4. Product requirements

### 4.1 User stories

- As the person who updates balances monthly, I want one guided check-in that shows what is missing, so that my net worth is never quietly wrong.
- As that person, I want the entry form pre-filled with last month's values and clear marks on what I have not touched, so I update each number deliberately.
- As a returning visitor, I want Home to tell me how old my data is, so I notice before I rely on it.
- As a keyboard or screen reader user, I want to do all of this without a mouse and hear what changed, without being interrupted by repeated announcements.

### 4.2 Acceptance criteria

Strip
- AC-1: With the flag on, 9 active accounts, and 7 of 9 balances in the latest month (October, today in November), Home shows "2 accounts missing for October" and lists both account names.
- AC-2: One missing account reads "1 account missing for October"; the pluralization rule is in section 6.
- AC-3: The strip is hidden when there are no accounts, no valid balances, no active accounts, or the flag is off.
- AC-4: `due`: latest complete month is before last month. The strip reads "{Month} balances are ready to record" with the CTA "Start {Month} check-in", where the month is the one after the latest recorded month.
- AC-5: `up-to-date`: the strip reads "{Month} is complete" with the count of active accounts and a "Review balances" link. No snooze button.
- AC-6: The staleness boundary is exact: last day of latest month plus 35 days is not stale, plus 36 days is stale. A stale strip uses the warning tone and the "Last balances are from..." line.
- AC-7: The days figure uses local calendar days and is unchanged by a DST change in between.
- AC-8: Future-dated months never become the latest month for the strip. If any exist, the strip adds the future-month note. If all months are future, it shows the `future-only` state.
- AC-9: The strip renders after `SetupProgress` and before the card grid, is not draggable, has no move buttons, and does not change `home-card-order`.
- AC-10: "Snooze for 7 days" hides the strip until the 7th day after today (local), only for the same reporting month. Recording any new month shows it again. It is offered only in `partial` and `due`.
- AC-11: Snooze does not hide the "Partial month" badge or the hidden-change message on the Net Worth card.
- AC-12: The strip recomputes when the tab regains focus on a new day, without a reload.

Entry
- AC-13: The CTA opens Wealth > Details already in edit mode for month `T`, with focus on the first account input.
- AC-14: For a new month, every active account is prefilled with its value from the latest month and shows the caption "Copied from {Month}" until the user changes that field.
- AC-15: For an existing partial month, present accounts show saved values and missing accounts are blank with the note "No balance yet" and the last recorded amount if any.
- AC-16: Blank accounts are visibly flagged in edit mode and counted in the footer; Save stays enabled when at least one value is savable (existing rule).
- AC-17: Saving writes only non-blank values for active accounts (unchanged) and never deletes an existing entry.
- AC-18: After saving, a status message states the month and how many accounts still have no balance.
- AC-19: Reloading the Details page or pressing Back does not reopen the form (router state is cleared).
- AC-20: Invalid router state (bad month, month in the future, month already complete) is ignored and Details opens normally.

Partial month
- AC-21: When the latest month is partial, the Net Worth card shows "Partial month", a description with the missing count, and no change amounts or percentages; FI and GW rows show amounts only.
- AC-22: Home Charts and Wealth > Charts omit the partial latest month and show the caption "{Month} is not plotted until all accounts have a balance."
- AC-23: In Details, an account with no balance for the selected month shows no change line, and the summary shows the badge.
- AC-24: Once the month is complete, badge and caption disappear and the point is plotted.
- AC-25: Historical months are never marked partial in v1.

Accessibility
- AC-26: Everything above is reachable and operable by keyboard in DOM order, with visible focus.
- AC-27: The strip is announced only when its state changes after first render (section 5.7); it is silent on load.
- AC-28: Colour is never the only carrier of status (text and icon accompany it).

### 4.3 Scope

**In:** Home strip; month-state module; Details check-in mode with copy-forward, blank flagging, copied captions, save announcement; partial badge and change hiding on the Net Worth card and Details; partial latest month omitted from trend charts; snooze; one flag; tests; docs.

**Out, and why:**
- Push, email, or system notifications: no server, and the app promises no accounts or background services.
- Fetching balances from banks: Plaid-style links break the no-network promise.
- A per-entry "entered on" timestamp: would change the CSV format; days are measured from month end instead.
- Per-account cadence (quarterly, skip): needs an `Account` field; deferred (open question 5).
- Like-for-like deltas: more math across seven sums; hiding is safe and small (open question 3).
- Changing goal, allocation, or leverage math for partial months: separate decision with its own regression risk.
- Making the strip a reorderable card, and fixing the spreadsheet inline row's group and label gaps: separate work.

### 4.4 States

| State | Strip | Net Worth card |
|---|---|---|
| First time (no accounts or no balances) | Hidden; setup guide leads | Existing empty state |
| Loading | Hidden until `dataLoaded`; no spinner | Existing |
| Returning, up to date | Calm one-line "complete" | Normal |
| Partial | Warning tone, list, "Finish {Month}" | Badge, no change figures |
| Due | Neutral, or warning when stale | Normal (latest month is complete) |
| Snoozed | Hidden | Badge still shows when partial |
| Error in strip | `ErrorBoundary` card variant; the rest of Home is unaffected | n/a |
| Flag off | Hidden | Today's behavior |

### 4.5 Keyboard and screen reader behavior

- Tab order on Home: greeting, setup guide link, `SetupProgress`, strip (CTA, secondary links, snooze), grid cards. The list of missing accounts is a plain `ul`, not focusable.
- Enter or Space activates buttons. After snooze, focus moves to the page `h1` (`tabIndex={-1}`) because the strip unmounts; Home's polite region announces "Check-in snoozed for 7 days."
- Details edit mode keeps its keys: Escape cancels, Tab moves through the inputs and then Save/Cancel.
- Screen readers hear the strip as a labelled region (`h2` label), then the headline, list, and buttons in order.

### 4.6 Edge cases

- Month with every account missing except inactive ones: shown as partial (example 11).
- User enters only some missing accounts and saves: the strip updates to the remaining count.
- Zero typed: counts as a balance.
- A group column whose children are collapsed does not affect Details, which lists children.
- Liability balances use the app's existing sign convention; this feature never edits or re-signs values.
- Account names that are empty fall back to "Unnamed account" in the list.
- More than 6 missing: the list shows the first 6 (sheet order) and "and {n} more".
- Flag turned off mid-session: the strip and badges disappear on the next render; no data is affected.

## 5. Design spec

Class prefix `checkin-` for the strip, `partial-badge` for the chip. Tokens come from `src/styles/colorThemes.css`; no hex values in new CSS. Icons are stroke SVG (`fill="none" stroke="currentColor"`), no emoji.

### 5.1 Component hierarchy (strip)

```html
<section class="checkin-card checkin-card--partial" aria-labelledby="checkin-heading">
  <div class="checkin-card__body">
    <svg class="checkin-card__icon" aria-hidden="true" />
    <div class="checkin-card__text">
      <h2 id="checkin-heading" class="checkin-card__title">2 accounts missing for October</h2>
      <p class="checkin-card__meta">October ended 8 days ago.</p>
      <ul class="checkin-card__list" aria-label="Accounts missing for October">
        <li class="checkin-card__chip">Roth IRA</li>
      </ul>
      <p class="checkin-card__note">Balances also exist for December 2026, which is in the future.</p>
    </div>
  </div>
  <div class="checkin-card__actions">
    <button type="button" class="checkin-card__cta">Finish October</button>
    <button type="button" class="checkin-card__link">Snooze for 7 days</button>
    <button type="button" class="checkin-card__link">Account closed? Mark it inactive</button>
  </div>
  <p role="status" class="sr-only">{announcement, empty on first render}</p>
</section>
```

Modifier classes: `--partial`, `--due`, `--stale`, `--ok`, `--future`. Links to other routes ("Review balances", "Mark it inactive") use `<button>` with `navigate`, matching the existing `home-card-link` pattern.

### 5.2 Visual spec

| Element | Spec |
|---|---|
| Container | `background: var(--color-surface)`; `border: 1px solid var(--color-border)`; `border-radius: var(--radius)`; padding `1rem 1.5rem`; `margin-bottom: 1.25rem` (equals `.home-grid` gap); same shadow as `.home-card`; no `min-height` (unlike `.home-card`'s 260px) |
| Left edge | 3px solid `var(--accent)` (ok, due), `var(--color-warning)` (partial, stale). Decorative only; the icon and text carry the meaning |
| Title | `var(--fs-lg)`, `var(--fw-semibold)`, `var(--color-text-heading)`, sentence case (not the uppercase card-label style), `margin: 0` |
| Meta and note | `var(--fs-sm)`, `var(--color-text-muted)` (4.83:1 light, 6.57:1 dark on surface); stale meta uses `var(--color-warning-text)` |
| Chips | `var(--fs-xs)`, `var(--color-text-secondary)` on `var(--color-surface-alt)` (7.06:1; muted would be 4.52:1), `1px solid var(--color-border)`, `var(--radius-pill)`, padding `0.125rem 0.625rem`, gap `0.375rem` |
| CTA | Outline pattern of `.home-card-cta-btn`: transparent background, `1px solid var(--accent)`, text `var(--accent)` (5.17:1 light, 4.53:1 dark), `var(--fs-sm)`, `var(--fw-semibold)`, `var(--radius)`, padding `0.35rem 0.9rem`, min-height 36px desktop, 44px at 640px and below |
| Secondary links | Text buttons, `var(--accent)`, `var(--fs-sm)`, `var(--fw-medium)`, underline on hover and focus |
| Icon | 20px stroke SVG: clock for due and stale, alert-circle for partial, check-circle for ok (`var(--color-positive)`); `var(--color-warning-text)` for partial and stale |
| Partial badge | `var(--color-warning-light)` background, `var(--color-warning-text)` text (6.37:1 light, 8.97:1 dark), `var(--fs-xs)`, `var(--fw-semibold)`, `var(--radius-pill)`, padding `0.125rem 0.5rem`, placed beside the Net Worth amount |
| Blank note in Details | `var(--fs-xs)`, `var(--color-warning-text)`, below the input; the input gets a `1px solid var(--color-warning)` border while blank |
| Copied caption | `var(--fs-xs)`, `var(--color-text-muted)` |

`var(--color-warning)` (2.15:1 on white) is never used for text.

### 5.3 States

| State | Treatment |
|---|---|
| Default | As above |
| Hover | CTA background `var(--color-surface-hover)`; links underline. No accent fill on hover, because white on the dark accent is 3.68:1 |
| Focus | `outline: 2px solid var(--accent); outline-offset: 2px` on all buttons (same as `.setup-progress-dismiss:focus-visible`) |
| Active | CTA background `var(--accent-light)`; no transform |
| Disabled | Not used; unavailable actions are not rendered |
| Loading | Strip not rendered until `dataLoaded` |
| Empty | Strip not rendered |
| Error | `ErrorBoundary variant="card"` fallback |
| Details input blank | Warning border and note; copied inputs show the caption |
| Details Save | Existing disabled rule (no savable value) |

### 5.4 Responsive

The repo's Home breakpoints are 1100px and 640px; verify at 480, 768, 992, and 1280 widths.
- 1100px and above: text left, actions right (flex row, `gap: 1.5rem`, `align-items: center`).
- Below 1100px: same row until it cannot fit, then actions wrap below the text (`flex-wrap: wrap`); the strip spans the page padding (`1rem` side padding at this size).
- 640px and below: single column; CTA is full width with 44px minimum height; secondary links stack with 44px tap height; chips wrap.
- No horizontal scroll at 320px; chip text may wrap within the chip.
- Hover is never required: every action is a visible button.

### 5.5 Dark mode

Variables swap automatically (`body.dark`). Specific checks: warning-text on warning-light is 8.97:1; accent text on surface is 4.53:1, so the CTA stays an outline and does not use accent text on `--accent-lighter` (4.13:1 in dark). Dark shadows follow `.home-card`. `modern-design.css` already restyles `.home-card`; add a `body.modern-design .checkin-card` block that matches that card's border and shadow so the strip looks like its siblings.

### 5.6 Interaction and motion

- CTA, links, and chips have no animation other than the existing 150ms color/background transition (`0.15s ease`). The strip appears and disappears without animation (it is a layout change, not a state change worth animating).
- Add `.checkin-card__cta, .checkin-card__link` to the existing `prefers-reduced-motion` block (transition none).
- Details: no new motion. The copied caption disappears immediately when the field changes.

### 5.7 Accessibility notes (WCAG 2.1 AA)

- 1.3.1 Info and Relationships: `section` labelled by an `h2` (same level as `SetupProgress`, below the page `h1`); the missing list is a `ul` with an `aria-label`.
- 1.4.1 Use of Color: tone is always paired with an icon and text; the warning border is decorative.
- 1.4.3 and 1.4.11: contrast values in 5.2; focus ring is 3:1 or better against the surface in both themes.
- 2.1.1 Keyboard and 2.4.3 Focus Order: DOM order equals visual order; no positive tabindex. After snooze, focus goes to the `h1`.
- 2.4.7 Focus Visible: rule in 5.3.
- 2.5.5 target size (AAA, adopted by the repo at 44px on mobile): 44px at 640px and below.
- 3.3.1 and 3.3.3 Error Identification: blank is not an error, so no `aria-invalid`; the note is linked through `aria-describedby` to each input (for example "No balance yet. Last recorded $12,400 in September 2026.").
- 4.1.3 Status Messages: two regions.
  - Strip `role="status"` (polite, atomic): empty at mount. It is written only when the tuple `(reportingMonth, kind, missingCount)` changes after first render, for example after another tab saves: "{n} accounts missing for October." It is never written on focus, day rollover with no change, or re-render.
  - Details persistent `role="status"` (polite): written once on save: "Saved October 2026. 2 accounts still have no balance." The existing banner live region is unchanged. Keystrokes never announce a count.
  - Snooze uses Home's existing region (one message).
- The Net Worth badge is text, with its description in `aria-describedby` (not live).

## 6. Copy

Voice: plain, calm, specific. No exclamation marks. `{Month}` is the long month name, with the year added when it differs from the current year ("October" in 2026, "October 2025" otherwise). Plural rule for accounts: `n === 1` is "1 account", otherwise "{n} accounts"; `n` is never 0 in these strings. Days: `1 day`, otherwise `{d} days`.

| Surface | String | Notes |
|---|---|---|
| Strip title, partial | `{n} account(s) missing for {Month}` | "2 accounts missing for October" |
| Strip title, due | `{Month} balances are ready to record` | `{Month}` is the target month |
| Strip title, up to date | `{Month} is complete` | |
| Strip title, future-only | `Your latest balances are dated in the future` | |
| Meta, partial/due, not stale | `{LastMonth} ended {d} day(s) ago.` | Only when `d > 0` |
| Meta, stale | `Last balances are from {LastMonth}, {d} day(s) ago.` | Warning color |
| Meta, partial, any | `Net worth for {Month} leaves these out until you add them.` | Shown with the list |
| Meta, up to date | `All {n} active accounts have a balance.` | `n === 1`: "Your active account has a balance." |
| Future note | `Balances also exist for {Month}, which is in the future.` | Several: "Balances also exist for {n} future months, starting {Month}." |
| List overflow | `and {n} more` | After 6 chips |
| List label (aria) | `Accounts missing for {Month}` | |
| CTA, partial | `Finish {Month}` | |
| CTA, due | `Start {Month} check-in` | |
| Link, up to date | `Review balances` | To Details |
| Link, future-only | `Review months` | To Spreadsheet |
| Link, snooze | `Snooze for 7 days` | partial and due only |
| Link, closed | `Account closed? Mark it inactive` | To Accounts tab |
| Announcement, snooze | `Check-in snoozed for 7 days.` | Home live region |
| Announcement, change | `{n} account(s) missing for {Month}.` / `{Month} is complete.` | Strip status, on change only |
| Net Worth badge | `Partial month` | |
| Badge description | `{n} account(s) have no balance for {Month}. Net worth leaves them out.` | `aria-describedby` and `title` |
| Hidden change | `Change hidden until {Month} is complete.` | Replaces delta text |
| Chart caption | `{Month} is not plotted until all accounts have a balance.` | `p`, muted |
| Details banner, new month | `Entering balances for {Month} {Year}` then `Amounts are copied from {PrevMonth} {PrevYear}. Update each one, then save.` | First line is today's text |
| Details banner, partial | `Adding the missing balances for {Month} {Year}` | |
| Copied caption | `Copied from {Month}` | Cleared on edit |
| Blank note | `No balance yet` | Input description adds `Last recorded {amount} in {Month}.` or `No earlier balance.` |
| Footer summary | `{n} account(s) still blank. Blank accounts are not saved.` / `Every account has a balance.` | Static text |
| Save announcement | `Saved {Month} {Year}. {n} account(s) still have no balance.` / `Saved {Month} {Year}. All {n} accounts have a balance.` | `n === 1` in the second form: "Saved ... Your account has a balance." |
| Unnamed account | `Unnamed account` | Fallback |
| Flag description | `Home check-in strip, partial-month indicators, and Details check-in mode` | `flagDefinitions.ts` |

## 7. Engineering plan

### 7.1 File-by-file

| File | Change |
|---|---|
| `src/pages/data/monthStatus.ts` | NEW |
| `src/pages/data/monthStatus.test.ts` | NEW (table-driven, section 3.3) |
| `src/hooks/useNow.ts`, `useNow.test.ts` | NEW |
| `src/pages/home/CheckInCard.tsx`, `CheckInCard.test.tsx` | NEW |
| `src/pages/home/checkInSnooze.ts`, `checkInSnooze.test.ts` | NEW |
| `src/pages/data/components/PartialMonthBadge.tsx`, `.test.tsx` | NEW |
| `src/styles/CheckInCard.css`, `src/styles/PartialMonthBadge.css` | NEW; add reduced-motion and `body.modern-design` blocks |
| `src/pages/home/Home.tsx` | MODIFIED: flag, `useNow`, state, strip, `h1 tabIndex={-1}`, pass `partial` and `omitMonth` |
| `src/pages/home/NetWorthSummary.tsx` | MODIFIED: optional `partial?: { month: string; missingCount: number }` |
| `src/pages/home/MiniCharts.tsx`, `src/pages/data/BalanceCharts.tsx` | MODIFIED: optional `omitMonth`; filter `filteredMonths`; caption |
| `src/pages/data/BalanceDetails.tsx` | MODIFIED: `startCheckInMonth`, `copied` set, blank notes, footer summary, persistent status region, badge, change-line fix |
| `src/pages/data/Data.tsx` | MODIFIED: parse and clear router state, flag gate, pass props |
| `src/utils/storage.ts` | MODIFIED: `'checkin-snooze'` schema entry, `isCheckInSnooze`, `JSON_KEYS` |
| `src/flags/flagDefinitions.ts`, `feature-flags.json` | MODIFIED |
| `e2e/pages/home.page.ts`, `e2e/monthly-check-in.spec.ts`, `e2e/fixtures/check-in.fixtures.ts` | MODIFIED / NEW |
| `CONTRIBUTING.md`, `README.md`, `docs/specs/home.md`, `docs/specs/net-worth.md`, `docs/README.md`, `src/pages/guide/sections/FeaturesByPage.tsx` | MODIFIED (docs) |

### 7.2 Key types and signatures

```ts
// src/pages/data/monthStatus.ts
export type MonthKey = string // 'YYYY-MM', validated by isMonthKey
export const STALE_AFTER_DAYS = 35
export const isMonthKey = (v: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
export const currentMonthKey = (now: Date): MonthKey => /* local getters */
export const addMonths = (month: MonthKey, delta: number): MonthKey => /* pure */
export const daysSinceMonthEnd = (month: MonthKey, now: Date): number | null => /* local, rounded */

export interface MonthStatus {
  month: MonthKey
  expected: Account[]
  present: Account[]
  missing: Account[]
  isPartial: boolean
}
export function getMonthStatus(
  accounts: Account[], balances: BalanceEntry[], month: MonthKey, reportingMonth: MonthKey,
): MonthStatus

export type CheckInKind = 'hidden' | 'future-only' | 'partial' | 'due' | 'up-to-date'
export interface CheckInState {
  kind: CheckInKind
  reportingMonth: MonthKey | null
  status: MonthStatus | null
  targetMonth: MonthKey | null
  daysSinceMonthEnd: number | null
  isStale: boolean
  futureMonths: MonthKey[]
}
export function getCheckInState(accounts: Account[], balances: BalanceEntry[], now: Date): CheckInState

// src/pages/home/checkInSnooze.ts
export interface CheckInSnooze { month: MonthKey; until: string } // until = local YYYY-MM-DD
export const isSnoozed = (s: CheckInSnooze | null, reportingMonth: MonthKey | null, todayKey: string): boolean
export const snoozeFor = (reportingMonth: MonthKey, now: Date, days = 7): CheckInSnooze

// src/pages/home/CheckInCard.tsx
interface CheckInCardProps {
  state: CheckInState
  today: Date
  onStart: (month: MonthKey) => void
  onNavigate: (path: string) => void
  onSnooze: () => void
}

// BalanceDetails.tsx
interface BalanceDetailsProps { /* existing */ startCheckInMonth?: MonthKey | null; onCheckInStarted?: () => void }
```

`EditMode` gains `copied: Record<string, true>` (account id keys; UI state only, never persisted).

### 7.3 Order of work (PR-sized slices)

1. **Foundations.** `monthStatus.ts`, `useNow.ts`, flag definition, `feature-flags.json` at 0, `storage.ts` key. Tests for all. No UI. Mergeable alone.
2. **Home strip.** `CheckInCard`, snooze, CSS, `Home.tsx` wiring behind the flag, focus handling after snooze. Tests.
3. **Details check-in.** `Data.tsx` router-state hand-off, `BalanceDetails` check-in mode, blank flagging, captions, save announcement. Tests. This is the slice that needs approval of open question 1.
4. **Partial month.** `PartialMonthBadge`, Net Worth card, chart omission and caption (Home and Wealth), Details badge, change-line fix. Tests, including a new `MiniCharts.test.tsx` (none exists today).
5. **Hardening and docs.** Playwright suite, a11y assertions, docs and Guide updates, screenshot regeneration only if the flag is at 100.

### 7.4 Test plan

**Unit (`monthStatus.test.ts`)**: every row in 3.3 (14 cases); `isMonthKey` edge strings; `addMonths` across year ends; `daysSinceMonthEnd` for month end day, next day, DST weeks (2026-03-08 and 2026-11-01 in a US timezone), leap February; exactly 35 and 36 days; fake timers with `vi.setSystemTime` per repo convention.

**Unit**: `checkInSnooze` (valid, invalid JSON, wrong shape, expired, other month); `useNow` (updates on `visibilitychange` and `focus`, no timers); storage validator for `checkin-snooze`.

**Component**
- `CheckInCard`: each kind; plural and singular; overflow list; stale tone; snooze only in partial/due; status region empty on mount and written only on change (rerender with the same state does not write); CTA passes the right month; links call `onNavigate`.
- `NetWorthSummary`: badge and hidden change when `partial` is set; unchanged output when it is absent (existing tests must pass untouched).
- `BalanceDetails`: check-in for a new month prefilled and captioned; for a partial month blanks flagged and `aria-describedby` set; caption clears on edit; save writes only non-blank; save announcement text; existing "Add Entry" flow unchanged; per-account change line hidden when missing.
- `Data`: valid and invalid router state; state cleared after consume; flag off ignores state.
- `Home`: strip position after `SetupProgress`; slot count stays 5; `home-card-order` unchanged; snooze moves focus to `h1`; no `FlagProvider` means no strip.
- `MiniCharts` / `BalanceCharts`: partial latest month omitted, caption present, y-domain unaffected.

**Playwright (`e2e/monthly-check-in.spec.ts`)**, clock pinned with `page.clock.setFixedTime`, flag on via `flag-overrides`:
- E2E-1: 9 accounts, October 7 of 9 -> strip text, list, badge on Net Worth.
- E2E-2: Start check-in for a new month, Save unchanged -> strip reads complete; counts 2 activations (M3).
- E2E-3: Finish a partial month by typing 2 values -> badge and caption gone, chart gains a point.
- E2E-4: Staleness boundary at Dec 5 and Dec 6.
- E2E-5: Snooze hides the strip; reload keeps it hidden; new month shows it again.
- E2E-6: Keyboard-only run through strip -> Details -> Save; reload does not reopen the form.
- E2E-7: Network assertion: no request other than existing static assets and `feature-flags.json`; data folder diff touches only `balances/*.csv`.
- E2E-8: Demo mode shows "complete".

**A11y assertions** (Playwright, no new dependency): heading level order, `section` has an accessible name, status region empty after load, focus ring visible on CTA, 44px target at 480px width, contrast checked once per theme against the values in 5.2, `prefers-reduced-motion` emulation yields no transition.

**Existing tests to update**
- `Home.test.tsx`: no change expected (strip is outside slots, flag defaults off). Add new cases separately.
- `e2e/home.spec.ts` and fixtures: balances are dated 2025-05, so with the flag on the strip would appear stale; the existing specs run with the flag at its default off. Verify and pin the clock only in the new spec.
- `src/utils/storage.test.ts`: add cases; the existing `home-card-order` cases are untouched.
- Coverage: new files must reach the same 90% statements gate; `MiniCharts` currently has no test file.

### 7.5 Docs to update

`docs/specs/home.md` (add Check-in strip under Feature specs; note the Spending card is missing), `docs/specs/net-worth.md` (Details check-in mode, partial month), `docs/README.md` (list this spec), `CONTRIBUTING.md` line 130 (add `checkin-snooze`), `README.md` Home section and "Enter a monthly balance" step, Guide `FeaturesByPage.tsx` Home and Wealth bullets. Screenshots only after full rollout.

### 7.6 Risks

| Risk | Mitigation |
|---|---|
| Copy-forward lets stale numbers be saved unnoticed | "Copied from" captions and banner sentence; Save never auto-focused |
| Abandoned active account keeps the strip on | Latest-month-only evaluation; "Mark it inactive" link; snooze |
| Quarterly accounts nag in off months | Documented; open question 5 |
| Hiding deltas looks like a regression | Message explains why and when it returns; flag-gated; easy to revisit with like-for-like |
| Strip pushes the grid after load | Gate on `dataLoaded` |
| Router state replay | Validate and clear immediately; AC-19, AC-20 |
| Layout and test churn in `BalanceDetails` (large file) | Additive props only; existing flows keep their tests |
| Existing e2e break when the flag goes to 100 | Run the full suite at 100 locally before raising the rollout |

## 8. Cross-feature dependencies

- **data-safety-net:** Owns surfacing disk-write failures (`DataContext.setBalances` swallows errors) and any backup or restore UI. Check-in only says "Saved" after `onSaveMonth` returns. Both specs add a Home status area; Check-in owns the strip slot (after `SetupProgress`), and safety-net should render its own notice after it rather than reorder it.
- **import-wizard:** Owns `csvImport.ts` and the import handler in `Data.tsx`. A wizard that imports whole months should end on the Home strip or Details so partial months are visible at once; `getMonthStatus` needs no change for imported data. Check-in owns `monthStatus.ts` and the router-state contract.
- **category-budget-targets:** Budget-only; no shared files. Overlap is limited to `Home.tsx` (Spending card and `SpendingPeek`), which that spec owns. Check-in adds code only outside `.home-grid` and does not touch card indices.
- **annual-review:** Should import `getMonthStatus` to flag a partial December or latest month in year-end net worth. `SavingsGrowthTracker.getYearEndNetWorths` stays with annual-review. If annual-review adds a Home entry, it must not use `home-card-order` slot 5 without also updating `isCardOrder` (length 5 today).

## 9. Open questions and decisions

| # | Question | Recommendation | Blocks |
|---|---|---|---|
| 1 | Use the Details edit mode, not the spreadsheet inline row, as the entry surface? | Yes. It is labeled, announces, and shows grouped accounts. The inline row would need three accessibility and group fixes first | PR 3 |
| 2 | Strip above the grid, not a reorderable card? | Yes for v1. Revisit if users want to move it; the path is index 5, `isCardOrder` length 6, and a visible-order mapping | No |
| 3 | Hide deltas while partial, or show like-for-like? | Hide in v1. Like-for-like (sum only accounts present in both months) is a follow-up | No |
| 4 | Keep the PM's 35-day staleness threshold? | Yes, as a constant (`STALE_AFTER_DAYS`). Note it is days since the end of the latest month, because entry dates are not stored | No |
| 5 | Quarterly or rarely updated accounts | Accept nagging in v1. Follow-up: optional `Account.checkIn?: 'monthly' | 'skip'` in `accounts.json`; absent means monthly, so old folders stay valid | No |
| 6 | Snooze length and scope | 7 days, per reporting month, in `localStorage`. Not in the folder, because it is a view preference | No |
| 7 | Should goal, allocation, and leverage math use the latest complete month when the latest is partial? | Worth doing, but separately: it changes projected FI dates and has its own test surface. Track as a follow-up | No |
| 8 | Add a one-line "partial" note to the Home Allocation card? | Not in v1; the card shows a mix, not a total | No |
| 9 | Show future-dated months differently on the Net Worth card, whose default month is the maximum month? | Leave as is. The strip notes them; the card marks a partial future month with the badge | No |
| 10 | Rollout path | Flag at 0, own browser override for a week of daily use, then 100, then delete the flag (it is `temporary`) | No |
| 11 | Remove the spreadsheet "Copy from last month" duplicate once Details check-in exists? | No. Leave both; consolidating entry UIs is out of scope | No |
| 12 | Add a `DataContext` loaded flag to avoid the post-load layout shift? | Optional later; Home's `dataLoaded` is enough for v1 | No |
