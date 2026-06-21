# Budget

- **Status:** Current state
- **Owner:** Riley
- **Last updated:** 2025-06-09

## Page summary
- **Purpose:** Help the user import, organize, review, and adjust cashflow data for a selected year.
- **Primary user:** A person managing monthly income and spending from CSV imports plus occasional manual entries.
- **When they use it:** After exporting bank or card data, when reviewing cashflow trends, or when cleaning up categories.
- **Success looks like:** The user ends with a complete year view of income, expenses, savings rate, and category organization that can feed other planning surfaces.

## What this page includes
| Area / feature | One-line purpose |
|---|---|
| Header and year navigation | Switch years and change how budget data is viewed. |
| View controls | Toggle between Aggregated, Detailed, and Cashflow views plus M/Q/H time grouping. |
| Upload controls | Import one CSV, bulk import multiple CSVs, and optionally open the PDF → CSV lab tool. |
| CSV format help | Show the expected import format and examples. |
| Manual transaction entry | Add a single transaction directly without importing a file. |
| Empty state | Explain what to do when the selected year has no data. |
| CSV preview modal | Review a file before import and optionally exclude columns. |
| Summary cards | Show Total Income, Total Expenses, and Save Rate for the selected year. |
| Category group manager | Create, rename, reorder, merge, and move expense groups and categories. |
| Detailed and aggregated tables | Review totals by category, group, month, quarter, or half-year. |
| Month drilldown | Inspect transaction-level detail for a month and edit categories inline. |
| Cashflow charts | Visualize inflows, outflows, net cashflow, and annual source-to-spend flows. |
| PDF → CSV modal | Open the lab conversion tool when the lab flag is enabled. |

## Core user workflows
### Import a monthly CSV
- **Start:** User clicks **Upload CSV**.
- **User intent:** Add a month of bank or card activity to the selected year.
- **Steps:** 1. Choose a CSV whose filename includes a recognizable month. 2. Review **Preview — Mon YYYY**. 3. Optionally click column headers to exclude columns. 4. Click **Import**.
- **End state:** The month is added or replaced, summaries refresh, and a toast confirms the result.
- **Notes:** Recognized filename formats are `YYYY-MM` and `Our Finances - MMM YYYY`.

### Bulk import multiple CSVs
- **Start:** User opens upload options and clicks **Bulk Upload**.
- **User intent:** Import several months in one session.
- **Steps:** 1. Select multiple CSVs. 2. Review each preview in sequence. 3. Confirm or cancel each file one at a time.
- **End state:** All reviewable files are processed and skipped files are summarized.
- **Notes:** Canceling one preview does not cancel the remaining queue.

### Add a one-off transaction manually
- **Start:** User clicks **Add Transaction**.
- **User intent:** Capture a transaction without re-exporting a CSV.
- **Steps:** 1. Enter **Date**, optional **Description**, **Amount**, and **Category**. 2. Click **Save**.
- **End state:** The transaction is appended to that month and the button briefly changes to **Added ✓**.
- **Notes:** The category must be chosen from existing non-removed categories.

### Review a month in detail
- **Start:** In **Detailed** view with **M** selected, user clicks a month header such as **Jan**.
- **User intent:** Inspect and clean up individual transactions.
- **Steps:** 1. Open the drilldown. 2. Sort by **Date**, **Category**, **Amount**, or **Description**. 3. Filter categories from **All Categories**. 4. Optionally show **Removed (N)** transactions. 5. Double-click a category to edit it.
- **End state:** The user understands or updates the transactions for that month.
- **Notes:** Drilldown is only available in monthly detailed view.

### Reorganize expense categories
- **Start:** User clicks **Groups**.
- **User intent:** Make expense reporting more meaningful.
- **Steps:** 1. Expand or collapse groups. 2. Add, rename, move, or delete groups. 3. Drag categories between groups. 4. Use **Merge Categories** to combine overlapping categories.
- **End state:** Expense groups, subtotals, and chart groupings reflect the user’s preferred structure.
- **Notes:** Income categories are not managed here.

