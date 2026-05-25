## 🏗️ Architecture Review: Exhaustive Plan for 90% Statement Coverage

**Author:** Alex (Staff Architect)
**Current:** 55.89% statements | 968 tests | 68 test files | 140 source files
**Target:** 90% statements
**Gap:** ~34 percentage points across 56 source files below 90%

---

## Executive Summary

After reading every source file below 80% coverage, I've decomposed the work into **25 sub-issues** organized by dependency chain, domain coupling, and difficulty. Each sub-issue is independently shippable as a PR. Total estimated effort: **~748 test cases across 49 new/enhanced test files**.

The key insight: the codebase has a clear dependency hierarchy. Hooks and utilities underpin components, contexts underpin pages. Testing bottom-up (hooks → contexts → components → pages) avoids brittle mocks and produces the most reusable test infrastructure.

---

## Sub-Issue Dependency Graph

```
SI-1 (Hooks/Utils)  ──→  SI-3 (Settings Panes)
        │                        │
        ├──→  SI-4 (Goal Components)
        │            │
        │            ├──→  SI-5 (Goal Page)
        │
        ├──→  SI-6 (Budget Components)
        │            │
        │            ├──→  SI-7 (Budget Hooks + Sync)
        │
        ├──→  SI-8 (Data Page Components)
        │            │
        │            ├──→  SI-9 (Data Page)
        │
SI-2 (Contexts)  ──→  SI-9, SI-10
        │
        └──→  SI-10 (Pages: Home, Drive, Taxes, Tools, App)
```

---

## Sub-Issue 1: Foundation — Hooks & Small Utilities

**Scope:** Pure hooks and tiny components with zero/minimal dependencies. These are used by many components, so testing them first eliminates the need to mock them downstream.

| File | Current % | Target % | LOC | Est. Tests |
|------|-----------|----------|-----|------------|
| `src/hooks/useFocusTrap.ts` | 46.66% | 95% | 39 | 6 |
| `src/hooks/useTouchDrag.ts` | 29.09% | 90% | 127 | 13 |
| `src/components/TermAbbr.tsx` | 16.66% | 95% | ~30 | 4 |
| `src/components/Icons.tsx` (goal) | 50% | 95% | 20 | 3 |
| `src/pages/settings/index.ts` | 0% | 90% | ~10 | 2 |

**New test files:** 3 (`useFocusTrap.test.ts`, `useTouchDrag.test.ts`, `TermAbbr.test.tsx`)
**Enhanced test files:** 0
**Total new tests:** ~30
**Dependencies:** None
**Effort:** S (2-3 hours)
**Owner:** Ellis

### Key test cases:

**useFocusTrap.ts (6 tests):**
1. `focuses the first focusable element inside the container when isOpen transitions to true`
2. `wraps Tab focus from last focusable element back to the first`
3. `wraps Shift+Tab focus from first focusable element back to the last`
4. `does nothing when container has zero focusable elements`
5. `restores focus to the previously focused element when isOpen transitions to false`
6. `ignores keydown events that are not Tab`
7. `it('sets tabindex="-1" on the container when used as focus fallback')`
8. `it('prevents Tab from leaving the container when only one focusable element exists')`

**useTouchDrag.ts (13 tests):**
1. `returns isDragging=false and isLongPressing=false initially`
2. `triggers haptic feedback (navigator.vibrate) after 150ms of touch hold`
3. `sets isLongPressing=true after the configured longPressMs (default 300ms)`
4. `sets isDragging=true and provides dragIdx after longPressMs threshold`
5. `cancels long-press detection if touchEnd fires before threshold`
6. `cancels long-press detection if touch moves more than 10px before threshold`
7. `calls onDragEnd with source and target indices on touchEnd during active drag`
8. `prevents default touchMove when isDragging to stop page scroll`
9. `sets touchAction style on the container element during drag`
10. `cleans up timers on unmount to prevent memory leaks`
11. `it('distinguishes between the 150ms feedback timer and the 300ms drag activation timer (two-tier system)')`
12. `it('sets touchAction CSS property on the drag element during active drag')`
13. `it('does not fire onDragEnd if touch moved but long-press never activated')`

**Testing challenges:**
- `useTouchDrag`: Mock `navigator.vibrate()`, create synthetic TouchEvent objects with `touches[0].clientX/Y`, use `vi.useFakeTimers()` + `vi.advanceTimersByTime()` for the 150ms/300ms thresholds
- `useFocusTrap`: Render a container with multiple focusable elements (`<button>`, `<input>`, `<a>`), dispatch KeyboardEvent for Tab/Shift+Tab, assert `document.activeElement`
- **Timer cleanup:** All tests using `vi.useFakeTimers()` must call `vi.useRealTimers()` in `afterEach` to prevent timer leaks across tests
- **Shared mock:** Add `makeTouchEvent(clientX, clientY)` to `src/test/mockHelpers.ts` — reused by GoalsMiniGrid (SI-09)

---

## Sub-Issue 2: Context Providers — Encryption, ImportExport, GitHubSync, BudgetSync, TaxSync

**Scope:** Context providers that wrap the entire app. These have existing test files with partial coverage. Enhancement needed, not creation.

| File | Current % | Target % | LOC | Est. Tests |
|------|-----------|----------|-----|------------|
| `src/contexts/EncryptionContext.tsx` | 50% | 90% | ~230 | 10 |
| `src/contexts/ImportExportContext.tsx` | 32.53% | 90% | 156 | 16 |
| `src/contexts/GitHubSyncContext.tsx` | 19.35% | 85% | 468 | 18 |
| `src/contexts/BudgetSyncContext.tsx` | 56.89% | 90% | 77 | 5 |
| `src/contexts/TaxSyncContext.tsx` | 50% | 90% | 116 | 8 |

**New test files:** 0
**Enhanced test files:** 5
**Total new tests:** ~58
**Dependencies:** SI-1 (useFocusTrap used by some context consumers)
**Effort:** L (8-10 hours)
**Owner:** Ellis

### Key test cases:

**EncryptionContext.tsx (10 new tests, adding to existing 17):**
1. `renders children in unlocked state after successful setup with a passphrase`
2. `renders UnlockScreen when encryption is enabled but not unlocked`
3. `throws an error when useEncryption is called outside EncryptionProvider`
4. `persists lock state across provider remounts via localStorage`
5. `decrypts all sensitive keys from appStorage on successful unlock`
6. `re-encrypts all 13 sensitive keys when passphrase is changed`
7. `clears cryptoKey from memory when lock() is called`
8. `strips encrypted data and restores plaintext when encryption is disabled`
9. `handles corrupted encrypted data gracefully during unlock (shows error, doesn't crash)`
10. `calls migratePlaintext on first mount when unencrypted sensitive data exists`
11. `it('auto-locks after the configured inactivity timeout')`

**ImportExportContext.tsx (16 new tests, adding to existing ~5):**
1. `handleExport creates a JSON file containing all 16 data domains (goals, accounts, balances, profile, settings, budget, tax, allocation)`
2. `handleExport includes exportVersion: 2 and exportedAt timestamp in the payload`
3. `handleExport creates a downloadable blob URL and triggers anchor click`
4. `handleImport reads a File via FileReader and parses the JSON payload`
5. `handleImport calls validateImportPayload and rejects invalid files with an alert`
6. `handleImport restores goals via GoalsContext.importGoals()`
7. `handleImport restores gwGoals via GoalsContext.setGwGoals()`
8. `handleImport restores settings, profile, and budget data to appStorage`
9. `handleImport dispatches a "data-changed" CustomEvent after successful import`
10. `handleImport reloads the page after restoring all data`
11. `handleFactoryReset clears localStorage completely and reloads`
12. `handleExport excludes undefined/null optional fields from the payload`
13. `it('includes tax store and tax templates in the export payload')`
14. `it('handles FileReader.onerror by surfacing an import error')`
15. `it('waits 200ms after import before reloading the page')`
16. `it('passes rawText.length as second argument to validateImportPayload')`

