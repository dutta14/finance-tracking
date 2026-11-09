# Import Wizard

- **Status:** Proposed
- **Owner:** Anindya
- **Last updated:** 2026-11-08
- **Priority:** 3 of 5 in the next-features list
- **Effort:** L

## 1. Summary and goal

**Problem.** Worth imports one CSV shape: a header row with exactly `date`, `category` and `amount`. A bank export with "Transaction Date" is rejected. A row with no category is dropped without a word. The month comes from the filename, so a statement that spans two months cannot be split. Re-uploading a month replaces it wholesale, so there is no safe way to top up a month. Nothing categorizes merchants, so every month starts with hand-editing. People who export from a bank today must first reshape the file in a spreadsheet.

**Goal.** Bank CSVs import correctly the first time and get categorized automatically after that.

**Success metrics (no telemetry; all verifiable in the repo).**

1. The 15-file fixture set in section 7.4 (F01-F15) imports with the expected mapping and outcome, asserted by unit tests. Each fixture is a representative, synthetic file, not a real bank format.
2. The "Transaction Date, Description, Amount" fixture (F02 variant) imports with every row in "Uncategorized" and zero silently dropped rows. Skipped rows are always listed with a row number and a reason.
3. Re-importing any fixture adds 0 rows and reports "N duplicates skipped" (unit test and Playwright).
4. The canonical `Date,Category,Amount,Description` file (F11) produces the same month files and the same budget summary through the wizard as through the legacy path (parity test).
5. A 50,000-row file (F12) is parsed and planned in a unit test within a 5 second budget on CI, and the preview renders at most 100 rows at a time.
6. No network request is made during import (Playwright asserts there are no requests other than the app's own static assets).
7. Manual check by the owner: import one real month of the owner's own bank export, save the mapping, import the next month, and see zero hand-edits for merchants covered by rules.

## 2. Current behavior (verified)

All items below were read in the code on 2026-11-08. The PM draft was checked item by item; corrections are marked CORRECTED.

### 2.1 Parser: `src/pages/budget/utils/csvParser.ts`

- Headers are matched exactly after lowercasing: `findIndex(h => h === 'date')`, `'category'`, `'amount'` at lines 80-82. "Transaction Date" is not accepted; the error is thrown at about line 96. The description column accepts a synonym list (about lines 83-98), with a fallback that treats the extra column as the description when there are exactly 4 headers.
- Rows with a missing date, category or amount are silently dropped: `if (!dateStr || !category || !amountStr) continue` at line 125. `getValidLineIndices` (lines 149-170) duplicates the logic. CONFIRMED.
- The delimiter is hardcoded to a comma in `parseCSVLine` (line 174) and `splitCSVRows` (line 212). Semicolon files cannot be read.
- `parseAmount` (lines 4-25) strips `[$EUR GBP JPY symbols and commas]` with one regex at line 13. A comma decimal is silently corrupted: "1.234,56" becomes 1.23456 and "1,5" becomes 15. Parentheses negatives and a leading minus are handled; a trailing minus is not.
- `normalizeDate` (lines 28-57) prefers US month/day. It swaps only when the first part is above 12 and the second is at most 12. It does not reject impossible dates: `new Date(y, m-1, d)` rolls over, so "2025-02-30" is accepted. The native fallback at lines 54-55 (`new Date(s).toISOString().slice(0,10)`) shifts the day in positive-offset timezones for text such as "May 1 2025". `vite.config.js` line 28 sets `process.env.TZ = 'UTC'`, so unit tests cannot see that bug.
- `parseCSV` trims the text (which drops a BOM) but does not decode UTF-16 or Windows-1252.
- `csvParser.test.ts` has 65 `it` cases. They must stay green.

### 2.2 Upload hook: `src/pages/budget/hooks/useCSVUpload.ts`

- `monthKeyFromFilename` (lines 4-26) looks for `/(\d{4})-(\d{2})/` anywhere in the name, or "Our Finances - MMM YYYY". CONFIRMED: the month comes only from the filename.
- `handleQuickUpload` (line 45) shows a toast and aborts if no month is found. `handleBulkUpload` (line 63) skips such files. `handlePreviewConfirm` (line 94) commits. The hook has no tests.

### 2.3 State and storage

- `src/pages/budget/hooks/useBudget.ts`, `uploadCSV` (lines 117-188): replaces the month wholesale, `csvs[monthKey] = {month, csv: csvText, uploadedAt: ''}` (line 133). CONFIRMED: no dedupe, no merge.
- Category discovery in `uploadCSV` is by sign: a negative amount puts a new category in the expense "others" group; a positive amount puts it in "income-others", but only if the category was not already seen as negative. A mixed-sign category is therefore an expense.
- `persist` (lines 102-107) calls `saveBudgetStore(...).catch(console.error)`. Write failures are swallowed.
- `addTransaction` (line 190) appends one line to the month text and calls `uploadCSV`. With no month file it uses the header `Date,Category,Amount,Description`. `mergeCategories`, `editCategory` and `deleteCategory` exist; `deleteCategory` is only allowed for categories with no transactions.
- Income versus expense is membership in income groups (`incomeCatSet`): `totalIncome` sums income-group categories and everything else is expense. A group with id `removed` ("Remove from Budget") is excluded from totals.
- `src/pages/budget/utils/budgetStorage.ts`: `saveBudgetStore` (line 242, loop at 248) rewrites EVERY month CSV on every persist, then writes `budget/categories.json` with `version: 1`. Month files are `transactions/{year}/{yyyy-mm}.csv`. `loadBudgetStore` lists `transactions/*` and takes any `.csv`, so only month files may live there. It does not list `budget/`, so extra JSON files in `budget/` are safe. `saveCSVForMonth` writes one month.
- `src/utils/fileStoreTypes.ts` defines `FileStore`: `readJSON(path, fallback)`, `writeJSON`, `readCSV`, `writeCSV`, `readBinary`, `writeBinary`, `exists`, `listFiles`, `delete`, `getHandle`, `subscribe(path, cb)`. There is no copy or move. `readJSON` returns the fallback for both a missing and a corrupt file; detect corruption with `readJSON(path, null)` plus `exists(path)`.
- `FileSystemFileStore` (`src/utils/fileStore.ts`) debounces writes by 300 ms, uses `navigator.locks` and a BroadcastChannel. `MemoryFileStore` (`src/utils/memoryFileStore.ts`) backs tests and demo mode; `src/test/fileStoreTestUtils.tsx` provides `FileStoreTestProvider` and `makeFileStoreValue`.
- `src/utils/csvUtils.ts`: `parseCSV(text)` is comma-only RFC 4180 with no BOM handling; `serializeCSV` quotes only when needed.

### 2.4 Entry points (all verified)

| ID | Where | File | Behavior today |
| --- | --- | --- | --- |
| E1 | Budget "..." menu, "Upload CSV" | `src/pages/budget/Budget.tsx` (about 303-313) | Hidden input `quick-upload-input`, `CSVPreviewModal`, month from filename |
| E2 | Budget "..." menu, "Bulk Upload" | `Budget.tsx` (about 314-324) | Hidden input `bulk-upload-input`, per-file month from filename |
| E3 | Empty year "Import CSV" button | `Budget.tsx` (about 205-213) | Calls `quickUploadRef.current?.click()` |
| E4 | Right-click month header, "Upload CSV for {Mon}" | `src/pages/budget/components/BudgetTable.tsx` (165-190) | Own file input, NO preview, replaces the month |
| E5 | Drive dropzone and picker | `src/pages/drive/useDriveUpload.ts`, `Drive.tsx` (about 360-372, 393-399) | Same filename-month logic, `CSVPreviewModal` |
| E6 | PDF to CSV tool | `src/pages/tools/components/PdfToCsv.tsx` | Output is only "Copy CSV" (`handleCopy`, line 197) or "Download .csv" (`handleDownload`, line 205) |
| E7 | Transactions page | `src/pages/transactions/Transactions.tsx` | NO import button. Empty state (line 1322): "Import a monthly CSV on the Budget page to see transactions here." |

Notes on E1-E7:

- The hidden inputs for E1/E2 are mounted only when `viewMode === 'spreadsheet'` (`Budget.tsx` line 147). The default route is `/budget/cashflow`. By code reading, E3 is a silent no-op there. This was not reproduced in a browser; e2e only uses `/budget/spreadsheet`.
- The "PDF -> CSV" menu item shows only when `getStorageItem('lab-pdf-to-csv','0') === '1'`. `mergeDebitCredit` in `src/pages/tools/utils/pdfCsvUtils.ts` emits Amount strings like `-$1,234.56`. There is no handoff to the budget.
- Manual entry (`ManualTransactionEntry`) uses `addTransaction`. It is not an import path and is untouched.

### 2.5 CSVPreviewModal: `src/pages/budget/components/CSVPreviewModal.tsx` (129 lines)

Shows the first 8 rows; clicking a `<th>` excludes a column. It has `role="dialog"`, `aria-modal` and `aria-labelledby`, but the clickable `th` has no role or tabIndex, there is no focus trap, no Escape handler, and a backdrop click cancels. CSS: `src/styles/Budget.css` lines 1461-1618 (`csv-preview-overlay`, `csv-preview-modal`, `csv-preview-btn`; overlay `rgba(0,0,0,.55)`, z-index 1000). Tests: `CSVPreviewModal.test.tsx`.

### 2.6 Transactions page: `src/pages/transactions/Transactions.tsx` (1544 lines)

- `buildCsv` (line 66) quotes every field and always writes `Date,Category,Amount,Description`. Any extra column is lost on the first edit.
- `computeFingerprint` (lines 131-139) uses `csv.length` plus `csv.slice(0,64)` per month. A same-length recategorization returns a stale cache. `resetTransactionCache` is exported as `@internal`.
- `reassignTransactionCategory` (about 860-905) matches the first row with the same (date, amount, category, description), so identical same-day rows cannot be told apart. It calls `saveCSVForMonth` then `saveBudgetStore`.
- The category editor popup (about 1400-1440) uses `createPortal` and `txn-category-editor*` classes. Rows render `transaction.category || 'Uncategorized'` (line 1392); that label is unreachable today because the parser drops blank categories.
- Refresh: `fileStore.subscribe('budget/categories.json')` plus the `budget-changed` and `storage` window events. The toolbar is `txn-toolbar` (Search, Date, Categories, Sort).

### 2.7 The "Allow CSV imports & resets" gate (PM claim CORRECTED)

The setting is `allowCsvImport` in `src/contexts/SettingsContext.tsx` (lines 39-41), stored in localStorage, default '0', toggled in `src/pages/settings/components/AdvancedPane.tsx` (hint: "Show import and reset buttons on the Data page"). It is enforced ONLY in `src/pages/data/Data.tsx` (lines 27, 275, 281, 349-390) for the accounts/balances CSV import, export and reset. Budget CSV import, Drive upload and the PDF tool are NOT gated by it. This spec keeps the Data page gate unchanged and does not add a new gate (decision D2).

### 2.7b No categorization rules exist

`grep` for rule, autocategor and merchant-matching code in `src/` finds nothing. Categories are assigned only by the CSV `category` column, manual edit in Transactions, or manual entry.

### 2.8 Reusable infrastructure

- Feature flags: `src/flags/flagDefinitions.ts` (`FLAGS = { MODERN_DESIGN: defineFlag('modern-design', {...}) }`), consumed as `useFlag(FLAGS.X)` with a definition object (the docs that show `useFlag('name')` are stale). Rollout config is `feature-flags.json`; the local override is the localStorage key `flag-overrides`. The e2e base fixture mocks the GitHub fetch of `feature-flags.json` to `{flags:{}}`, so e2e must seed `flag-overrides`.
- `src/hooks/useFocusTrap.ts` focuses the first focusable element and restores focus on close. `src/components/UndoToast.tsx` is a 10 s `role="alert"` toast (CSS `src/styles/UndoToast.css`). The Budget PDF modal (`Budget.tsx` 409-438) is the existing Escape plus focus-trap pattern. `.tab-bar` / `.tab-btn` with `aria-pressed` exists for filters. The ManualTransactionEntry category field is an ARIA combobox/listbox.
- There is no pluralize helper in `src`, and no axe-core dependency. Accessibility is checked with RTL role queries and `e2e/keyboard-nav.spec.ts`.
- Provider order in `src/App.tsx`: `FileStoreProvider` outermost, then `SettingsProvider`, `LayoutProvider`, then `GoalsProvider`, `DataProvider`, `FlagProvider`. CONTRIBUTING.md says FlagProvider is outermost; code and docs disagree. This spec adds no provider.

## 3. Architecture

### 3.1 Principles

1. Pure core, thin shell. Everything from bytes to a commit plan is pure functions with no React, no `Date` objects, no I/O. The wizard UI and the commit are the only impure parts.
2. Nothing touches disk until the user presses the final confirm button. The plan is built in memory.
3. Wrap, then replace. The wizard sits behind the `import-wizard` flag. With the flag off, every legacy path is byte-identical. At graduation the legacy path is deleted in one pass (repo convention).
4. Append, never rebuild. Imported rows are appended to existing month text, so rows the legacy parser would hide are never lost and untouched months are never rewritten.
5. Month file format does not change: `transactions/{yyyy}/{yyyy-mm}.csv` with header `Date,Category,Amount,Description`. Existing data folders need no migration.

### 3.2 Module layout (all NEW unless noted)

Folder `src/pages/budget/import/` (NEW), one co-located test per file:

| Module | Responsibility |
| --- | --- |
| `types.ts`, `constants.ts` | Shared types. `UNCATEGORIZED_EXPENSE = 'Uncategorized'`, `UNCATEGORIZED_INCOME = 'Uncategorized income'`, limits |
| `readFile.ts` | Size check, `decodeBytes(bytes)`: UTF-8 (strip BOM), UTF-16 LE/BE by BOM, else fall back to `windows-1252` via `TextDecoder` |
| `delimiter.ts` | `sniffDelimiter(text)` over `, ; \t \|` by consistent column count across the first 20 records |
| `tokenize.ts` | `tokenize(text, delimiter)`: RFC 4180 (quotes, escaped quotes, newlines in quotes, CRLF/LF/CR). Reports an unterminated quote with a row number |
| `headerDetect.ts` | `detectHeaderRow(records)` skips preamble rows, finds the header, drops footer rows; `suggestMapping(headers)` with synonym dictionaries. "type" is excluded as ambiguous |
| `parseAmount.ts` | `parseAmountToCents(text, decimalSeparator)`: integer cents; handles currency symbols, NBSP, Swiss apostrophe, parentheses, leading plus, leading or trailing minus |
| `parseDate.ts` | `detectDateFormats(samples)`, `parseDate(text, format)`: string math only; strict calendar validation; strips a time suffix; implausible-year check (1990 to current year + 1) |
| `normalizeRows.ts` | `normalizeRows(records, mapping)`: rows to `NormalizedRow[]` plus `SkippedRow[]` |
| `dedupe.ts` | `dedupeKey`, `applyDedupe(rows, known)` |
| `rules.ts` | `normalizeDescription`, `applyRules`, `validateRule`, `suggestRuleValue` |
| `buildImportPlan.ts` | Groups rows by month, applies rules and fallback, dedupes, computes counts, produces `ImportPlan` |
| `mergeCsv.ts` | `appendRowsToMonthCsv(existingText, rows)` and `replaceMonthCsv(rows)` |
| `importStorage.ts` | `loadRules/saveRules`, `loadFormats/saveFormats` with corruption and newer-schema handling |
| `hooks/useImportWizard.ts` | Reducer state machine; `open({files?, text?, source, targetMonth?})`; returns `{open, element}` |
| `components/ImportWizard.tsx`, `ColumnsStep.tsx`, `ReviewStep.tsx`, `ResultStep.tsx` | Wizard UI |
| `components/RulesDialog.tsx`, `CreateRuleDialog.tsx`, `ApplyRulesDialog.tsx` | Rules UI |
| `fixtures/*.csv` | F01-F15 (except generated ones), loaded with `?raw` |

No global provider. Each host page calls `useImportWizard()` and renders `element`. This avoids the provider-order ambiguity in 2.8.

Helper `src/utils/plural.ts` (NEW): `plural(n, one, other)`; singular only when `n === 1`.

### 3.3 Pipeline (pure)

```
bytes -> decodeBytes -> text -> sniffDelimiter -> tokenize -> records
records -> detectHeaderRow -> {headerIndex, headers, dataRecords}
headers -> suggestMapping | savedFormat -> ColumnMapping
dataRecords + ColumnMapping + options -> normalizeRows -> {rows, skipped}
rows + rules + existingRowsByMonth + existingCategories -> buildImportPlan -> ImportPlan
ImportPlan -> (user confirms) -> commitImport -> CommitResult
```

Each stage returns a value and never throws for bad data; failures are data (`skipped`, `errors`). Only `readFile` throws, for size and decoding limits.

### 3.4 Data model

```ts
export type Delimiter = ',' | ';' | '\t' | '|'
export type AmountMode = 'single' | 'split'
export type SignConvention = 'negative-is-spending' | 'positive-is-spending'
export type DateFormat =
  | 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'MM-DD-YYYY' | 'DD-MM-YYYY'
  | 'DD.MM.YYYY' | 'MM/DD/YY' | 'DD/MM/YY' | 'D MMM YYYY' | 'MMM D, YYYY' | 'YYYYMMDD'

export interface ColumnMapping {
  amountMode: AmountMode
  date: number
  description: number | null
  amount: number | null
  debit: number | null
  credit: number | null
  category: number | null
  signConvention: SignConvention
  dateFormat: DateFormat | null
  decimalSeparator: '.' | ','
}

export interface NormalizedRow {
  sourceRow: number          // 1-based record number in the file
  date: string               // YYYY-MM-DD
  amountCents: number        // negative = spending, positive = income
  description: string
  category: string | null    // from the file, null when blank or unmapped
}

export interface SkippedRow { sourceRow: number; reason: 'bad-date' | 'bad-amount' | 'empty' | 'column-count'; raw: string }

export interface ImportPlan {
  months: Record<string, MonthPlan>        // key 'YYYY-MM'
  totals: { newRows: number; duplicates: number; skipped: number; spendingCents: number; incomeCents: number }
  newCategories: { name: string; group: 'expense' | 'income' }[]
  rulesApplied: number
  skipped: SkippedRow[]
}
export interface MonthPlan { added: NormalizedRow[]; duplicates: number; existingCount: number }
```

Amounts are integer cents in the pipeline. They are written to the month file as decimal strings with two places (for example `-12.50`), the same textual form the legacy parser reads.

### 3.5 New file formats

Both live in `budget/`, which `loadBudgetStore` does not list (2.3). Both use `schemaVersion` as the brief requires; existing files use `version` (decision D3).

**`budget/category-rules.json`**

```json
{
  "schemaVersion": 1,
  "rules": [
    { "id": "r_01", "match": { "field": "description", "type": "contains", "value": "STARBUCKS" }, "category": "Dining", "enabled": true },
    { "id": "r_02", "match": { "field": "description", "type": "contains", "value": "shell oil" }, "category": "Gas", "enabled": false }
  ]
}
```

- Ordered; first enabled match wins. Match is case-insensitive on a normalized description (lowercase, strip diacritics, collapse whitespace). The rule value is normalized the same way before comparing.
- `value` is 2 to 100 characters. At most 500 rules.
- v1 has only `field: "description"`, `type: "contains"`. A rule with an unknown field or type is kept as-is when saving, shown disabled, and never applied (forward compatibility).
- `category` is a category name, matching how `categories.json` and month CSVs reference categories today. If the name is no longer in any group, the rule is skipped and counted in the result ("1 rule skipped, its category no longer exists"); it never recreates the category.
- Rules apply only to rows whose category is blank in the file or unmapped, and, in Transactions, only to rows in the two fallback categories.

**`budget/import-formats.json`**

```json
{
  "schemaVersion": 1,
  "mappings": [
    {
      "id": "f_01",
      "name": "Checking export",
      "headerSignature": "date|description|debit|credit|balance",
      "delimiter": ",",
      "hasHeader": true,
      "columns": { "date": "Date", "description": "Description", "amount": null, "debit": "Debit", "credit": "Credit", "category": null },
      "amountMode": "split",
      "signConvention": "negative-is-spending",
      "dateFormat": "MM/DD/YYYY",
      "decimalSeparator": ".",
      "lastUsed": "2026-11-08"
    }
  ]
}
```

- Columns are referenced by header NAME, so a reordered export still maps. Lookup tries an exact `headerSignature` (lowercased, trimmed, pipe-joined) first, then "every referenced column name is present".
- Default name: the filename stem with digits and separators stripped. Cap 50 entries; the least recently used is dropped on save.
- `hasHeader: false` stores column positions as `"#1"`, `"#2"` strings.
- Corrupt file or `schemaVersion` greater than 1: the wizard still works, shows a warning (section 6), and NEVER overwrites the file. Check with `readJSON(path, null)` plus `exists(path)` before writing.

**Month files and `categories.json`:** unchanged. New categories are added to `categories.json` through the existing group model (3.7).

### 3.6 Flow

1. Entry point calls `open({files | text, source})`. `readFile` checks limits (3.9) and decodes. Nothing is parsed with side effects.
2. Tokenize and detect the header. If a saved format matches (3.5), apply it. If the headers are the legacy canonical `date,category,amount[,description]` (`findLegacyColumns`), skip the Columns step and go to Review.
3. Otherwise show **Columns**: mapping selects, sign convention, date format, decimal separator, and "Save this format". Continue is disabled until the mapping is valid and any ambiguous date format is chosen (4.4).
4. **Review**: the plan from `buildImportPlan` (per-month counts, duplicates, skipped, totals, new categories, rows with filters). Options: "Skip duplicates" (default on), "Replace existing months" (default off).
5. Confirm runs `commitImport` (3.8). **Result** shows counts, "Undo import", and links.
6. Cancel or Escape at any step closes the dialog. Zero writes have occurred (AC-33).

### 3.7 Integration with Budget and Transactions hooks

- `useBudget.ts` (MODIFIED): add `commitImport(plan, options): Promise<CommitResult>`. It extracts the existing category-discovery logic of `uploadCSV` into a pure helper (in `budgetStorage.ts` or a new util) and uses it from both, so sign-based grouping stays identical. It awaits the write (unlike `persist`) and returns real errors plus an undo function. `mergeCategories` also calls `retargetRules(from, to)` so rules follow a merged category.
- `budgetStorage.ts` (MODIFIED): add `saveMonths(fileStore, store, monthKeys)`, which writes only the touched months plus `categories.json`. `saveBudgetStore` is unchanged.
- Fallback categories are split by sign: "Uncategorized" (spending, expense group "others") and "Uncategorized income" (income, "income-others"). One mixed-sign category would be classified as an expense by the rule in 2.3 and would distort the savings rate. Zero amounts use the expense fallback (decision D1).
- File-supplied category names are matched case-insensitively to existing names and use the existing spelling.
- Transactions (MODIFIED): toolbar button "Apply rules to uncategorized", a category-editor action "Always categorize merchants like this as ...", and an Import button (E7). Apply edits category cells in the existing CSV text at the cell level (not via `buildCsv`, to avoid the 2.6 column loss) and then invalidates the Transactions cache with `resetTransactionCache`, because the fingerprint can miss same-length edits (risk R3).

### 3.8 Merge, dedupe and commit

Dedupe key: `date | amountCents | normalizedDescription`. It EXCLUDES category (users recategorize after import) and does not strip digits. Algorithm, per month, per file in order:

```
known = multiset of keys of existing rows in that month (seeded once per month)
for each key K in the file: accepted(K) = max(0, countInFile(K) - known(K))
known(K) += accepted(K)
```

Effects: a re-import adds 0; two coffees of the same price on the same day stay two rows on first import; an overlapping statement from a second file in the same batch dedupes against the first. Known limit: identical transfers in two different accounts on the same day for the same amount can be skipped wrongly. Escape hatch: the "Skip duplicates" toggle plus a "Duplicates" filter in Review (R2).

Merge: `appendRowsToMonthCsv` is header-aware (via `findLegacyColumns`, NEW export-only extraction from `csvParser.ts`) and appends lines in the file's own column order, leaving existing bytes untouched. A month with no file gets header `Date,Category,Amount,Description`. "Replace existing months" writes only the imported rows for each touched month.

Commit order: (1) best-effort `PreImportSnapshot` port (3.10), (2) capture an in-memory undo record of the touched months and category groups, (3) write touched months, (4) write `categories.json`, (5) write rules or formats if changed, (6) return `CommitResult`. A failure at 3-4 reports which months failed and restores what was written where possible. The flow never reports success unless every awaited write resolved.

### 3.9 Performance and limits

- Limits: 50,000 data rows, 10 MB per file, 20 files per session. Above any limit the wizard refuses with a message (section 6); it does not process best-effort.
- Parsing and planning run in chunks that yield to the UI (`await` a macrotask between phases). The preview renders about 100 rows at a time with paging.
- Rules cost at most 500 x 50,000 = 25M substring checks. Descriptions are normalized once per row.
- Only touched months are written; untouched months are never rewritten (contrast `saveBudgetStore`, which rewrites all).

### 3.10 Undo and the Data Safety Net

- Always: an in-memory undo record restores the touched month files and category groups. It lives for the session and sits on the Result step as a persistent "Undo import" button (the 10 s `UndoToast` is too short for a bulk operation). It is disabled with an explanation if any touched month changed after the import.
- `docs/specs/data-safety-net.md` now exists. Its `FileSystemFileStore` guard snapshots every overwritten file into `_backups/` automatically (`backupManager.snapshot(path, bytes, tag?)`), so once that feature ships, each month CSV this wizard overwrites is backed up with no wizard code. This spec still defines a port, NEW in `src/pages/budget/import/importStorage.ts`: `type PreImportSnapshot = (reason: 'import') => Promise<void>`, default a no-op, so the wizard does not depend on that spec shipping first. Data-safety-net may supply it (for example to tag the snapshots `pre-import`), or the port is deleted if the automatic snapshots are enough. A snapshot failure never blocks the import (a note appears on the Result step). `_backups/` layout and the restore UI are owned by data-safety-net.

### 3.11 Rollout and back-compat

- Flag `import-wizard`: `FLAGS.IMPORT_WIZARD = defineFlag('import-wizard', { type: 'boolean', default: false, description: '...', temporary: true })` in `src/flags/flagDefinitions.ts`; `feature-flags.json` entry `{"percentage": 0}` first. Owner enables through `flag-overrides`; then 100%; then the flag and the legacy path are removed.
- Flag on, behavior that changes (listed so it can be reviewed): the filename no longer decides the month; blank-category rows are kept; importing merges instead of replaces; dates are validated strictly ("2026-02-30" is skipped); comma decimals work; per-month upload (E4) now shows a preview; a backdrop click no longer closes the dialog.
- Existing folders: no migration. Missing rules and formats files mean empty lists. Old app versions ignore the new JSON files in `budget/`.
- Demo mode works because it uses `MemoryFileStore`.

## 4. Product requirements

### 4.1 User stories

1. As someone importing raw bank CSVs, I want to map columns once and have merchants auto-categorized, so that I do not hand-edit every month.
2. As someone with a statement that crosses a month boundary, I want transactions filed by their own date, so that each month is right.
3. As someone who downloads overlapping statements, I want repeated rows skipped, so that I never double count.
4. As someone who recategorizes a merchant by hand, I want to turn that into a rule, so that I do it once.
5. As someone nervous about a bulk change, I want a preview and an undo, so that I can try it safely.
6. As a keyboard or screen-reader user, I want every step usable without a mouse and announced clearly.

### 4.2 Scope IN

- Mapping step for headers that do not match: date, description, amount OR separate debit and credit, optional category; sign convention; date format detection with explicit choice for DD/MM versus MM/DD.
- Delimiter sniffing (comma, semicolon, tab, pipe), UTF-8/UTF-16/Windows-1252 decoding, header-row detection.
- Remembered mappings per institution in `budget/import-formats.json`.
- "Uncategorized" and "Uncategorized income" fallback instead of dropping rows.
- Split by transaction date into months; per-month counts in the preview.
- Duplicate guard with the documented key and occurrence counter.
- Ordered "description contains" rules in `budget/category-rules.json`; applied on import; "Apply rules to uncategorized" in Transactions; "Always categorize merchants like this as ..." from a transaction.
- Wizard wraps E1-E6 and adds E7.

### 4.3 Scope OUT (with reasons)

| Item | Why |
| --- | --- |
| ML or LLM categorization | Would need a model or a network call; breaks the privacy promise and adds opaque behavior |
| Bank connections (aggregators) | Needs a backend and accounts; breaks the hard promises |
| PDF parsing changes | `PdfToCsv` already works; its output flows into the wizard unchanged |
| Multi-currency conversion | Needs rates (network) and a currency field the data model lacks |
| Account column | `Transaction` has no account field, and `Transactions.buildCsv` would drop a fifth column on the first edit. Deferred to v2 (D5) |
| DR/CR suffix amounts, amount-sign conditions on rules, regex rules | Parsing and UI surface not justified for v1 |
| Non-English month names | `D MMM YYYY` supports English names only (D9) |
| Transfer and card-payment detection | Use a rule that targets a category in the "Remove from Budget" group (D15) |
| Surfacing legacy hidden blank-category rows | Would change existing totals (D12) |
| Changing the Data page import or its gate | Different data shape; the gate stays (2.7) |

### 4.4 Acceptance criteria

**Mapping and parsing**

- AC-1: A CSV with `Transaction Date, Description, Amount` and no category column imports all rows into "Uncategorized" (spending) or "Uncategorized income" (income); zero rows are dropped silently.
- AC-2: A file with legacy canonical headers (`Date,Category,Amount[,Description]`) skips the Columns step and yields the same month files and totals as the legacy path.
- AC-3: Separate debit and credit columns map to one signed amount: debit is spending, credit is income. A row with both blank is skipped with reason "empty".
- AC-4: With "positive is spending" selected, amounts are negated so spending is stored negative. The sign convention is never auto-selected. If every amount has the same sign, a warning is shown.
- AC-5: Amounts accept `$1,234.50`, `(1,234.50)`, `-GBP 45.00` style symbols, `1.234,56` with decimal separator ",", a leading plus, a trailing minus, NBSP and apostrophe thousands separators. Parsing is exact to the cent (integer math).
- AC-6: Dates accept the 12 formats in `DateFormat`, with or without a time suffix. Invalid calendar dates and years outside 1990 to current year + 1 are skipped with reason "bad-date". No `Date` object is used, so results do not depend on timezone.
- AC-7: When a sample's dates parse under more than one format (for example 03/04/2026), Continue is disabled until the user picks a format from a radio group with no default selection. A live sample shows how the first date reads under the chosen format.
- AC-8: Delimiters `, ; tab |` are detected. The user can override.
- AC-9: A UTF-8 BOM, UTF-16 (BOM), and Windows-1252 files decode correctly. Quoted fields with commas, escaped quotes and newlines, CRLF, and trailing blank rows parse correctly.
- AC-10: Preamble rows above the header and footer rows (totals, balances) are ignored; the detected header row is shown and can be changed.
- AC-11: A file with no header offers "First row is data" and columns named "Column 1..n".
- AC-12: Every skipped row appears in a list with its file row number and a reason; the Review step shows the skipped count.
- AC-13: An unterminated quote or ragged row reports the row number and does not abort other rows.
- AC-14: Unmapped columns are ignored. Replaces the old click-to-exclude column feature (D18).

**Month split**

- AC-15: A file spanning two months writes rows into both month files, and Review lists a per-month count for each.
- AC-16: The filename is ignored for month assignment. A file named "statement.csv" imports.
- AC-17: Rows spanning two years are written to `transactions/{year}/` for each year.
- AC-18: Appending leaves the existing bytes of a month file unchanged. Untouched months are not rewritten.
- AC-19: Bulk import (E2) builds one plan for all files. Review shows one combined summary and a per-file section.

**Duplicates**

- AC-20: Re-importing the same file adds 0 rows and shows "N duplicates skipped".
- AC-21: Two identical rows (same date, amount, description) in one file are both imported on first import (F13).
- AC-22: A second file that overlaps the first in the same batch skips the overlap.
- AC-23: A recategorized existing row is still recognized as a duplicate (key excludes category).
- AC-24: Turning "Skip duplicates" off imports them again, and Review warns that totals will double.

**Rules**

- AC-25: With rule "STARBUCKS -> Dining", rows whose description contains "starbucks" in any case, with extra spaces or diacritics, import into "Dining".
- AC-26: Rules are ordered and first enabled match wins; disabled rules never apply; unknown rule types are preserved and not applied.
- AC-27: Rule validation: value 2 to 100 characters, category required, at most 500 rules, duplicate value rejected with a message.
- AC-28: A rule whose category no longer exists is skipped, counted, reported, and does not recreate the category.
- AC-29: Rules never override a category supplied by the file.
- AC-30: "Always categorize merchants like this as ..." in the Transactions category editor prefills the rule value, shows a live match count, and offers "Create rule" or "Create rule and apply to {n}".
- AC-31: "Apply rules to uncategorized" asks for confirmation with a count, recategorizes only the two fallback categories, and offers Undo.

**Safety**

- AC-32: No file write happens before the user presses the confirm button (asserted on `MemoryFileStore` in unit tests and by Playwright).
- AC-33: Cancel, Escape, or closing at any step leaves all data untouched.
- AC-34: `commitImport` awaits every write. If a write fails, the Result step says so and names the affected months. It never reports success on failure.
- AC-35: "Undo import" restores the touched month files and category groups. It is disabled with an explanation if the data changed since.
- AC-36: The `PreImportSnapshot` port is called before the first write. A throwing snapshot does not block the import.

**Limits, persistence, flag**

- AC-37: Files over 50,000 data rows, 10 MB, or more than 20 files are refused with the messages in section 6. Nothing is parsed best-effort beyond the limit. Exactly 50,000 rows imports.
- AC-38: "Save this format" writes `budget/import-formats.json`; the next file with the same signature skips the Columns step and shows "Using saved format: {name}" with a "Change" button.
- AC-39: A corrupt or newer-schema rules or formats file does not stop import, shows a warning, and is never overwritten.
- AC-40: With the flag off, E1-E5 behave exactly as today (existing tests unchanged). The `allowCsvImport` gate in `Data.tsx` is unchanged.
- AC-41: E3 "Import CSV" in an empty year opens the wizard from any Budget view (fixes the silent no-op).
- AC-42: PdfToCsv "Review in import wizard" passes its CSV text into the wizard without a download.

**Accessibility** (details in section 5.6)

- AC-43: The wizard is fully operable by keyboard; focus is trapped and restored; step changes move focus to the step heading and are announced.
- AC-44: Every control has an accessible name; errors are associated with their fields; the preview table has a labelled, focusable scroll region.

### 4.5 States

| State | Behavior |
| --- | --- |
| First time | No saved formats or rules. Columns step shows an intro line "Choose which column holds each value. Worth remembers your choices." |
| Returning | Saved format matches: Columns step skipped, "Using saved format" chip. Rules apply silently and are counted in Review |
| Loading | Parsing: progress text "Reading {name}..." with `aria-busy="true"` on the dialog body. Commit: buttons disabled, "Importing..." |
| Empty | File has no data rows after header: error "no rows found" with a Choose another file action. Rules dialog empty: explanation plus "Add rule" |
| Error | Unreadable file, too large, too many rows, bad date column, write failure, corrupt rules/formats: messages in section 6, each with a next action |
| Partial | Some rows skipped: Review lists them; Continue still enabled when at least one row is importable |
| Nothing new | All rows are duplicates: Review says "Nothing new to import", confirm is disabled |

### 4.6 Keyboard and screen reader

- Tab order: dialog heading (programmatic focus), step content, secondary actions, Back, Cancel, primary action.
- Escape closes (nothing written). Enter in a rule form submits it. Arrow keys work inside native radio groups and selects.
- Announcements through an `aria-live="polite"` region: "Step 2 of 2: Review", the plan summary, the result, and rule-created or undo confirmations.
- Rule reordering uses "Move up" and "Move down" buttons, not drag-only.

### 4.7 Edge cases

- Same file chosen twice in a bulk import: second file is fully duplicates.
- Amount 0: stored in the expense fallback; shown in totals as 0.
- A file category differing only in case from an existing one uses the existing spelling.
- A description with a comma, quote or newline round-trips through `serializeCSV`-style quoting.
- Header names repeated (two "Amount" columns): the first is suggested, both are selectable and labelled by position.
- Rule value matching all rows (for example "a" is rejected by the 2-character minimum; a 2-character value shows its match count before saving).
- Existing month file written by hand with different column order: append uses the existing header order.
- Year or month with existing rows the legacy parser hides: preserved because merge appends text.
- Browser without File System Access: the existing app-level gating applies; the wizard is never reached.

## 5. Design spec

Class prefix `iw-`. CSS in NEW `src/styles/ImportWizard.css` and `src/styles/ImportRules.css` (one file per component group, per the repo convention). All colors and sizes use variables from `src/styles/colorThemes.css`; no hardcoded hex; dark mode comes from `body.dark` variable swaps, never `prefers-color-scheme`.

### 5.1 Component hierarchy

```
div.iw-overlay (no click-to-close)
  div.iw-dialog[role=dialog][aria-modal=true][aria-labelledby=iw-title]
    header.iw-header
      h2#iw-title[tabindex=-1]            "Import transactions"
      p.iw-stepper                        "Step 1 of 2: Columns"
    div.iw-live[aria-live=polite][role=status]   (visually hidden)
    div.iw-body[aria-busy]
      ColumnsStep: section.iw-columns
        fieldset.iw-fieldset > legend "Amounts" > radio group (One amount column | Separate debit and credit)
        div.iw-field > label + select.iw-select  (per column)
        fieldset > legend "Which sign means spending?" > radios
        fieldset > legend "How are dates written?" > radios + p.iw-sample
        div.iw-table-scroll[tabindex=0][role=region][aria-label="First rows of {file}"] > table.iw-table
        label.iw-check "Remember this format as" + input.iw-input
      ReviewStep: section.iw-review
        dl.iw-summary                     new, duplicates, skipped, spending, income
        ul.iw-months > li                 "Oct 2026: 42 new, 3 duplicates"
        div.tab-bar.iw-filters            All | New | Duplicates | Skipped (aria-pressed)
        div.iw-table-scroll > table.iw-table > caption.sr-only
        label.iw-check "Skip duplicates"; label.iw-check "Replace existing months"
      ResultStep: section.iw-result[role=status]
    footer.iw-footer
      button.iw-btn Cancel | Back | primary action
```

RulesDialog uses the same shell with `h2` "Categorization rules", an ordered list (`ol.iw-rules`) where each `li` holds the value, category, enabled toggle (`role=switch` via button with `aria-checked`), "Move up", "Move down" and "Delete rule" buttons, plus an add form (`form.iw-rule-form`). The category field reuses the combobox/listbox pattern from ManualTransactionEntry (2.8).

### 5.2 Visual spec

| Element | Spec |
| --- | --- |
| Overlay | Same look as `.csv-preview-overlay`: `rgba(0,0,0,.55)`, z-index 1000 (existing value reused, not a new color) |
| Dialog | `background: var(--color-surface)`, `color: var(--color-text)`, `border-radius: var(--radius)`, padding 1.5rem, max-width 720px, max-height 90vh, body scrolls, header and footer pinned |
| Title | `--fs-xl`, `--fw-semibold`, `--color-text-heading` |
| Stepper | `--fs-sm`, `--color-text-muted` |
| Section legend / labels | `--fs-sm`, `--fw-medium`, `--color-text` |
| Field gap | 1rem between fields, 0.5rem label to control, 1.5rem between fieldsets |
| Select / input | `--fs-md`, padding 0.5rem 0.75rem, `border: 1px solid var(--color-text-muted)`, `border-radius: var(--radius-sm)`, `background: var(--color-surface)`. `--color-border` is 1.24:1 on surface and fails WCAG 1.4.11, so controls use `--color-text-muted` (4.83:1 light, 6.57:1 dark) |
| Table | `--fs-sm`, header `--color-surface-alt`, row dividers `--color-border-light` (decorative only), cell padding 0.5rem 0.75rem, amounts right-aligned with `font-variant-numeric: tabular-nums`, spending `--color-negative`, income `--color-positive` |
| Primary button | Light: `background: var(--accent-gradient-to)`, `color: var(--color-text-on-accent)` (8.72:1). Dark: `background: var(--accent-light)`, `color: var(--accent-text-dark)` (7.48:1). Plain `--accent` with white is 3.68:1 in dark and fails 1.4.3 for text (D11) |
| Secondary button | transparent, `border: 1px solid var(--color-text-muted)`, `color: var(--color-text)` |
| Warning banner | `background: var(--color-warning-light)`, `color: var(--color-warning-text)` (7.09:1 light, 9.99:1 dark) |
| Error text | `--color-negative` on `--color-surface` (4.83:1 light, 6.03:1 dark). Do NOT put it on `--color-negative-light` for small text (4.41:1) |
| Muted text | `--color-text-muted` on `--color-surface` (4.83:1 light). On `--color-surface-alt` it is 4.52:1 in light; keep it at `--fs-sm` or larger |

Contrast ratios above were computed by the spec author from the hex values in `src/styles/colorThemes.css`; verify them during PR2 review.

### 5.3 States

| State | Treatment |
| --- | --- |
| Default | As in 5.2 |
| Hover | Buttons: `--color-surface-hover` background (secondary); primary gets `--accent-hover` only in light mode (5.17:1 with white). In dark the primary hover keeps the tinted style and raises border contrast. Table rows: `--color-surface-hover` |
| Focus | 2px outline `var(--accent)` with 2px offset on every control (`:focus-visible`); the dialog heading is focused programmatically with no visible ring requirement beyond the default |
| Active | Slight inset: `transform: translateY(1px)`, no color change |
| Disabled | `opacity: .5`, `cursor: not-allowed`, `aria-disabled="true"` plus an adjacent text reason (for example "Choose how dates are written") so the state is not conveyed by opacity alone |
| Loading | `aria-busy`, inline text and a CSS spinner (hidden under reduced motion; text remains) |
| Empty | Centered `--color-text-muted` paragraph with one action |
| Error | Error text with `role="alert"` for blocking errors; field errors use `aria-describedby` and `aria-invalid="true"` and an icon-free text prefix "Error:" so color is not the only cue |

### 5.4 Responsive behavior

| Breakpoint | Behavior |
| --- | --- |
| >= 992px | Dialog 720px wide, mapping fields in a 2-column grid, summary as a 5-column `dl` |
| 768px to 991px | Dialog 90vw, mapping grid 2 columns, summary 3 columns |
| 480px to 767px | Dialog 100vw by 100dvh, no radius, footer buttons stack full width with the primary action first in visual order at the bottom; mapping fields 1 column; tables scroll horizontally inside the focusable region; touch targets at least 44px high |
| < 480px | Same as above; month list becomes one line per month; the stepper wraps |

The repo's existing breakpoints are about 768, 900 and 1200 (checked in `src/styles`); this spec uses 480, 768 and 992 as requested, and the dialog is self-contained so there is no conflict.

### 5.5 Dark mode notes

- Variable swaps cover surface, text and borders. The primary button uses the tinted style (5.2). Do not use opacity to build tints; use `--accent-light` and `--color-warning-light` tokens.
- The overlay stays `rgba(0,0,0,.55)`, which works on both themes.
- Rows and badges for duplicates use text plus a "Duplicate" label, never color alone.

### 5.6 Interaction and accessibility

- Transitions: dialog opens with opacity 0 to 1 over 150ms ease-out; step content changes are instant (no slide). Under `prefers-reduced-motion: reduce` all transitions and the spinner animation are off.
- Focus: `useFocusTrap` (`src/hooks/useFocusTrap.ts`) traps Tab and restores focus to the opener on close. On each step change, focus moves to that step's `h3` with `tabindex="-1"` (WCAG 2.4.3). If the opener was removed (for example the Budget empty-state button), focus returns to the page `h1`.
- Escape closes the dialog on any step (2.1.1). Backdrop clicks do NOT close it, because a stray click would discard the mapping work (this differs from `CSVPreviewModal`, 2.5).
- Preview tables: `<caption class="sr-only">`, `<th scope="col">`, scroll region `tabindex="0"` with `role="region"` and an `aria-label` (so keyboard users can scroll, 2.1.1). The 100-row page has "Previous page" and "Next page" buttons and an `aria-live` "Rows 101 to 200 of 1,240".
- Mapping uses native labelled `<select>` elements (4.1.2). The ambiguous-date radios use `fieldset` and `legend` (1.3.1) with no default checked.
- Status and results use `role="status"`; blocking errors use `role="alert"` (4.1.3).
- Color is never the only cue (1.4.1): amounts carry a sign and the words "spending" and "income" appear in the summary; duplicate and skipped rows carry text badges.
- Text can reflow at 320 CSS px and zoom to 200% without horizontal scrolling of the dialog itself, except inside the table region (1.4.10).
- Touch targets: 44px minimum at 768px and below (2.5.5 target; AA requires 24px under 2.5.8).
- Toggle switches expose `role="switch"` with `aria-checked`.

## 6. Copy

Voice: plain, calm, direct. No exclamation marks. ASCII "..." is shown here; the shipped UI may use the single ellipsis character per existing convention.

Pluralization: a NEW helper `plural(n, one, other)` uses the singular only when `n === 1` (so 0 is plural). Numbers use `toLocaleString()`. Month names use the abbreviated form with year ("Oct 2026").

| Surface | String | Notes |
| --- | --- | --- |
| Entry (menu E1) | Import CSV... | Replaces "Upload CSV" when flag on |
| Entry (menu E2) | Import several CSVs... | Replaces "Bulk Upload" |
| Entry (E4) | Import into {Mon}... | Month header context menu |
| Entry (E6, PdfToCsv) | Review in import wizard | Secondary button next to "Download .csv" |
| Entry (E7, Transactions) | Import | Toolbar button |
| Dialog title | Import transactions | |
| Stepper | Step {n} of {total}: {Columns / Review} | Total is 1 when the Columns step is skipped |
| Columns intro | Choose which column holds each value. Worth remembers your choices. | First time only |
| Columns: date label | Date column | |
| Columns: description label | Description column | |
| Columns: amount mode | One amount column / Separate debit and credit columns | Radios |
| Columns: amount label | Amount column | |
| Columns: debit / credit | Money out column / Money in column | |
| Columns: category label | Category column (optional) | Option "None, I will use rules" |
| Columns: sign legend | Which sign means spending? | |
| Columns: sign options | Negative numbers are spending / Positive numbers are spending | No default selected when unclear |
| Columns: sign warning | Every amount in this column is {positive/negative}. Check that the sign choice is right. | |
| Columns: date legend | How are dates written? | |
| Columns: date sample | "{raw}" reads as {Mon D, YYYY} | Live |
| Columns: date prompt | Choose a date format to continue. | Next to disabled Continue |
| Columns: decimal | Decimal mark | Options "Period (1,234.50)" / "Comma (1.234,50)" |
| Columns: delimiter | Columns are separated by | Options "Comma", "Semicolon", "Tab", "Pipe" |
| Columns: header row | First row is column names | Checkbox |
| Columns: save | Remember this format as | Input; default is the name from 3.5 |
| Saved format chip | Using saved format: {name} | |
| Saved format action | Change | Opens the Columns step |
| Primary (Columns) | Continue to review | |
| Review heading | Review before importing | |
| Review summary | {n} new {transaction/transactions} across {m} {month/months} | |
| Review duplicates | {d} {duplicate/duplicates} skipped | |
| Review skipped | {s} {row/rows} could not be read | Links to the Skipped filter |
| Review totals | Spending {amount}. Income {amount}. | |
| Review per month | {Mon YYYY}: {n} new, {d} skipped as duplicates | |
| Review categories | {k} new {category/categories} will be added | |
| Review rules | {r} {transaction/transactions} sorted by your rules | Only when r > 0 |
| Review fallback | {u} {transaction/transactions} will go to Uncategorized | |
| Toggle: duplicates | Skip duplicates | |
| Toggle: warning | Turning this off will count matching transactions twice. | |
| Toggle: replace | Replace existing months | Default off |
| Replace warning | Existing transactions in {Mon YYYY} will be replaced. You can undo this after importing. | |
| Skipped reason | Date not recognized / Amount not recognized / Empty row / Wrong number of columns | |
| Nothing new | Nothing new to import. Every transaction is already in your budget. | Confirm disabled |
| Primary (Review) | Import {n} {transaction/transactions} | Specific count |
| Footer | Cancel / Back | Cancel closes with no changes |
| Cancel note | Nothing has been saved yet. | Under the footer, steps 1-2 |
| Progress | Reading {filename}... / Importing... | |
| Result | Imported {n} {transaction/transactions} into {m} {month/months}. | |
| Result: undo | Undo import | |
| Undo done | Import undone. Your budget is back to how it was. | |
| Undo disabled | Undo is not available because these months changed after the import. | |
| Result: links | View in Transactions / Done | |
| Snapshot note | A backup could not be made before importing. Your import still went through. | Only on snapshot failure |
| Error: unreadable | We could not read {filename}. Check that it is a text CSV file, then try again. | |
| Error: too large | {filename} is larger than 10 MB. Split it into smaller files and try again. | |
| Error: too many rows | {filename} has {n} rows. Worth imports up to 50,000 rows at a time. Split the file and try again. | |
| Error: too many files | You chose {n} files. Choose 20 files or fewer. | |
| Error: no rows | We found no transactions in {filename}. Check the header row setting, or choose another file. | Action "Choose another file" |
| Error: date column | We could not read any dates in the "{column}" column. Choose a different date column or format. | |
| Error: no valid rows | None of the rows could be read. Check the column choices above. | |
| Error: write failed | Import did not finish. {Mon YYYY} could not be saved. Check that the worth folder is still available, then try again. | Names months |
| Error: quote | Row {n} has an opening quote with no closing quote. It was skipped. | |
| Warning: corrupt rules | Your rules file could not be read, so rules are off for this import. The file has not been changed. | |
| Warning: corrupt formats | Your saved formats file could not be read. You can still map columns by hand. The file has not been changed. | |
| Warning: newer file | This file was saved by a newer version of Worth. It is left as it is. | |
| Rules dialog title | Categorization rules | |
| Rules intro | Rules sort new transactions by what the description contains. The first matching rule wins. | |
| Rules empty | No rules yet. Add one to sort a merchant automatically. | |
| Rules fields | Description contains / Category | |
| Rules buttons | Add rule / Move up / Move down / Turn off / Turn on / Delete rule | `aria-label` includes the value, for example "Delete rule: STARBUCKS" |
| Rule error: short | Enter at least 2 characters. | |
| Rule error: long | Use 100 characters or fewer. | |
| Rule error: duplicate | A rule for "{value}" already exists. | |
| Rule error: category | Choose a category. | |
| Rule error: limit | You have reached the limit of 500 rules. Delete one to add another. | |
| Rule skipped | {n} {rule/rules} skipped because the category no longer exists. | Result and Apply |
| Create-rule heading | Create a rule | |
| Create-rule label | Always categorize merchants like this as {category} | Entry in category editor |
| Create-rule preview | {n} {transaction/transactions} match "{value}". | Live |
| Create-rule buttons | Create rule / Create rule and apply to {n} | |
| Create-rule done | Rule saved. | Live region |
| Apply button | Apply rules to uncategorized | Transactions toolbar |
| Apply confirm | Apply rules to {n} uncategorized {transaction/transactions}? | |
| Apply confirm body | Only uncategorized transactions change. Anything you have categorized stays as it is. | |
| Apply done | Recategorized {k} {transaction/transactions}. | With Undo |
| Apply none | No uncategorized transactions match your rules. | |
| Transactions empty | Import a CSV to see transactions here. | Replaces line 1322 text when flag on |
| Budget empty-year | Import CSV | Button label unchanged |
| Drive hint | Drop CSV files here. Worth reads dates from the rows, not the filename. | Replaces the "Filenames should contain YYYY-MM..." hint |

## 7. Engineering plan

### 7.1 File-by-file changes

| File | Status | Change |
| --- | --- | --- |
| `src/pages/budget/import/**` | NEW | Modules and components in 3.2, each with a co-located test |
| `src/pages/budget/import/fixtures/*.csv` | NEW | F01-F11, F13, F15 text fixtures |
| `src/styles/ImportWizard.css`, `src/styles/ImportRules.css` | NEW | Styles with the `iw-` prefix |
| `src/utils/plural.ts` | NEW | `plural(n, one, other)` plus test |
| `src/utils/csvUtils.ts` | MODIFIED | Optional `delimiter` parameter, default `','` |
| `src/pages/budget/utils/csvParser.ts` | MODIFIED | Export `findLegacyColumns` only; behavior unchanged |
| `src/pages/budget/utils/budgetStorage.ts` | MODIFIED | `saveMonths(fileStore, store, monthKeys)` and the shared category-discovery helper |
| `src/pages/budget/hooks/useBudget.ts` | MODIFIED | `commitImport`; `uploadCSV` reuses the discovery helper; `mergeCategories` calls `retargetRules` |
| `src/pages/budget/Budget.tsx` | MODIFIED | E1-E3 routed to the wizard when flag on; wizard owns its input (fixes E3) |
| `src/pages/budget/components/BudgetTable.tsx` | MODIFIED | E4 routed to the wizard when flag on |
| `src/pages/drive/Drive.tsx`, `useDriveUpload.ts` | MODIFIED | E5 routed to the wizard; hint text |
| `src/pages/tools/components/PdfToCsv.tsx` | MODIFIED | Optional `onUseInWizard(csvText)` prop and button |
| `src/pages/transactions/Transactions.tsx` | MODIFIED | Import button, "Apply rules to uncategorized", category-editor rule entry, cache reset after apply |
| `src/flags/flagDefinitions.ts`, `feature-flags.json` | MODIFIED | `import-wizard` flag |
| `src/pages/budget/components/CSVPreviewModal.tsx`, `hooks/useCSVUpload.ts`, `getCSVFormatHelp` | REMOVED in PR6 | After graduation |
| Docs | MODIFIED | See 7.6 |

Key signatures:

```ts
export function decodeBytes(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252' }
export function sniffDelimiter(text: string): Delimiter
export function tokenize(text: string, delimiter: Delimiter): { records: string[][]; errors: { row: number; message: string }[] }
export function suggestMapping(headers: string[]): Partial<ColumnMapping>
export function parseAmountToCents(text: string, decimal: '.' | ','): number | null
export function parseDate(text: string, format: DateFormat): string | null
export function detectDateFormats(samples: string[]): DateFormat[]
export function normalizeDescription(text: string): string
export function dedupeKey(row: Pick<NormalizedRow, 'date' | 'amountCents' | 'description'>): string
export function applyRules(row: NormalizedRow, rules: CategoryRule[]): string | null
export function suggestRuleValue(description: string): string
export function buildImportPlan(input: PlanInput): ImportPlan
export function appendRowsToMonthCsv(existing: string | null, rows: NormalizedRow[], categoryOf: (r: NormalizedRow) => string): string
export function useImportWizard(): { open: (req: OpenRequest) => void; element: React.ReactNode }
// useBudget
commitImport(plan: ImportPlan, options: { skipDuplicates: boolean; replaceMonths: boolean }): Promise<CommitResult>
```

### 7.2 Implementation order (PR-sized slices)

The PM draft put dedupe in slice 2 and merge later. Merge without dedupe doubles rows on re-import, so dedupe ships with merge.

| PR | Contents | Flag state |
| --- | --- | --- |
| PR1 | Pure parsing core (`readFile` to `normalizeRows`), `plural`, `csvUtils` delimiter, fixtures, unit tests. No UI | n/a |
| PR2 | Wizard shell, Columns and Review steps, split by month, fallback categories, dedupe plus append-merge, `commitImport`, in-memory undo, `PreImportSnapshot` port; E1-E3 | `import-wizard` default off |
| PR3 | Saved formats (`import-formats.json`), "Using saved format", signature matching | off |
| PR4 | Rules: storage, apply on import, `RulesDialog`, validation, `retargetRules` | off |
| PR5 | Transactions integration (create rule, apply rules, Import button E7) plus E4, E5, E6 | off |
| PR6 | Playwright and a11y hardening, docs, rollout 0% to owner to 100%, then delete the legacy path and flag | removed |

Each PR passes the repo pre-commit gates (prettier, eslint max-warnings=0, tsc, vitest with the 90% statement coverage gate, Playwright).

### 7.3 Test plan

Unit (Vitest; TZ is UTC, so date logic is tested with string inputs and with a second suite that runs `vi.stubEnv`-independent assertions, because the pipeline never uses `Date`):

- Every module above has a co-located test. Table-driven cases for `parseAmountToCents` (all AC-5 shapes plus garbage), `parseDate` (all 12 formats, leap days, "2026-02-30", year bounds), `tokenize` (quotes, newlines, CRLF, BOM-stripped text, unterminated quote), `sniffDelimiter`, `decodeBytes` (UTF-8, UTF-8 BOM, UTF-16 LE/BE, Windows-1252 bytes).
- `dedupe`: re-import, same-day repeats, overlap across files, key excludes category.
- `rules`: normalization, order, disabled, unknown type round-trip, dangling category, validation.
- `buildImportPlan`: month split, cross-year, parity with legacy for F11 (compare to `parseCSV` output and `useBudget` summary).
- `commitImport` on `MemoryFileStore`: zero writes before commit, only touched months written, failure path, undo.
- `importStorage`: corrupt and newer-schema files are not overwritten.
- Existing `csvParser.test.ts` (65 cases) must remain green and unmodified.
- F12 (50k rows) is generated in the test; assert the plan completes within 5 s and the 50,001-row case is refused.

Component (RTL; role queries only): step navigation, disabled Continue until the date format is chosen, focus moves to the step heading, Escape closes with no write, backdrop click does not close, live-region text, rules dialog add/reorder/delete, Create-rule and Apply flows.

Playwright (`e2e/import-wizard.spec.ts`, NEW; seed `flag-overrides` in localStorage because the base fixture mocks the flag fetch to `{flags:{}}`; follow `e2e/pages/budget.page.ts` and `e2e/fixtures/budget.fixtures.ts`):

1. Import F02 variant, all rows in Uncategorized, per-month counts shown.
2. Add rule STARBUCKS -> Dining, import, rows land in Dining.
3. Re-import the same file: 0 added, "duplicates skipped" shown.
4. Two-month file lands in two month files.
5. Cancel at each step; reload; data unchanged.
6. Undo after import.
7. Keyboard-only run through the whole flow (extend `e2e/keyboard-nav.spec.ts` patterns).
8. E3 from the default cashflow route opens the wizard.
9. Assert no non-app network requests.
10. Flag off: legacy flow still passes the existing CSV Upload Flow tests.

Accessibility: RTL role/name assertions on every control; Playwright keyboard tests for focus trap, restore, and step-heading focus; a manual VoiceOver pass recorded in the PR description. No axe dependency is added (D13).

### 7.4 Fixture set

All files are synthetic and representative of common export shapes. None claims to match a real bank's proprietary format.

| ID | Shape | Mapping the wizard proposes | Expected outcome |
| --- | --- | --- | --- |
| F01 | `Date,Description,Debit,Credit,Balance`, MM/DD/YYYY | date, description, debit, credit; balance ignored | Split mode; debit negative, credit positive; all Uncategorized or by rules |
| F02 | `Posted Date,Payee,Amount`, ISO, signed amounts (also the "Transaction Date, Description, Amount" variant for AC-1) | date, description (Payee), amount | Negative is spending selected by user; no category column, so all fallback |
| F03 | Card export `Transaction Date,Post Date,Description,Category,Type,Amount` with positive charges | date (Transaction Date), description, category, amount; Type ignored | User picks "positive is spending"; file categories kept; payments become income |
| F04 | Semicolon European `Buchungstag;Valuta;Buchungstext;Betrag;Waehrung`, DD.MM.YYYY, comma decimals, Windows-1252 | Delimiter `;`, decimal ",", date = first column, description = Buchungstext, amount = Betrag | Manual mapping first time, then saved; umlauts decode; "1.234,56" is 123456 cents |
| F05 | Two-month span (ISO) | Auto | Rows land in both month files; per-month counts shown |
| F06 | UTF-8 BOM, CRLF, quoted commas, embedded newline, escaped quotes, trailing blank rows | Auto | All fields intact; blank rows ignored without being listed as errors |
| F07 | Amount shapes: `($1,234.50)`, `$2,000.00`, `-GBP 45.00`, `+75.00`, `12.50-` | amount | Cents exact: -123450, 200000, -4500, 7500, -1250 |
| F08 | Preamble (account name, date range) plus footer (Total, Closing balance) | Header row detected below the preamble | Footer rows skipped; header row selectable |
| F09 | No header, 3 columns | "First row is data"; Column 1..3 | User maps columns; first row is imported |
| F10 | Ambiguous dates (03/04/2026) | Format radios with none selected | Continue disabled until chosen; result matches the chosen format |
| F11 | Legacy canonical `Date,Category,Amount,Description` | Skips Columns step | Parity with legacy path |
| F12 | 50,000 rows (generated) | Auto | Plans within 5 s; 50,001 rows refused |
| F13 | Same-day repeats (two identical rows) | Auto | Both imported first time; second import adds 0 |
| F14 | UTF-16 LE tab-delimited (built in test) | Delimiter tab | Decodes and parses like F01 |
| F15 | Malformed: unterminated quote and ragged rows | Auto | Offending rows skipped with row numbers; others import |

Fixtures with CRLF, BOM, UTF-16 and 50k rows are built programmatically in tests, since git can normalize line endings in checked-in files.

### 7.5 Tests needing updates

`Budget.test.tsx`, `useBudget.test.ts` (new `commitImport`, `uploadCSV` refactor must stay equal), `Transactions.test.tsx` and `Transactions.branches.test.tsx` (new buttons and empty copy behind the flag), `PdfToCsv.test.tsx` (new optional button), Drive tests (hint text behind the flag), `e2e/budget.spec.ts` and `e2e/pages/budget.page.ts` (CSV Upload Flow around lines 53-160; legacy flow remains while the flag is off, then moves to the wizard in PR6). `CSVPreviewModal.test.tsx` is removed with the component in PR6.

### 7.6 Docs to update

`README.md` Budget section (about lines 149-157, 205, 221), `docs/specs/budget.md` (lines 31-45 and 92-137), `src/pages/guide/sections/FeaturesByPage.tsx` (lines 91-101 and 162), `src/pages/home/WelcomeGuide.tsx` (line 37), the CONTRIBUTING.md file-layout table (new files `budget/category-rules.json`, `budget/import-formats.json`), `docs/filesystem-storage-architecture.html`, and this spec's status when shipped. The in-app Guide gets an "Importing a bank CSV" entry and a "Rules" entry.

### 7.7 Risks and mitigations

| ID | Risk | Mitigation |
| --- | --- | --- |
| R1 | Large parsing surface (dates, amounts, encodings) | Pure functions, table-driven tests, 15 fixtures, strict validation that skips and reports instead of guessing, ambiguity forces an explicit user choice |
| R2 | Dedupe wrongly skips identical transfers across two accounts | Documented key, Duplicates filter, "Skip duplicates" toggle, count shown before commit; Account column in v2 |
| R3 | Transactions cache fingerprint misses same-length edits | Call `resetTransactionCache` after apply, or strengthen `computeFingerprint` with a content hash (owner of that change: this spec) |
| R4 | Overwriting a corrupt or newer-schema JSON file | Read with `readJSON(path, null)` plus `exists`; refuse to write when either is unexpected |
| R5 | UI freeze on 50k rows | Chunked parsing, 100-row preview, hard limits |
| R6 | Dark-mode primary button contrast | Tinted button tokens (5.2), checked in PR2 review |
| R7 | Provider order drift between CONTRIBUTING.md and `App.tsx` | No new provider; fix the doc in PR6 |
| R8 | `persist` swallows write errors | `commitImport` awaits its own writes and reports failures |
| R9 | Same-day identical rows edited in Transactions hit the first match (existing limitation, 2.6) | Not fixed here; apply-rules edits by row index, not by value matching |
| R10 | `TextDecoder('windows-1252')` support | Assumed for Chrome and Edge (the only supported browsers); the decode test runs in the Vitest environment and falls back to a Latin-1 mapping if the label is unsupported |

## 8. Cross-feature dependencies

- **data-safety-net:** Owns `_backups/` and the restore UI. Import calls the `PreImportSnapshot` port (3.10) before writing; the port defaults to a no-op so import never waits on that spec. It may implement the port as a `FileStore` decorator. Data-safety-net owns any `FileStore` interface change.
- **monthly-check-in:** The check-in calls `useImportWizard().open({ targetMonth })` for its "Import this month" step; this spec owns the hook. The check-in may show an uncategorized count (rows in the two fallback categories) linking to Transactions. The check-in owns its own state files.
- **category-budget-targets:** Owns `budget/categories.json` and any category model change. This spec adds separate files and does not edit it directly. If that spec introduces category ids, bump the rules `schemaVersion` to 2 and migrate in `retargetRules`. Targets for the fallback categories should be allowed to be empty.
- **annual-review:** Multi-year imports (AC-17) feed it. It should exclude or flag `UNCATEGORIZED_EXPENSE` and `UNCATEGORIZED_INCOME` (exported from `constants.ts`) in its category breakdown and show an "N uncategorized" nudge.
- **File overlaps:** `Transactions.tsx` is owned by this spec for the category-editor rule entry, the Import button, and the "Apply rules" toolbar region; other specs add their changes outside those regions. `useBudget.ts`: this spec owns `commitImport` and the `mergeCategories` rules hook. `budgetStorage.ts`: this spec owns `saveMonths`; category-budget-targets owns any change to `categories.json` shape. `src/flags/flagDefinitions.ts` and `feature-flags.json` are touched by every spec; each adds its own entry and merges are additive.

## 9. Open questions and decisions

None of these block PR1. D1 should be approved before PR2 starts.

| ID | Question | Recommendation | Blocks |
| --- | --- | --- | --- |
| D1 | One fallback category "Uncategorized" (the brief) or two split by sign? | Two: "Uncategorized" and "Uncategorized income". A mixed-sign category is treated as expense (2.3) and distorts income and savings rate | PR2 |
| D2 | Should the budget wizard be gated by "Allow CSV imports & resets"? | No. That setting only guards the Data page (2.7). Gating budget import would be a regression. Keep the Data gate as is | No |
| D3 | `schemaVersion` (the brief) versus `version` (existing files)? | Use `schemaVersion` in the two new files. Leave `categories.json` alone | No |
| D4 | File names and locations? | `budget/category-rules.json` and `budget/import-formats.json`. `budget/` is not scanned by `loadBudgetStore`; `transactions/` is, so never put JSON there | No |
| D5 | Account column in v1? | No. No account field exists and `buildCsv` would drop it. Revisit with a v2 data model | No |
| D6 | Append to existing month text or rebuild via parse and serialize? | Append. It never loses rows the legacy parser hides and never rewrites untouched months | No |
| D7 | Dedupe key? | `date|amountCents|normalizedDescription` with the occurrence counter. Exclude category. Do not strip digits | No |
| D8 | Keep "Replace existing months"? | Yes, default off, with a warning and undo. Preserves today's replace behavior for people who want it | No |
| D9 | Non-English month names? | Out of scope for v1. Numeric dates cover European exports (F04) | No |
| D10 | Depend on data-safety-net for a pre-import backup? | Define the `PreImportSnapshot` port now, default no-op, failure never blocks. The in-memory undo is the v1 safety net | No |
| D11 | Dark-mode primary button style? | Tinted style (`--accent-light` background, `--accent-text-dark` text, 7.48:1) because white on `--accent` is 3.68:1 in dark | No |
| D12 | Surface legacy-hidden blank-category rows in existing months? | No. It would change existing totals. The wizard only protects new imports | No |
| D13 | Add axe-core? | No. Keep RTL role queries and Playwright keyboard tests, plus a manual screen-reader pass | No |
| D14 | Flag rollout? | 0% in `feature-flags.json`, owner enables through `flag-overrides`, then 100%, then delete flag and legacy path in PR6 | No |
| D15 | Transfers and card payments? | Out of scope. Document the pattern: a rule to a category in the "Remove from Budget" group | No |
| D16 | Hard cap of 50,000 rows and 10 MB, or best effort? | Hard cap with a clear message. Predictable beats slow and partial | No |
| D17 | Delete the legacy path at graduation? | Yes, in PR6, in one pass (`CSVPreviewModal`, `useCSVUpload`, upload logic in `useDriveUpload`, `getCSVFormatHelp`) | No |
| D18 | Keep the click-to-exclude column feature of `CSVPreviewModal`? | No. Mapping replaces it; unmapped columns are ignored | No |
| D19 | Rule target by category name or id? | Name, as month CSVs and `categories.json` do today. Revisit if category-budget-targets introduces ids | No |
| D20 | Fix E3 in the legacy path now, independent of the wizard? | Yes if the owner confirms the no-op in a browser (verified by code reading only). It is a small separate PR | No |