## Feature specs
### Header and year navigation
- **What it is:** The top bar with the **Budget** title, previous and next year buttons, view toggles, upload controls, and help.
- **Why it exists:** It gives the user the main controls for moving around the page.
- **Who sees it:** Always visible.
- **Data shown:** Page title and selected year.
- **Actions available:** Previous year, next year, change main view, change time grouping, show or hide groups, upload data, and open help.
- **Default state:** Selected year starts at the current year and the main view starts on **Aggregated**.
- **Other states:** **Groups** becomes **Hide Groups** when the group manager is open, and the upload menu and help panel open inline.
- **Rules:** Budget years can be browsed forward and backward, including future years.
- **Edge cases:** Simply visiting a new year can make that year available for manual entry even before any transactions exist.
- **Related workflows:** Import a monthly CSV; Bulk import multiple CSVs; Reorganize expense categories.

### View controls
- **What it is:** The **Aggregated / Detailed / Cashflow** toggle and the **M / Q / H** toggle.
- **Why it exists:** It lets the user switch between summary tables, transaction tables, and charts at different time grains.
- **Who sees it:** Always visible.
- **Data shown:** Active selection state only.
- **Actions available:** Switch the main view and switch the time grouping.
- **Default state:** **Aggregated** and **M** are selected.
- **Other states:** Detailed view shows tables, Aggregated view shows rolled-up tables, and Cashflow shows charts.
- **Rules:** The Sankey view remains annual even when **Q** or **H** is selected.
- **Edge cases:** Month-level actions such as month drilldown and month-header upload only work in monthly detailed view.
- **Related workflows:** Review a month in detail.

### Upload controls
- **What it is:** The split **Upload CSV** button and the upload-options menu.
- **Why it exists:** It supports single-file import, batch import, and optional lab tooling.
- **Who sees it:** Always visible, though **PDF → CSV** only appears when the lab is enabled.
- **Data shown:** The main **Upload CSV** action plus menu choices **Bulk Upload** and, conditionally, **PDF → CSV**.
- **Actions available:** Open the file picker, open the upload menu, start bulk upload, and open the PDF lab modal.
- **Default state:** Menu closed.
- **Other states:** Menu opens beside the button and the dropdown toggle shows expanded or collapsed state.
- **Rules:** Single-file import infers the month from the filename.
- **Edge cases:** Files with unrecognized month names are rejected or skipped.
- **Related workflows:** Import a monthly CSV; Bulk import multiple CSVs.

### CSV format help
- **What it is:** A help panel opened by the **?** button.
- **Why it exists:** It tells the user how import files should be structured.
- **Who sees it:** Anyone who opens it.
- **Data shown:** Expected CSV format, field rules for date, category, amount, and description, plus a sample CSV.
- **Actions available:** Open and close the panel.
- **Default state:** Hidden.
- **Other states:** Visible as an inline help block with a close **×** button.
- **Rules:** The help text requires **Date**, **Category**, and **Amount**, with description-style columns treated as optional.
- **Edge cases:** The same guidance also appears inside the month-header context menu.
- **Related workflows:** Import a monthly CSV.

### Empty year state
- **What it is:** The no-data screen for the selected year.
- **Why it exists:** It explains what to do before any transactions are available.
- **Who sees it:** Users on a year with no parsed transactions and no stored monthly files.
- **Data shown:** **No data for YYYY** plus explanatory text.
- **Actions available:** **Import CSV** for current or past years.
- **Default state:** Only appears when the selected year has no budget data.
- **Other states:** Future years show **This year hasn't started yet. Data will appear as you add it.** instead of the import prompt.
- **Rules:** The import action is hidden for future years.
- **Edge cases:** A selected year can exist in the product but still show this empty state.
- **Related workflows:** Import a monthly CSV; Add a one-off transaction manually.

### CSV preview modal
- **What it is:** A review modal titled like **Preview — Jan 2025**.
- **Why it exists:** It lets the user inspect a file before committing it.
- **Who sees it:** Users importing a recognized CSV through quick upload or bulk upload.
- **Data shown:** Row count, column count, preview rows, column headers, and an **… and N more rows** hint when needed.
- **Actions available:** Click headers to exclude or include columns, **Cancel**, and **Import**.
- **Default state:** All columns included.
- **Other states:** Excluded columns show a strikeout treatment and an **✕** marker, and the import button changes to text such as **Import (3 of 4 columns)**.
- **Rules:** The preview shows up to 8 data rows.
- **Edge cases:** The modal can be dismissed by clicking outside it.
- **Related workflows:** Import a monthly CSV; Bulk import multiple CSVs.