**GitHubSyncContext.tsx (24 new tests, adding to existing ~5):**
1. `exposes syncNow, syncDataNow, syncToolsNow, syncAllocationNow methods`
2. `ghDataToSync memoization excludes exportedAt, goalViewMode, and homeCardOrder`
3. `syncNow calls useGitHubSync.upload with serialized JSON for each dirty domain`
4. `marks domain as dirty when data-changed event fires for that domain`
5. `auto-sync triggers after 60 seconds when a domain is marked dirty`
6. `restore downloads JSON from GitHub and calls validateImportPayload before applying`
7. `restore rejects payloads that fail validation and surfaces error`
8. `setGitHubToken encrypts the token via crypto.encryptString before storing`
9. `getGitHubToken decrypts the stored encrypted token`
10. `clearGitHubToken removes the encrypted token from localStorage`
11. `syncProgress tracks completion percentage across domains`
12. `syncErrors collects and exposes per-domain error messages`
13. `restore merges goals from GitHub with local goals (deduplication by id)`
14. `tools sync uploads/downloads feature-flags.json correctly`
15. `allocation sync round-trips custom ratios through JSON serialization`
16. `handles network errors during sync gracefully (sets error state, no crash)`
17. `skips sync when no token is configured`
18. `skips sync when config.repo is not set`
19. `it('waits 500ms between domain syncs to avoid GitHub API rate limiting')`
20. `it('syncs taxes domain when "taxes-changed" custom event fires')`
21. `it('syncs budget domain when "budget-changed" custom event fires')`
22. `it('forceFull parameter bypasses dirty-flag check and syncs all domains')`
23. `it('aggregates per-domain errors into syncErrors state')`
24. `it('handles restore backfill logic with nested fallbacks for missing data')`

**Testing challenges:**
- `GitHubSyncContext`: Largest context (468 LOC). Mock `useGitHubSync` hook (returns upload/download/list methods), mock `appStorage`, mock `crypto.encryptString/decryptString`, mock `window.addEventListener` for custom events. Use `vi.useFakeTimers()` for auto-sync debounce. The 500ms inter-domain delay means tests need to advance timers by `500 * numDomains` for a full sync test.
- `ImportExportContext`: Mock `FileReader` API, mock `URL.createObjectURL/revokeObjectURL`, mock `document.createElement('a')`
- `EncryptionContext`: Already uses `fake-indexeddb/auto`. Need to mock `crypto.deriveKey` for faster tests. Read existing 17 tests first to avoid duplicating tests #1-#3.

> **QA Note (SI-03):** Effort revised from L to L+ (10-12h). Owner: Ellis. MSW (already in devDependencies) should be used for GitHub API mocking instead of manual `vi.fn()` fetch mocks — provides more realistic request/response testing.

---

## Sub-Issue 3: Settings Panes

**Scope:** All settings modal panes. These are isolated components receiving props from SettingsModal.

| File | Current % | Target % | LOC | Est. Tests |
|------|-----------|----------|-----|------------|
| `src/pages/settings/components/GitHubSyncPane.tsx` | 0.87% | 90% | 505 | 24 |
| `src/pages/settings/components/AdvancedPane.tsx` | 6.66% | 90% | ~105 | 8 |
| `src/pages/settings/components/AppearancePane.tsx` | 25% | 95% | 45 | 4 |
| `src/pages/settings/components/LabsPane.tsx` | 10% | 90% | ~51 | 6 |
| `src/pages/settings/components/ProfilePane.tsx` | 32.72% | 90% | 258 | 12 |
| `src/pages/settings/SettingsModal.tsx` | 60% | 90% | 180 | 8 |
| `src/pages/settings/SettingsMenu.tsx` | 71.42% | 90% | 85 | 4 |

**New test files:** 5 (`GitHubSyncPane.test.tsx`, `AdvancedPane.test.tsx`, `AppearancePane.test.tsx`, `LabsPane.test.tsx`, `ProfilePane.test.tsx`)
**Enhanced test files:** 2 (`SettingsModal.test.tsx`, `SettingsMenu.test.tsx` — exists but not found, may need creation)
**Total new tests:** ~66
**Dependencies:** SI-1 (useFocusTrap), SI-2 (EncryptionContext for SecurityPane integration)
**Effort:** L (8-10 hours)
**Owner:** Quinn (SI-04) | Ellis (SI-05, SI-06)

### Key test cases:

**GitHubSyncPane.tsx (24 tests) — most complex settings pane:**
1. `renders the GitHub token input field in masked mode by default`
2. `toggles token visibility when the show/hide button is clicked`
3. `calls onSetToken with the entered value when Save is clicked`
4. `displays "Connected" status badge when sync config has a valid token`
5. `displays "Not connected" status when no token is configured`
6. `renders the repository input field with owner/repo format`
7. `calls onSetRepo when the repository name is saved`
8. `displays last sync timestamp when sync history exists`
9. `shows sync error message when last sync failed`
10. `calls onSyncNow when the Sync Now button is clicked`
11. `disables Sync Now button when sync is in progress`
12. `renders progress bar during active sync with percentage`
13. `calls onRestore when the Restore from GitHub button is clicked`
14. `shows confirmation dialog before restore operation`
15. `displays domain checkboxes for selective sync (data, goals, tools, allocation, taxes)`
16. `calls onClearToken when Disconnect is clicked and confirmed`
17. `validates repo format (must contain slash) before saving`
18. `shows auto-sync toggle and calls onSetAutoSync when toggled`
19. `it('shows "Already up to date" banner when sync completes with zero changes')`
20. `it('auto-dismisses sync success banner after 3 seconds')`
21. `it('lazy-loads sync history when History tab is first clicked')`
22. `it('shows warning box when sync results contain warnings')`
23. `it('renders all 6 domain progress items (goals, data, tools, allocation, taxes, budget)')`
24. `it('handles passphrase-required flow for token encryption')`

**ProfilePane.tsx (12 tests):**
1. `renders profile name and birthday in view mode`
2. `switches to edit mode when Edit Profile is clicked`
3. `shows name and birthday input fields in edit mode`
4. `saves updated profile data when Save is clicked`
5. `reverts to original values when Cancel is clicked`
6. `displays avatar image when avatarDataUrl is present in profile`
7. `shows placeholder SVG when no avatar is set`
8. `uploads avatar via FileReader when a file is selected`
9. `renders partner section when profile.partner exists`
10. `allows editing partner name and birthday`
11. `shows success flash for 2 seconds after saving`
12. `uploads partner avatar independently from primary avatar`

**Testing challenges:**
- `GitHubSyncPane`: 505 lines, the largest pane. All logic is prop-driven (no context dependency), so mocking is straightforward but verbose — 14+ prop callbacks to mock.
- `ProfilePane`: Mock `FileReader` API for avatar upload. Use `vi.useFakeTimers()` for success flash timeout.
- `AppearancePane`: Simplest pane — 4 tests for dark/light mode toggle and CSS class verification.

---

## Sub-Issue 4: Goal Components (Low Coverage)

**Scope:** Goal-specific components that are 0-30% covered. These depend on GoalsContext and data types.

| File | Current % | Target % | LOC | Est. Tests |
|------|-----------|----------|-----|------------|
| `src/pages/goal/components/GoalMixer.tsx` | 2.81% | 90% | ~200 | 10 |
| `src/pages/goal/components/GwSection.tsx` | 3.22% | 90% | 648 | 28 |
| `src/pages/goal/components/GoalDiveDeep.tsx` | 5.33% | 90% | ~245 | 14 |
| `src/pages/goal/components/SavingsPlan.tsx` | 9.09% | 90% | ~244 | 12 |
| `src/pages/goal/components/GoalCompareView.tsx` | 11.94% | 90% | ~170 | 8 |
| `src/pages/goal/components/GoalCardActions.tsx` | 20% | 90% | ~22 | 4 |
| `src/pages/goal/components/GoalsMiniGrid.tsx` | 22.27% | 90% | 375 | 21 |

**New test files:** 7
**Enhanced test files:** 0
**Total new tests:** ~97
**Dependencies:** SI-1 (useTouchDrag for GoalsMiniGrid)
**Effort:** XL (12-15 hours)
**Owner:** Quinn (SI-07, SI-09) | Sam (SI-08)

### Key test cases:

**GwSection.tsx (27 tests) — 648 lines, second-largest goal component:**
1. `renders "Add GW Goal" button when no GW goals exist`
2. `renders list of existing GW goals with name, target, and current amount`
3. `opens the add-goal form when "Add GW Goal" is clicked`
4. `validates goal name is not empty before allowing save`
5. `validates target amount is a positive number`
6. `saves a new GW goal with name, target, targetDate, and accountIds`
7. `opens edit form pre-populated with existing goal data when Edit is clicked`
8. `updates an existing GW goal when the edit form is saved`
9. `shows delete confirmation when Delete button is clicked`
10. `deletes the goal when confirmation is accepted`
11. `cancels deletion when confirmation is dismissed`
12. `calculates progress percentage as (currentTotal / target) * 100`
13. `links accounts to a GW goal via multi-select dropdown`
14. `displays linked account names as pills/tags below the goal`
15. `unlinks an account when its pill X button is clicked`
16. `computes currentTotal by summing latest balances of linked accounts`
17. `shows 0% progress when no accounts are linked`
18. `shows completion badge when progress >= 100%`
19. `renders target date in human-readable format`
20. `it('shows 10-second undo countdown after deleting a GW goal')`
21. `it('validates disbursement age is greater than current age')`
22. `it('validates growth rate is between 0.1% and 50%')`
23. `it('calculates present value using compound monthly growth adjusted for inflation')`
24. `it('toggles between Creation and Disbursement dollar views')`
25. `it('computes age at creation from profile birthday')`
26. `it('clamps progress percentage between 0 and 100')`
27. `it('offers "Copy from existing goal" option in empty state')`

**GoalsMiniGrid.tsx (20 tests):**
1. `renders a grid of GoalMiniCard components for each goal`
2. `renders list layout when viewMode is "list"`
3. `opens context menu at click position on right-click`
4. `context menu shows Rename, Duplicate, Delete options`
5. `calls onRenameGoal when rename is committed via Enter key`
6. `cancels rename and reverts text when Escape is pressed`
7. `calls onCopyGoal when Duplicate is selected from context menu`
8. `calls onDeleteGoal when Delete is selected from context menu`
9. `completes full HTML5 drag lifecycle on desktop: start → over → drop → calls onReorderGoals with new order`
10. `updates dragOver state when dragging over a different card`
11. `announces reorder to screen readers via aria-live region`
12. `shows mobile move-up button for all cards except the first`
13. `shows mobile move-down button for all cards except the last`
14. `closes context menu when clicking outside`
15. `it('applies ".goal-drag-item--long-press" CSS class during touch long-press feedback phase')`
16. `it('applies drag-before/drag-after indicator classes on the drop target')`
17. `it('prevents context menu from opening after a touch drag gesture (touchMovedFlag)')`
18. `it('disables move-up button on the first card and move-down on the last card')`
19. `it('supports multi-select mode when compareMode is active')`
20. `it('handles rename on blur (saves) and Escape (cancels)')`

**GoalMixer.tsx (10 tests):**
1. `renders the mixer modal with a list of available goals`
2. `shows checkboxes for each goal to include in the mix`
3. `disables the "Mix" button when fewer than 2 goals are selected`
4. `generates a combined trajectory when Mix is clicked with 2+ goals`
5. `displays combined total in the summary header`
6. `shows individual goal contributions as stacked segments`
7. `calls onSaveMix with the combined goal data when Save is clicked`
8. `calls onClose when Cancel is clicked`
9. `excludes already-mixed goals from the available list`
10. `recalculates combined trajectory when selection changes`

**GoalDiveDeep.tsx (14 tests):**
1. `renders the dive deep analysis for a given goal`
2. `projects correct FI date given known balance, contribution, and growth rate`
3. `handles edge case where current balance already exceeds FI target`
4. `displays projected growth chart with correct data points`
5. `shows sensitivity analysis for growth rate variations`
6. `calculates contribution impact on FI date`
7. `handles zero balance starting point`
8. `handles zero contribution rate`
9. `formats projected dates correctly`
10. `updates projections when input parameters change`
11. `shows breakdown of growth vs contribution over time`
12. `handles negative growth rate scenarios`
13. `displays monthly vs annual contribution toggle`
14. `validates projection against fixture data with pre-calculated expected outputs`

**SavingsPlan.tsx (12 tests):**
1. `renders savings plan with target amount and timeline`
2. `calculates required monthly contribution to meet target`
3. `shows progress bar based on current vs target savings`
4. `displays milestone markers along the timeline`
5. `recalculates projections when contribution amount changes`
6. `handles zero monthly contribution gracefully (shows "no savings plan")`
7. `updates timeline when target date is changed`
8. `shows surplus/deficit against the savings plan`
9. `handles completed savings plans (100%+ progress)`
10. `formats currency amounts correctly`
11. `accounts for existing balance in projection`
12. `displays monthly breakdown table`

**Testing challenges:**
- `GwSection`: 648 lines. Needs mock for `useData()` (accounts, balances), goal CRUD callbacks, account linking state. Multiple form validations. The 10-second undo countdown requires `vi.useFakeTimers()`.
- `GoalsMiniGrid`: Dual drag systems (HTML5 + touch). Mock `useTouchDrag` hook, mock drag events (`DragEvent`, `TouchEvent`), mock `document.elementFromPoint` for drop target detection. Reuse `makeTouchEvent` from SI-01 shared mock.
- `GoalDiveDeep` and `SavingsPlan`: Financial projection logic with compound calculations. Use fixture data with known expected outputs. Test data transformation functions as pure unit tests where possible.

---

## Sub-Issue 5: Goal Page & Moderate Coverage Goal Components

**Scope:** The Goal.tsx page component and goal components in the 40-80% range.

| File | Current % | Target % | LOC | Est. Tests |
|------|-----------|----------|-----|------------|
| `src/pages/goal/Goal.tsx` | 42.3% | 90% | 210 | 10 |
| `src/pages/goal/hooks/useFinancialGoals.ts` | 60% | 90% | 38 | 4 |
| `src/pages/goal/hooks/useGwGoals.ts` | 47.91% | 90% | ~70 | 6 |
| `src/pages/goal/components/GoalDetailedCard.tsx` | 61.41% | 90% | 600+ | 17 |
| `src/pages/goal/components/GoalFilterBar.tsx` | 50% | 90% | 220 | 8 |
| `src/pages/goal/components/GoalForm.tsx` | 57.03% | 90% | ~480 | 14 |
| `src/pages/goal/components/GoalMiniCard.tsx` | 57.57% | 90% | 110 | 5 |
| `src/pages/goal/components/GoalsSection.tsx` | 82% | 90% | 210 | 4 |

**New test files:** 1 (`Goal.test.tsx`)
**Enhanced test files:** 7
**Total new tests:** ~70
**Dependencies:** SI-4 (GoalMixer, GwSection, etc. tested first)
**Effort:** XL (10-12 hours)
**Owner:** Quinn (SI-10) | Sam (SI-11) | Ellis (SI-12)

### Key test cases:

**Goal.tsx (10 tests):**
1. `renders the Plans tab as active by default at /goal route`
2. `renders the Calculator tab when navigated to /goal/calculator`
3. `renders GoalDetail when navigated to /goal/:id with a valid goal id`
4. `shows "Goal not found" message when navigated to /goal/:id with invalid id`
5. `opens GoalFormModal in create mode when "New Goal" button is clicked`
6. `opens GoalFormModal in edit mode when a goal's edit action is triggered`
7. `opens GoalFormModal in copy mode with pre-filled data from the source goal`
8. `opens GoalMixer modal when "Mix Goals" is clicked`
9. `lazy-loads FICalculator with Suspense fallback on Calculator tab`
10. `passes correct GW goal CRUD callbacks to GoalDetail`

**GoalDetailedCard.tsx (17 new tests, adding to existing):**
1. `renders goal name, FI target amount, and retirement age`
2. `calculates projected FI date using compound growth from linked account balances`
3. `shows "On Track" trajectory status when projected date <= target date`
4. `shows "Behind" trajectory status when projected date > target date`
5. `displays annual and monthly expense views when toggled`
6. `renders depletion analysis showing years the portfolio sustains withdrawals`
7. `suggests optimal SWR when current SWR leads to premature depletion`
8. `switches between creation-phase and retirement-phase expense views`
9. `enters edit mode when Edit button is clicked`
10. `validates that retirement age > current age before saving`
11. `validates that FI target is a positive number`
12. `saves edited goal data and exits edit mode on Save`
13. `reverts to original data when Cancel is clicked during edit`
14. `renders TrajectorySparkline with correct projected data points`
15. `displays save rate from budget data when available`
16. `it('handles NaN gracefully when linked account balances are undefined')`
17. `it('displays correct currency formatting for all monetary amounts')`