### Manual transaction entry
- **What it is:** A collapsible form opened by **Add Transaction**.
- **Why it exists:** It supports one-off transaction capture without a CSV export.
- **Who sees it:** Always available.
- **Data shown:** Fields for **Date**, **Description**, **Amount**, and **Category**, plus inline validation.
- **Actions available:** Expand or collapse the form, search categories, pick a category, **Save**, and **Cancel**.
- **Default state:** Collapsed.
- **Other states:** Expanded form, validation errors, category dropdown, and temporary success state **Added ✓**.
- **Rules:** **Amount** and **Category** are required. The selected date must belong to a budget year that exists.
- **Edge cases:** The category list excludes removed categories, supports keyboard selection, and can show **No categories** or **No match for "..."**.
- **Related workflows:** Add a one-off transaction manually.

### Summary cards
- **What it is:** Three cards labeled **Total Income YYYY**, **Total Expenses YYYY**, and **Save Rate YYYY**.
- **Why it exists:** They give the user an at-a-glance annual snapshot.
- **Who sees it:** Users on a year with data.
- **Data shown:** Annual income, annual expenses, and save rate.
- **Actions available:** Read-only.
- **Default state:** Shown whenever the page is not in the empty-year state.
- **Other states:** Values are displayed as currency or percentage.
- **Rules:** Expense values are shown as positive spending totals.
- **Edge cases:** Save rate stays safe when income is zero.
- **Related workflows:** Import a monthly CSV; Add a one-off transaction manually.

### Category group manager
- **What it is:** The **Expense Category Groups** panel.
- **Why it exists:** It lets the user shape how expenses roll up across the page.
- **Who sees it:** Users who click **Groups**.
- **Data shown:** Group names, category counts, category pills, and merge or delete prompts.
- **Actions available:** Expand or collapse groups, rename, move up or down, delete a group, drag categories between groups, add a new group, enter **Merge Categories** mode, and delete categories.
- **Default state:** All groups start expanded when the panel opens.
- **Other states:** Merge mode, drop-target highlighting, empty-group text **No categories** or **Drop here**, and delete-with-merge prompts.
- **Rules:** **Others** and the reserved removal group cannot be renamed or deleted.
- **Edge cases:** Deleting a group moves its categories to **Others**. Deleting a category with existing transactions requires a merge target first.
- **Related workflows:** Reorganize expense categories.

### Detailed and aggregated tables
- **What it is:** The main budget tables for detailed category review and rolled-up group review.
- **Why it exists:** They help the user understand budget performance from different levels of detail.
- **Who sees it:** Users in **Detailed** or **Aggregated** view.
- **Data shown:** In **Detailed**, **Income** and **Expenses** tables with category rows, expense group subtotals, monthly, quarterly, or half-year columns, and **Grand Total**. In **Aggregated**, **Income — Aggregated** and **Expenses — Aggregated** with group-level totals and **Grand Total**.
- **Actions available:** Toggle **Total** to **%**, click month headers in monthly detailed view, and open month-header menus when available.
- **Default state:** Totals are shown as currency.
- **Other states:** Percentage mode shows share of the annual total, including **100%** in the grand total for aggregated view.
- **Rules:** Income stays flat in detailed view, while expenses stay grouped. In aggregated view, all income categories roll into a single **Income** row.
- **Edge cases:** Category labels can shorten within their own group, such as showing **Groceries** instead of a repeated group prefix.
- **Related workflows:** Review a month in detail; Reorganize expense categories.

### Month-header context menu
- **What it is:** A right-click menu on monthly table headers in detailed monthly view.
- **Why it exists:** It gives the user month-specific file actions.
- **Who sees it:** Users in monthly detailed view.
- **Data shown:** **Upload CSV for Jan** style actions, optional **Remove CSV**, and inline format guidance.
- **Actions available:** Upload a CSV directly to that chosen month or remove that month’s stored CSV.
- **Default state:** Hidden.
- **Other states:** **Remove CSV** only appears for months that already have stored data.
- **Rules:** This upload path uses the clicked month, not the filename, to decide where the file lands.
- **Edge cases:** Upload failures here show an inline alert above the table instead of only a toast.
- **Related workflows:** Review a month in detail.