**GoalForm.tsx (14 new tests, adding to existing):**
1. `validates all required fields before enabling Save`
2. `pre-fills form with existing goal data in edit mode`
3. `clears form when switching from edit to create mode`
4. `validates that goal name is not empty`
5. `validates target amount is a positive number`
6. `validates retirement age is reasonable (18-100)`
7. `shows account multi-select for linking accounts to goal`
8. `saves goal with all fields populated on submit`
9. `calls onCancel and resets form on Cancel click`
10. `shows type-specific fields based on goal type (FI vs GW)`
11. `handles date picker for target date`
12. `disables Save button while form is invalid`
13. `shows validation errors inline next to invalid fields`
14. `handles concurrent edits (two users editing same goal)`

**Testing challenges:**
- `Goal.tsx`: Mock React Router (`useLocation`, `useNavigate`, `useParams`), mock `useGoals()` context (15+ methods), mock `useLayout()`, mock lazy-loaded `FICalculator`. Use `MemoryRouter` with `initialEntries` for route testing.
- `GoalDetailedCard.tsx`: 600+ lines, heaviest test burden. Complex financial math needs fixture data with pre-calculated expected outputs. Mock `useData()`, `getBudgetSaveRate()`, and date utilities.

---

## Sub-Issue 6: Budget Components

**Scope:** Budget UI components. These receive data from useBudget hook.

| File | Current % | Target % | LOC | Est. Tests |
|------|-----------|----------|-----|------------|
| `src/pages/budget/components/ManualTransactionEntry.tsx` | 28.02% | 90% | 351 | 15 |
| `src/pages/budget/components/BudgetHeader.tsx` | 30.76% | 90% | 193 | 10 |
| `src/pages/budget/components/BudgetTable.tsx` | 0% (untested) | 85% | 733 | 26 |
| `src/pages/budget/components/BudgetAggregatedView.tsx` | 0% (untested) | 90% | 170 | 8 |
| `src/pages/budget/components/CSVPreviewModal.tsx` | 0% (untested) | 90% | 115 | 6 |
| `src/pages/budget/components/CashflowBarChart.tsx` | 0% (untested) | 85% | 145 | 5 |
| `src/pages/budget/components/CashflowSankey.tsx` | 0% (untested) | 80% | 320+ | 8 |
| `src/pages/budget/components/CategoryGroupManager.tsx` | 0% (untested) | 85% | 400+ | 17 |

**New test files:** 8
**Enhanced test files:** 0
**Total new tests:** ~97
**Dependencies:** None (all prop-driven)
**Effort:** XL (12-15 hours)
**Owner:** Quinn (SI-13) | Ellis (SI-14) | Sam (SI-15)

### Key test cases:

**BudgetTable.tsx (26 tests) — 733 LOC:**
1. `renders all budget categories as rows with month columns`
2. `sorts categories by amount descending by default`
3. `toggles sort direction when a column header is clicked`
4. `sorts by date column when date header is clicked`
5. `expands a month to show individual transactions when month cell is clicked`
6. `shows transaction detail rows with date, description, amount, category`
7. `filters categories by name when filter input text is entered`
8. `shows CSV upload error banner when CSV parsing fails`
9. `dismisses CSV error banner when close button is clicked`
10. `calls onUploadCSV when a CSV file is dropped onto the table`
11. `calls onRemoveCSV when month's delete button is clicked`
12. `shows confirmation dialog before removing a month's CSV`
13. `shows context menu on right-click with Edit Category option`
14. `opens inline category editor when Edit Category is selected`
15. `saves new category assignment when category is changed and confirmed`
16. `calls onEditCategory with old and new category names`
17. `toggles percentage display mode when % button is clicked`
18. `shows removed/hidden categories when "Show removed" toggle is on`
19. `handles drag-and-drop file upload with visual drop zone indicator`
20. `displays correct totals row at bottom summing all category amounts`
21. `it('classifies categories as income or expense based on "ANY negative month = expense" rule')`
22. `it('renders "Removed from Budget" categories only when "Show Removed" toggle is on')`
23. `it('supports quarter/half/month time period bucketing')`
24. `it('computes group-level subtotals that cascade correctly')`
25. `it('handles refunds (positive amounts in expense categories) without crashing')`
26. `it('auto-clears CSV error toast after 5 seconds')`

**ManualTransactionEntry.tsx (15 tests):**
1. `renders collapsed form by default with "Add Transaction" button`
2. `expands form when "Add Transaction" is clicked`
3. `shows date, description, amount, and category input fields`
4. `pre-fills date with today's date in ISO format`
5. `shows category dropdown when category input is focused`
6. `filters category options as the user types in the combobox`
7. `selects a category with keyboard arrow keys and Enter`
8. `closes category dropdown on Escape key`
9. `closes category dropdown when Tab is pressed`
10. `validates that description is not empty before submission`
11. `validates that amount is a valid number`
12. `calls onAdd with monthKey and CSV-formatted line on valid submission`
13. `escapes commas and quotes in description for CSV safety`
14. `shows success flash notification for 1.5 seconds after adding`
15. `clears form fields after successful submission`

**CategoryGroupManager.tsx (17 tests):**
1. `renders all category groups with their categories listed`
2. `expands a group to show its categories when clicked`
3. `collapses an expanded group when clicked again`
4. `enters rename mode when group name is double-clicked`
5. `saves group rename on Enter key`
6. `cancels group rename on Escape key`
7. `drags a category from one group to another`
8. `calls onUpdate with new group assignment after drag-drop`
9. `enters merge mode when Merge Categories is clicked`
10. `selects categories for merge via checkboxes`
11. `shows merge target name input after categories are selected`
12. `calls onMerge with selected category names and target name`
13. `shows delete confirmation when category delete is clicked`
14. `prompts for merge target when deleting a category with existing transactions`
15. `does not allow renaming protected groups (Others, Removed)`
16. `it('prevents merging into a protected group name (Others, Removed)')`
17. `it('shows visual drag indicator when dragging a category over a group')`

**Testing challenges:**
- `BudgetTable`: 733 LOC, heaviest budget component. Needs comprehensive mock data: `categoryGroups`, `monthlySums`, `transactions` map. Mock drag events for file upload. Mock context menu positioning.
- `CashflowSankey`: Custom SVG layout engine. **Do not use snapshot tests for SVG** — they are brittle. Instead test the data transformation layer (node positions, flow widths) as pure unit tests, and assert correct number of SVG `<path>` and `<rect>` elements for a given dataset.
- `CategoryGroupManager`: Drag-and-drop between groups needs synthetic DragEvent with dataTransfer. 9 state variables to manage.

---

## Sub-Issue 7: Budget Hooks & Sync Utilities

**Scope:** Budget data layer — hooks that manage state and sync utilities.

| File | Current % | Target % | LOC | Est. Tests |
|------|-----------|----------|-----|------------|
| `src/pages/budget/hooks/useBudget.ts` | 0% (untested) | 85% | 390 | 27 |
| `src/pages/budget/hooks/useCSVUpload.ts` | 0% (untested) | 90% | 130+ | 10 |
| `src/pages/budget/utils/budgetGitHubSync.ts` | 2.5% | 85% | 200+ | 12 |
| `src/pages/budget/Budget.tsx` | 72.72% | 90% | 215 | 6 |
| `src/pages/budget/utils/csvParser.ts` | 73.24% | 90% | ~255 | 8 |

**New test files:** 3 (`useBudget.test.ts`, `useCSVUpload.test.ts`, `budgetGitHubSync.test.ts`)
**Enhanced test files:** 2 (`Budget.test.tsx`, `csvParser.test.ts`)
**Total new tests:** ~63
**Dependencies:** SI-6 (component tests validate data flow from hooks)
**Effort:** XL (12-15 hours)
**Owner:** Drew (SI-16) | Ellis (SI-24)

### Key test cases:

**useBudget.ts (27 tests):**
1. `returns empty store, transactions map, and category groups on initial load with no saved data`
2. `loads existing budget store from budgetStorage on mount`
3. `parses uploaded CSV and creates transactions for the given month key`
4. `auto-discovers new categories from uploaded CSV and adds to global category groups`
5. `assigns unknown categories to the "Others" group`
6. `computes yearTransactions by aggregating all months for the selected year`
7. `computes categorySums correctly: positive = income, negative = expense`
8. `computes monthly summary (totalIncome, totalExpense, netCashflow) per month`
9. `saves budget summary to storage whenever it changes`
10. `removes CSV for a month and clears its transactions`
11. `creates a new year entry in the budget store`
12. `edits a transaction category in-place by modifying the CSV field`
13. `persists category group changes via updateGlobalCategoryGroups`
14. `handles CSV with extra/missing columns gracefully`
15. `merges categories across all months when merge is invoked`
16. `recalculates allCategories when a new CSV is uploaded`
17. `returns the correct year list from the store`
18. `selects the current year by default`
19. `dispatches "data-changed" event with domain "budget" after uploads`
20. `handles malformed CSV lines without crashing (logs warning)`
21. `it('mergeCategories rewrites CSV lines across all months and consolidates groups')`
22. `it('categoryHasTransactions returns true only for categories with existing CSV data')`
23. `it('handles CSV fields with embedded commas inside quotes')`
24. `it('auto-creates "Others" group when it does not exist')`
25. `it('computes annual savings rate as (income - expenses) / income')`
26. `it('applyConfig merges years and replaces groups during GitHub restore')`
27. `it('detects and skips CSV header rows')`

**budgetGitHubSync.ts (12 tests):**
1. `uploadBudgetCSV creates a file at the correct GitHub path with base64 content`
2. `uploadBudgetCSV includes SHA in the request body when updating an existing file`
3. `uploadBudgetCSV retries up to 3 times on 409 conflict error`
4. `listBudgetCSVs returns file list from the GitHub repository budget directory`
5. `downloadBudgetCSV fetches and base64-decodes file content`
6. `downloadAllBudgetCSVs downloads all CSVs listed by listBudgetCSVs`
7. `syncAllBudgetCSVs uploads only months that differ from the remote`
8. `uploadBudgetConfig uploads the config JSON to the repo root`
9. `downloadBudgetConfig downloads and parses the config JSON`
10. `handles 404 response when the budget directory does not exist yet`
11. `handles network errors gracefully and surfaces error messages`
12. `passes authorization header with Bearer token on all requests`

**Testing challenges:**
- `useBudget`: Use `renderHook` from testing-library. Mock `loadBudgetStore`, `saveBudgetStore`, `saveCSVForMonth`, `deleteCSVForMonth`, `createYear`, `getGlobalCategoryGroups`, `updateGlobalCategoryGroups`. The hook has deeply nested memoized computations — test by providing different CSV data and asserting computed outputs.
- `budgetGitHubSync`: Mock global `fetch` with `vi.fn()`. Create fixture responses for GitHub API. Test retry logic with `vi.useFakeTimers()`.
- `useCSVUpload`: Mock `FileReader` with a custom class that calls `onload` synchronously. Mock queue processing.

---

## Sub-Issue 8: Data Page Components (AccountsModal, BalanceSpreadsheet, BalanceCharts, AccountForm)

**Scope:** Net Worth page's heavy sub-components.

| File | Current % | Target % | LOC | Est. Tests |
|------|-----------|----------|-----|------------|
| `src/pages/data/AccountsModal.tsx` | 23.34% | 85% | 988 | 31 |
| `src/pages/data/BalanceSpreadsheet.tsx` | 45.76% | 85% | 615 | 21 |
| `src/pages/data/BalanceCharts.tsx` | 63.46% | 90% | 380 | 10 |
| `src/pages/data/AccountForm.tsx` | 46.77% | 90% | 261 | 12 |

**New test files:** 3 (`AccountsModal.test.tsx`, `BalanceSpreadsheet.test.tsx`, `AccountForm.test.tsx`)
**Enhanced test files:** 1 (`BalanceCharts` — no existing test file, needs creation too)
**Total new tests:** ~74
**Dependencies:** SI-1 (useFocusTrap for AccountsModal)
**Effort:** XL (12-15 hours)
**Owner:** Quinn (SI-17) | Sam (SI-18)

### Key test cases:

**AccountsModal.tsx (31 tests) — 988 lines, second-largest component:**
1. `renders the account list sorted by group name with all columns visible`
2. `sorts accounts by clicking the Name column header (toggles asc/desc)`
3. `sorts accounts by clicking the Type column header`
4. `sorts accounts by clicking the Balance column header (numeric sort)`
5. `filters accounts by a specific column value when column filter chip is clicked`
6. `shows only active accounts when Active filter is applied`
7. `shows only inactive accounts when Inactive filter is applied`
8. `clears all column filters when "Clear filters" is clicked`
9. `selects a single account when its row is clicked`
10. `selects a range of accounts when Shift+click is used on two rows`
11. `toggles individual account selection with Ctrl/Cmd+click`
12. `select-all checkbox selects all visible (filtered) accounts`
13. `shows bulk edit toolbar when 2+ accounts are selected`
14. `bulk-updates goal type for all selected accounts from the dropdown`
15. `bulk-updates owner for all selected accounts`
16. `opens AccountForm in create mode when "Add Account" is clicked`
17. `opens AccountForm in edit mode when an account row's edit button is clicked`
18. `calls onDelete and removes the account when delete is confirmed`
19. `switches to Groups page when "Groups" tab is clicked`
20. `renders group list with account count per group on Groups page`
21. `creates a new group when name is entered and confirmed`
22. `renames a group inline when group name is double-clicked and Enter is pressed`
23. `deletes an empty group when delete is clicked and confirmed`
24. `assigns an account to a group via drag-and-drop on Groups page`
25. `closes modal when Escape key is pressed or overlay is clicked`
26. `it('sorts by column with three-state toggle: ascending → descending → none')`
27. `it('bulk-update toolbar shows 7 separate dropdowns (Goal, Type, Owner, Status, Nature, Allocation, Group)')`
28. `it('creates a "pending group" that is not confirmed until the user types a name')`
29. `it('handles ungrouped accounts separately from grouped accounts on the Groups page')`
30. `it('displays linked account name with chain icon for liability accounts')`
31. `it('traps focus inside the modal when open')`

**BalanceSpreadsheet.tsx (21 tests):**
1. `renders account columns and month rows in a scrollable grid`
2. `shows single accounts as individual columns`
3. `groups accounts by group name with expandable headers`
4. `expands a group to show child account columns when group header is clicked`
5. `collapses a group to show only the group total column`
6. `filters accounts by owner when owner filter is selected`
7. `filters accounts by goal type (FI/GW) when goal filter is applied`
8. `filters accounts by account type when type filter is applied`
9. `filters months by YTD preset (shows only current year months)`
10. `filters months by "Last 12 months" preset`
11. `filters months by "End of year" preset (December only)`
12. `filters months by custom date range (from/to month pickers)`
13. `enters inline edit mode when a balance cell is clicked`
14. `saves the edited balance value when Enter is pressed`
15. `cancels inline edit when Escape is pressed`
16. `calls onDeleteMonth when a month's delete button is clicked with confirmation`
17. `displays owner avatar with initials fallback next to account name`
18. `shows correct total row summing all visible account balances per month`
19. `it('renders group total as sum of child account balances, not as a separate data point')`
20. `it('handles months with missing balance data (shows empty cell, not zero)')`
21. `it('keyboard navigation between editable cells (Tab to next, Shift+Tab to previous)')`

**AccountForm.tsx (12 tests):**
1. `renders empty form fields when creating a new account (no initialData)`
2. `pre-fills form fields with account data when editing (initialData provided)`
3. `shows cascading type options based on selected goalType (FI shows different types than GW)`
4. `resets type to default when goalType is changed`
5. `shows group dropdown with existing groups and "Create new group" option`
6. `creates new group inline when "Create new group" is selected and name is entered`
7. `closes group dropdown when clicking outside`
8. `shows linked account selector only when nature is "liability"`
9. `hides linked account selector when nature is "asset"`
10. `validates that account name is not empty before allowing save`
11. `calls onSave with complete account data when form is submitted`
12. `shows owner dropdown with partner option when profile.partner exists`