### Month drilldown
- **What it is:** The transaction-level panel beneath the detailed tables.
- **Why it exists:** It lets the user inspect and clean up a month at row level.
- **Who sees it:** Users who click a month header in monthly detailed view.
- **Data shown:** A title such as **Jan 2025 — Expense Transactions**, sortable columns, filter state, filtered subtotal badge, and optional removed-transaction toggle.
- **Actions available:** Sort, filter, toggle **Removed (N)**, close with **×**, and edit categories inline.
- **Default state:** Sorted by newest date first with **All Categories** selected.
- **Other states:** Empty message **No income/expense transactions for this month.**, filtered state such as **3 of 4 categories**, and visible removed rows.
- **Rules:** Opening a different month resets filter, sort, and removed-row visibility.
- **Edge cases:** Removed transactions are excluded from the main filtered subtotal even when shown.
- **Related workflows:** Review a month in detail.

### Inline category editing
- **What it is:** In-place category editing inside the month drilldown.
- **Why it exists:** It lets the user fix category mistakes without re-importing a file.
- **Who sees it:** Users who double-click a category cell in drilldown.
- **Data shown:** An inline text input or a confirmation prompt like **Create new category "NewCat"?**
- **Actions available:** Type a replacement category, confirm **Yes**, click **No**, or cancel with **Escape**.
- **Default state:** Read-only category text.
- **Other states:** Edit input and new-category confirmation state.
- **Rules:** Existing categories are applied immediately. Brand-new categories require confirmation.
- **Edge cases:** New confirmed categories are also added to **Others** for future grouping.
- **Related workflows:** Review a month in detail.

### Cashflow charts
- **What it is:** The **Cashflow — YYYY** bar chart and **Cashflow Sankey**.
- **Why it exists:** They help the user understand cashflow shape and annual source-to-spend distribution.
- **Who sees it:** Users in **Cashflow** view.
- **Data shown:** Income bars, expense bars, net cashflow legend, Sankey totals, and percentage shares.
- **Actions available:** Hover the bar chart for tooltip detail and switch Sankey **Group / Category** mode.
- **Default state:** Sankey starts in **Group** mode.
- **Other states:** Sankey empty state **No transaction data for this year.**
- **Rules:** The bar chart follows **M / Q / H** while the Sankey stays annual.
- **Edge cases:** Positive values inside expense categories behave like refunds and reduce net outflow.
- **Related workflows:** Review a month in detail.

### PDF → CSV modal
- **What it is:** A full-screen modal titled **PDF → CSV**.
- **Why it exists:** It exposes an experimental conversion workflow from the Budget page.
- **Who sees it:** Only users with the lab enabled.
- **Data shown:** The embedded conversion tool and a brief **Loading…** state while it opens.
- **Actions available:** Open from the upload menu, close with **Close**, click outside the modal, or press **Escape**.
- **Default state:** Hidden.
- **Other states:** Open modal with focus kept inside.
- **Rules:** The menu item does not appear unless the lab is enabled.
- **Edge cases:** Focus returns to the previously used trigger when the modal closes.
- **Related workflows:** Import a monthly CSV.

## Page-level states
- **First-time / empty:** The page shows **No data for YYYY**. Current and past years show **Import CSV**. Future years show **This year hasn't started yet. Data will appear as you add it.**
- **Returning / populated:** The page shows summary cards plus the chosen main view. Uploaded months, manual additions, edits, and grouping changes update the page immediately.
- **Error / blocked:** Uploads can fail from unrecognized filenames, invalid CSV structure, no valid transactions, or month-specific upload errors.

## Data and decisions
- **User inputs captured:** Year selection, main view, time grouping, CSV files, column exclusions in preview, manual transaction date, description, amount, category, group names, group order, drag-and-drop placement, merge targets, drilldown category edits, drilldown filters, and sort choices.
- **Derived values shown:** Annual income, annual expenses, save rate, group totals, category totals, grand totals, percentage shares, filtered drilldown subtotal, net cashflow by period, Sankey totals and percentages, and row and column counts in CSV preview.
- **Saved choices / preferences:** Imported months, manually added transactions, category edits, group structure, merged categories, removed categories, and the stored budget year data.
- **Cross-page impact:** Budget data updates shared savings information used elsewhere for goal progress and FI projection messaging. Imported budget files also appear in Drive and in backup and restore flows.

## Open questions / known gaps
- The removal-group language is split between **Remove from Budget** and **Removed (N)**, which may be confusing.
- Re-importing a month replaces that month’s stored file without a confirmation step.
- The preview modal lets users exclude required columns and only surfaces the failure after import instead of preventing it earlier.
- Quick upload and bulk upload depend on filename-based month detection, while month-header upload ignores the filename and uses the clicked month.