**Testing challenges:**
- `AccountsModal`: Largest component needing tests (988 LOC). Create factory functions: `makeAccount({overrides})`, `makeGroup({overrides})`. Shift+click range selection needs careful DOM event simulation — select row 2, then Shift+click row 5, verify rows 2-5 are all selected. Group drag-drop needs DragEvent mocking. Use `within()` from testing-library for scoped queries inside the modal.
- `BalanceSpreadsheet`: 615 LOC with 6-dimensional filtering. Create a fixture generator that produces accounts across multiple groups, types, owners, and months. Test each filter independently, then test filter combinations.

---

## Sub-Issue 9: Data Page & Net Worth Integration

**Scope:** The Data.tsx orchestrator page and supporting components.

| File | Current % | Target % | LOC | Est. Tests |
|------|-----------|----------|-----|------------|
| `src/pages/data/Data.tsx` | 47.76% | 85% | 418 | 12 |
| `src/pages/home/GoalsPeek.tsx` | 73.8% | 90% | ~160 | 4 |

**New test files:** 0
**Enhanced test files:** 2 (`Data.test.tsx`, `GoalsPeek.test.tsx`)
**Total new tests:** ~16
**Dependencies:** SI-8 (AccountsModal, BalanceSpreadsheet, BalanceCharts all tested)
**Effort:** M (4-5 hours)
**Owner:** Ellis

### Key test cases:

**Data.tsx (12 new tests, adding to existing 3):**
1. `renders the Accounts tab as active by default`
2. `renders the Charts tab when navigated to /data/charts`
3. `renders the Allocation tab when navigated to /data/allocation`
4. `opens AccountsModal when "Manage Accounts" button is clicked`
5. `adds a new account via AccountsModal and updates both accounts and balances state`
6. `updates an existing account and calls saveBoth to persist`
7. `bulk-updates multiple accounts and persists all changes`
8. `deletes an account and removes its balance entries`
9. `imports accounts from CSV file via FileReader`
10. `exports accounts to CSV file with correct column format`
11. `handles inline balance entry edit and persists via saveBalances`
12. `deletes a month's balance entries across all accounts when deleteMonth is called`

**Testing challenges:**
- `Data.tsx`: Mock `useGoals()`, `useSettings()`, `useGitHubSync()`, `useData()` contexts. Mock CSV import/export utilities. Test the `saveBoth()` coordination pattern (accounts and balances saved together). Mock `FileReader` for CSV import.

---

## Sub-Issue 10: Remaining Pages (Home, Taxes, Drive, Tools, Allocation, App)

**Scope:** Full page components and the App shell.

| File | Current % | Target % | LOC | Est. Tests |
|------|-----------|----------|-----|------------|
| `src/pages/home/Home.tsx` | ~77% (dir) | 90% | 258 | 10 |
| `src/pages/taxes/Taxes.tsx` | 0% (untested) | 80% | 1033 | 30 |
| `src/pages/taxes/taxGitHubSync.ts` | 0% | 85% | 156 | 8 |
| `src/pages/drive/Drive.tsx` | 0% (untested) | 85% | 380 | 15 |
| `src/pages/drive/useDriveUpload.ts` | 0% (untested) | 85% | 160 | 8 |
| `src/pages/drive/CSVViewer.tsx` | 0% (untested) | 90% | 70 | 4 |
| `src/pages/tools/components/FICalculator.tsx` | 0% (untested) | 80% | 677 | 15 |
| `src/pages/tools/components/SavingsGrowthTracker.tsx` | 0% (untested) | 80% | 492 | 10 |
| `src/pages/tools/components/PdfToCsv.tsx` | 0% (untested) | 70% | 585 | 10 |
| `src/pages/allocation/Allocation.tsx` | 0% (untested) | 85% | 105 | 6 |
| `src/pages/allocation/components/*` | 0% (untested) | 85% | ~680 | 22 |
| `src/pages/allocation/hooks/*` | 0% (untested, except useGoals) | 85% | ~250 | 10 |
| `src/App.tsx` | not tracked | 80% | 200 | 10 |
| `src/components/SearchModal.tsx` | 0% (untested) | 85% | 305 | 14 |
| `src/components/UndoToast.tsx` | 0% (untested) | 95% | 32 | 3 |
| `src/components/SidebarToggle.tsx` | 0% (untested) | 95% | 15 | 2 |

**New test files:** 16
**Enhanced test files:** 2
**Total new tests:** ~177
**Dependencies:** SI-1 through SI-9 (this is the final tier — everything else is tested)
**Effort:** XXL (25-30 hours)
**Owner:** Quinn (SI-20, SI-23a) | Ellis (SI-21, SI-23b) | Sam (SI-22)

### Key test cases (selected highlights):

**Taxes.tsx (30 tests) — 1033 lines, largest component:**
1. `renders the tax checklist grouped by category (2025, 2024, Evergreen)`
2. `expands a category section when its header is clicked`
3. `collapses an expanded category when clicked again`
4. `uploads a file and associates it with a checklist item via IndexedDB`
5. `shows file name and size badge after successful upload`
6. `removes a file from a checklist item and deletes from IndexedDB`
7. `renames a checklist item when edit mode is activated and new name is saved`
8. `adds a new custom checklist item to a category`
9. `changes the active year and updates displayed checklist`
10. `shows empty state when no items exist for selected year`
11. `filters checklist items by search query`
12. `displays owner badge (Primary/Partner/Joint) per checklist item`
13. `changes item owner via dropdown`
14. `links an item to a specific account`
15. `shows storage estimate percentage when files are stored`
16. `supports multi-file upload via drag-and-drop`
17. `validates file size before upload (rejects files over limit)`
18. `persists checklist state to useTaxStore on changes`
19. `shows completion percentage for each category`
20. `auto-expands the first incomplete category on mount`
21. `it('shows 10-second undo countdown after deleting a checklist item with Cancel button')`
22. `it('validates file size (rejects files over 10MB limit) with error toast')`
23. `it('standardizes uploaded file name to "Owner_Label.ext" format')`
24. `it('shows "Replace" button text (not "Upload") when item already has a file')`
25. `it('auto-adds paystub items when creating a new tax year')`
26. `it('shows account suggestion modal filtered by owner and preventing duplicate links')`
27. `it('supports multiple files per checklist item')`
28. `it('blocks file uploads during migration')`
29. `it('handles base64 encoding for async IndexedDB storage')`
30. `it('shows joint vs single return options in tax return section menu')`

**Home.tsx (10 tests):**
1. `renders all 5 home cards in default order (NetWorth, Goals, Allocation, Setup, Budget)`
2. `loads saved card order from localStorage on mount`
3. `hides the Setup card when all onboarding steps are complete`
4. `shows the Budget card only when budget data exists`
5. `displays greeting based on time of day (Good morning/afternoon/evening)` — needs `vi.useFakeTimers()` + `vi.setSystemTime()`, document time boundaries (morning < 12, afternoon < 18, evening >= 18)
6. `reorders cards via HTML5 drag-and-drop and persists new order`
7. `shows mobile move-up/down buttons on narrow viewports`
8. `announces card reorder to screen readers via aria-live region`
9. `navigates to the correct page when a card's CTA link is clicked`
10. `renders the correct content in each card (summary data from contexts)`

**SearchModal.tsx (14 tests):**
1. `renders the search input focused when modal opens`
2. `shows search results grouped by category as the user types`
3. `highlights matching text ranges in result titles`
4. `navigates to the selected result when Enter is pressed`
5. `moves the active selection down when ArrowDown is pressed`
6. `moves the active selection up when ArrowUp is pressed`
7. `closes the modal when Escape is pressed`
8. `expands a result group when "Show all" is clicked`
9. `calls onAction with the correct command type for action results`
10. `shows empty state message when no results match the query`
11. `it('truncates non-expanded groups to show only 5 items')`
12. `it('updates active selection on mouse hover')`
13. `it('handles "action" results differently from "route" results on Enter')`
14. `it('renders correct icon from ICON_PATHS map for each result type')`

**Allocation page + components (combined 38 tests):**
- `Allocation.tsx`: 6 tests (renders tabs, passes data to children, goal editing workflow)
- `BreakdownSection.tsx`: 4 tests (scope tabs, legend toggle, empty state)
- `ChartHelpers.tsx`: 4 tests (DonutChart renders, Legend renders, RatioBar renders)
- `GoalEditor.tsx`: 6 tests (constant/gradual types, % validation, save/cancel)
- `GoalSection.tsx`: 4 tests (no goal → add, existing goal display, rebalance panel)
- `RatioBuilder.tsx`: 4 tests (add/remove groups, class assignment, max 6 groups)
- `RatioResult.tsx`: 4 tests (actual vs goal, variance coloring, gradual display)
- `RatioTabs.tsx`: 4 tests (tab selection, create from preset, delete confirmation)
- `RebalancePanel.tsx`: 8 tests (transfer algorithm, new money allocation, threshold filtering, zero-difference case, single-group portfolio)

**Drive.tsx (15 tests):**
1. `renders the file list from IndexedDB storage`
2. `uploads a file and stores it in IndexedDB`
3. `shows file name, size, and upload date for each file`
4. `deletes a file when delete is confirmed`
5. `opens CSV viewer when a CSV file is clicked`
6. `shows upload progress during file upload`
7. `handles multiple file uploads simultaneously`
8. `validates file type before upload`
9. `sorts files by date (newest first)`
10. `shows storage usage estimate`
11. `shows breadcrumb navigation for nested folder paths`
12. `handles file download from IndexedDB`
13. `empty folder shows "No files" state`
14. `drag-and-drop file upload with visual indicator`
15. `truncates long file names with ellipsis`

**FICalculator.tsx (15 tests):**
1. `renders input fields for current balance, contribution, growth rate, and target`
2. `calculates projected FI date from given inputs`
3. `updates projection chart when input values change`
4. `shows milestone markers at 25%, 50%, 75%, 100%`
5. `handles different contribution frequencies (monthly, annual)`
6. `accounts for inflation in projections`
7. `shows sensitivity analysis for growth rate ranges`
8. `exports projection data as CSV`
9. `loads default values from linked accounts`
10. `handles edge case where retirement age equals current age`
11. `shows loading state during heavy projection calculation`
12. `validates input fields before running simulation (negative values, NaN)`
13. `handles PDF.js loading failure gracefully (shows error, not blank screen)` **(PdfToCsv cross-ref)**
14. `displays monthly vs annual savings toggle`
15. `recalculates on every input change with debounce`

**PdfToCsv.tsx (10 tests):**
1. `renders the PDF upload area`
2. `loads PDF via PDF.js and displays the first page on Canvas`
3. `allows column selection via mouse drag on the canvas`
4. `shows column preview with detected data`
5. `generates CSV output from selected columns`
6. `copies generated CSV to clipboard`
7. `downloads generated CSV as file`
8. `handles multi-page PDFs with page navigation`
9. `handles PDF.js loading failure gracefully (shows error, not blank screen)`
10. `handles empty PDF (no pages) without crashing`

**App.tsx (10 tests):**
1. `renders the sidebar navigation with all page links`
2. `renders the active page component in the main area`
3. `highlights the current page in the sidebar`
4. `opens Settings modal when Settings is clicked`
5. `opens SearchModal when Cmd/Ctrl+K is pressed`
6. `passes correct callbacks to child page components`
7. `handles responsive sidebar collapse on narrow viewports`
8. `renders the correct page when sidebar navigation item is clicked`
9. `persists page state across browser refresh`
10. `shows error boundary fallback when a page component throws`

**Testing challenges:**
- `Taxes.tsx`: 1033 lines. Needs `fake-indexeddb/auto`, mock `FileReader` for uploads, mock `useTaxStore` hook, mock `useProfile` for owner badges. The file upload flow is deeply async. Use `waitFor()` extensively. The 10-second undo countdown requires `vi.useFakeTimers()`.
- `PdfToCsv.tsx`: 585 lines with PDF.js dynamic import, Canvas API, and mouse-driven selection. Target 70% coverage — test the data transformation logic (column detection, row grouping) and basic rendering, skip pixel-perfect canvas assertions. Add error handling tests for PDF.js load failures.
- `FICalculator.tsx`: Financial simulation engine. Create fixture data with known expected FI dates and validate the projection loop. Mock `useData()` and budget store. Add edge case tests for retirement age = current age and negative/NaN inputs.
- `SearchModal.tsx`: Mock the search index functions (`buildIndex`, `search`, `findMatchRange`). Test keyboard navigation with synthetic KeyboardEvent dispatches.
- `Drive.tsx`: Mock `IndexedDB` for file storage, mock `FileReader` for uploads. Test breadcrumb navigation and empty state.
- `App.tsx`: Use `renderWithProviders` from `src/test/renderWithProviders.tsx` (already exists with all 11 providers composed). Mock sidebar navigation and page routing.

---

## Sub-Issue 25: Cross-Cutting Quality (Error Boundaries, Loading States, Race Conditions, A11y)

**Scope:** Tests that don't belong to any single component but verify cross-cutting behaviors identified in QA review.

| Area | Est. Tests |
|------|------------|
| Error Boundary — catches and renders fallback UI when child components throw | 3 |
| Loading states — FICalculator lazy load, Drive file loading, Taxes file upload in-progress | 3 |
| Race conditions — syncNow during auto-sync, simultaneous CSV uploads, import during export | 3 |
| Browser edge cases — QuotaExceededError on localStorage full, IndexedDB unavailable | 2 |
| A11y integration — Tab order through settings modal, screen reader page navigation, focus return on modal close | 3 |

**New test files:** 2 (`src/test/crossCutting.test.tsx`, `src/test/a11yIntegration.test.tsx`)
**Enhanced test files:** 1 (`ErrorBoundary.test.tsx`)
**Total new tests:** ~14
**Dependencies:** SI-01 through SI-24 (runs last as a quality gate)
**Effort:** M (4-5 hours)
**Owner:** Quinn

---

## Summary: 25 Sub-Issues (2-3 files each)

| # | Sub-Issue | Files | Tests | Effort | Depends On | Owner |
|---|-----------|-------|-------|--------|------------|-------|
| SI-01 | Test Infrastructure + Hooks (useFocusTrap, useTouchDrag, TermAbbr, Icons, settings/index) | 5 | 30 | S | — | Ellis |
| SI-02 | Contexts: Encryption + ImportExport | 2 | 27 | M | SI-01 | Ellis |
| SI-03 | Contexts: GitHubSync + BudgetSync + TaxSync | 3 | 37 | L+ | SI-01 | Ellis |
| SI-04 | Settings: GitHubSyncPane (505 LOC, 1%) | 1 | 24 | M | SI-01 | Quinn |
| SI-05 | Settings: Profile + Appearance | 2 | 16 | M | SI-01 | Ellis |
| SI-06 | Settings: Advanced + Labs + Modal + Menu | 4 | 26 | M | SI-01 | Ellis |
| SI-07 | Goal Components: GwSection (648 LOC, 4%) | 1 | 27 | XL | SI-01 | Quinn |
| SI-08 | Goal Components: Mixer + DiveDeep + SavingsPlan | 3 | 36 | L | SI-01 | Sam |
| SI-09 | Goal Components: CompareView + CardActions + MiniGrid | 3 | 32 | L | SI-01 | Quinn |
| SI-10 | Goal Page + Hooks (Goal.tsx, useFinancialGoals, useGwGoals) | 3 | 20 | M | SI-07, SI-08, SI-09 | Quinn |
| SI-11 | Goal Components: DetailedCard (600 LOC) + Form (480 LOC) | 2 | 31 | L | SI-01 | Sam |
| SI-12 | Goal Components: FilterBar + MiniCard + GoalsSection | 3 | 17 | M | SI-01 | Ellis |
| SI-13 | Budget Components: BudgetTable (733 LOC, 0%) | 1 | 26 | L+ | — | Quinn |
| SI-14 | Budget Components: ManualEntry + Header + CSVPreview | 3 | 31 | L | — | Ellis |
| SI-15 | Budget Components: Charts + AggView + CategoryManager | 4 | 38 | L | — | Sam |
| SI-16 | Budget Hooks + Sync (useBudget 390 LOC, useCSVUpload, budgetGitHubSync) | 3 | 49 | XL | SI-13, SI-14 | Drew |
| SI-17 | Data: AccountsModal (988 LOC, 24%) | 1 | 31 | L+ | SI-01 | Quinn |
| SI-18 | Data: Spreadsheet (615 LOC) + Charts + AccountForm | 3 | 43 | L | SI-01 | Sam |
| SI-19 | Data Page Integration (Data.tsx, GoalsPeek.tsx) | 2 | 16 | M | SI-17, SI-18 | Ellis |
| SI-20 | Pages: Taxes (1033 LOC, 0%) + taxGitHubSync | 2 | 38 | XXL | SI-01 | Quinn |
| SI-21 | Pages: Home + Drive | 4 | 37 | L | SI-01 | Ellis |
| SI-22 | Pages: Tools (FICalculator 677L, SavingsGrowth 492L, PdfToCsv 585L) | 3 | 35 | XL | SI-01 | Sam |
| SI-23a | Pages: Allocation (Allocation.tsx + 7 components + hooks) | 10 | 30 | XL | SI-01 | Quinn |
| SI-23b | Pages: App + SearchModal + small components (App.tsx, SearchModal.tsx, UndoToast.tsx, SidebarToggle.tsx) | 4 | 23 | L | SI-01 | Ellis |
| SI-24 | Budget + csvParser Enhancement (Budget.tsx 73%, csvParser.ts 73%) | 2 | 14 | S | SI-16 | Ellis |
| SI-25 | Cross-Cutting Quality (Error Boundaries, Loading, Race Conditions, A11y) | 3 | 14 | M | All | Quinn |

**Total: 25 sub-issues (26 PRs), ~748 test cases, 49 new + 18 enhanced test files**

### Dependency Graph (Restructured)

```
SI-01 (Infra + Hooks)
  ├── SI-02 (Contexts: Encrypt+Import)
  ├── SI-03 (Contexts: Sync)
  ├── SI-04 (Settings: GitHubSync)
  ├── SI-05 (Settings: Profile+Appearance)
  ├── SI-06 (Settings: Adv+Labs+Modal)
  ├── SI-07 (Goal: GwSection) ──┐
  ├── SI-08 (Goal: Mixer+Deep)  ├── SI-10 (Goal Page + Hooks)
  ├── SI-09 (Goal: Compare+Grid)┘
  ├── SI-11 (Goal: DetailedCard+Form)
  ├── SI-12 (Goal: Filter+Mini+Section)
  ├── SI-17 (Data: AccountsModal) ──┐
  ├── SI-18 (Data: Spreadsheet+)    ├── SI-19 (Data Page)
  ├── SI-20 (Pages: Taxes)          ┘
  ├── SI-21 (Pages: Home+Drive)
  ├── SI-22 (Pages: Tools)
  └── SI-23a (Pages: Allocation)
      SI-23b (Pages: App+Search+Small)

SI-13 (Budget: Table) ──────┐
SI-14 (Budget: Manual+Hdr)  ├── SI-16 (Budget Hooks+Sync) ── SI-24 (Budget+csvParser)
SI-15 (Budget: Charts+Cat)  ┘

SI-25 (Cross-Cutting) ── depends on all above
```

### Parallelism Opportunities

After SI-01 lands, these groups can run in parallel:
- **Stream A (Goals):** SI-07 → SI-08 → SI-09 → SI-10 → SI-11 → SI-12
- **Stream B (Budget):** SI-13 + SI-14 + SI-15 → SI-16 → SI-24
- **Stream C (Settings):** SI-04 + SI-05 + SI-06
- **Stream D (Contexts):** SI-02 + SI-03
- **Stream E (Data):** SI-17 + SI-18 → SI-19
- **Stream F (Pages):** SI-20 + SI-21 + SI-22 + SI-23a + SI-23b
- **Stream G (Quality Gate):** SI-25 (after all other streams complete)

All streams depend only on SI-01. Within each stream, order matters where shown with →.

### Recommended PR Order

```
PR 1:  SI-01 (Infra + Hooks)               →  quick win, unblocks all streams
PR 2:  SI-13 (Budget: BudgetTable)          →  independent of SI-01, start immediately
PR 3:  SI-14 (Budget: ManualEntry+Hdr)      →  independent of SI-01, start immediately
PR 4:  SI-15 (Budget: Charts+Cat)           →  independent of SI-01, start immediately
PR 5:  SI-04 (Settings: GitHubSyncPane)     →  after SI-01
PR 6:  SI-05 (Settings: Profile+Appearance) →  after SI-01
PR 7:  SI-06 (Settings: Adv+Labs+Modal)     →  after SI-01
PR 8:  SI-02 (Contexts: Encrypt+Import)     →  after SI-01
PR 9:  SI-03 (Contexts: Sync)              →  after SI-01
PR 10: SI-17 (Data: AccountsModal)          →  after SI-01
PR 11: SI-18 (Data: Spreadsheet+Charts)     →  after SI-01
PR 12: SI-07 (Goal: GwSection)              →  after SI-01
PR 13: SI-08 (Goal: Mixer+DiveDeep)         →  after SI-01
PR 14: SI-11 (Goal: DetailedCard+Form)      →  after SI-01
PR 15: SI-12 (Goal: Filter+Mini+Section)    →  after SI-01
PR 16: SI-09 (Goal: Compare+CardAct+Grid)   →  after SI-01
PR 17: SI-16 (Budget Hooks+Sync)            →  after SI-13, SI-14
PR 18: SI-10 (Goal Page + Hooks)            →  after SI-07, SI-08, SI-09
PR 19: SI-19 (Data Page Integration)        →  after SI-17, SI-18
PR 20: SI-20 (Pages: Taxes)                 →  after SI-01
PR 21: SI-21 (Pages: Home+Drive)            →  after SI-01
PR 22: SI-22 (Pages: Tools)                 →  after SI-01
PR 23: SI-23a (Pages: Allocation)            →  after SI-01
PR 24: SI-23b (Pages: App+Search+Small)     →  after SI-01
PR 25: SI-24 (Budget+csvParser)             →  after SI-16
PR 26: SI-25 (Cross-Cutting Quality)        →  after all other PRs land
```

PRs 1-4 can start immediately (no cross-dependencies). PRs 5-16 can all run in parallel after PR 1 lands. PRs 17-19 wait for their stream predecessors. PRs 20-24 can run any time after PR 1. PR 26 is the quality gate.

### Expected Coverage After Completion

With ~748 new tests covering 67 files to 80-95% each:
- **Statement coverage:** 55.89% → **~91%**
- **Branch coverage:** 43.14% → **~78%**
- **Function coverage:** 46.46% → **~85%**
- **Line coverage:** 58.18% → **~92%**

### Shared Test Infrastructure (created in SI-01)

1. **Factory functions** in `src/test/factories.ts`:
   - `makeAccount(overrides?)`, `makeBalanceEntry(overrides?)`, `makeGoal(overrides?)`, `makeGwGoal(overrides?)`, `makeProfile(overrides?)`, `makeBudgetStore(overrides?)`, `makeTaxStore(overrides?)`
   - `makeTransaction(overrides?)`, `makeCategoryGroup(overrides?)`, `makeTaxItem(overrides?)`
   - **Note:** `makeAccount` and `makeBalance` already exist in the codebase (used in DataContext.test.tsx and EncryptionContext.test.tsx). Move them to `src/test/factories.ts` if currently inlined, then extend — do not recreate.

2. **Mock helpers** in `src/test/mockHelpers.ts`:
   - `mockFileReader(content: string)`, `mockFetch(responses: Record<string, Response>)`, `mockNavigatorVibrate()`
   - `makeTouchEvent(clientX, clientY)` — reused by useTouchDrag (SI-01) and GoalsMiniGrid (SI-09)

3. **Existing utilities** — `renderWithProviders` already exists in `src/test/renderWithProviders.tsx` with all 11 providers composed. Use it instead of manual provider wrapping in component tests.

4. **Timer cleanup rule** — All SIs using `vi.useFakeTimers()` (SI-01, 02, 03, 04, 07, 13, 16, 20, 21) must call `vi.useRealTimers()` in `afterEach` to prevent timer leaks across tests.

5. **MSW for API mocking** — MSW is already in devDependencies. Use it for GitHub API mocking in SI-03 (GitHubSyncContext), SI-04 (GitHubSyncPane), and SI-16 (budgetGitHubSync) instead of manual `vi.fn()` fetch mocks.

These factories prevent test data duplication across 49 test files and ensure consistent data shapes.

---

*This plan covers every source file below 90% statement coverage. Each sub-issue is scoped for independent execution (2-3 files max). The dependency graph ensures test infrastructure is built before the components that need it. QA review feedback from Casey and Quinn has been incorporated — ~80 additional test cases, corrected LOC counts, owner assignments, and effort re-estimates.*
