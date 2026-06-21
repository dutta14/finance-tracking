# Net Worth

- **Status:** Current state
- **Owner:** Noel
- **Last updated:** 2025-06-09

## Page summary
- **Purpose:** Serve as the source of truth for accounts and monthly balances, then turn that data into charts, allocation analysis, and yearly growth views.
- **Primary user:** Someone entering balance history, managing account structure, and reviewing net worth trends.
- **When they use it:** During initial setup, monthly updates, account cleanup, allocation review, and annual savings review.
- **Success looks like:** The user can maintain clean account records, record balances quickly, and use the same data across Accounts, Allocation, and Growth views.

## What this page includes
| Area / feature | One-line purpose |
|---|---|
| Page header | Confirms the user is in Net Worth and explains the page job. |
| Section tabs | Switches between Accounts, Allocation, and Growth. |
| Header actions | Imports, exports, resets, and opens account management. |
| Empty states | Guides first-time setup when accounts or balances are missing. |
| Accounts manager | Manages account details, groups, filters, and bulk updates. |
| Charts view | Visualizes FI, GW, net worth, and assets versus liabilities over time. |
| Spreadsheet view | Shows balances by month and account in a grid. |
| Allocation view | Analyzes latest-month allocation and custom target ratios. |
| Growth view | Converts net worth and budget data into yearly savings or income views. |

## Core user workflows
### Add accounts from scratch
- **Start:** User opens Net Worth with no accounts.
- **User intent:** Create the account structure needed for tracking.
- **Steps:** 1. Click **+ Add Account**. 2. Enter account details. 3. Save. 4. Repeat or import more data.
- **End state:** Accounts exist and **View Accounts (N)** becomes available.
- **Notes:** CSV import may also be available, depending on settings.

### Record a new month of balances
- **Start:** User already has accounts.
- **User intent:** Add or update the latest monthly balances.
- **Steps:** 1. Switch to **Spreadsheet**. 2. Click **+ Add Entry** or **Copy Last Month**. 3. Enter values by account. 4. Save.
- **End state:** The new month appears in the spreadsheet and updates downstream charts and calculations.
- **Notes:** Only active accounts can be filled in the inline entry row.

### Manage account metadata in bulk
- **Start:** User opens **View Accounts (N)**.
- **User intent:** Clean up or reorganize multiple accounts at once.
- **Steps:** 1. Filter or sort the list. 2. Select multiple rows. 3. Use bulk controls like **Goal…**, **Owner…**, **Status…**, or **Group…**. 4. Clear the selection when done.
- **End state:** Selected accounts share the new metadata.
- **Notes:** Bulk actions only appear when at least two visible accounts are selected.

### Review balance history visually
- **Start:** User has balance history.
- **User intent:** Understand trends quickly.
- **Steps:** 1. Stay in **Charts** or switch back to it. 2. Pick a chart type. 3. Pick a date range. 4. Review the resulting chart.
- **End state:** User understands FI/GW split, net worth trend, or asset-versus-liability movement.
- **Notes:** Custom range uses year and month selectors.

### Review allocation and yearly growth
- **Start:** User switches tabs.
- **User intent:** See asset mix or yearly savings and income patterns.
- **Steps:** 1. Open **Allocation** or **Growth**. 2. Review current breakdown, targets, or year-over-year rows. 3. Adjust assumptions or overrides where available.
- **End state:** User gets a deeper view of portfolio composition or annual financial performance.
- **Notes:** These views depend on the same accounts and balances entered on the Accounts tab.

## Feature specs
### Page header and section tabs
- **What it is:** The top of the page with **Net Worth**, the subtitle **Track balances across your accounts over time**, and tabs for **Accounts**, **Allocation**, and **Growth**.
- **Why it exists:** It orients the user and separates the three major jobs on the page.
- **Who sees it:** Always visible.
- **Data shown:** Page title, subtitle, and active section.
- **Actions available:** Switch between **Accounts**, **Allocation**, and **Growth**.
- **Default state:** **Accounts** is selected first.
- **Other states:** Allocation and Growth can show a brief **Loading…** state when first opened.
- **Rules:** The page keeps all three views under one Net Worth destination.
- **Edge cases:** None of the three views require a separate page load in the user experience.
- **Related workflows:** Review balance history visually; Review allocation and yearly growth.

### Header actions on Accounts
- **What it is:** The action row on the Accounts tab.
- **Why it exists:** It gives the user the main ways to add, export, reset, and manage account data.
- **Who sees it:** Users on the Accounts tab.
- **Data shown:** Buttons such as **Import from CSV**, **Export CSV**, **Reset Data**, and **View Accounts (N)** when each action is available.
- **Actions available:** Import data, export data, reset accounts and balances, or open the account manager.
- **Default state:** The available actions depend on whether the user has accounts and balances.
- **Other states:** Some actions are hidden when they do not apply.
- **Rules:** **Import from CSV** only appears when CSV import is enabled. **Export CSV** only appears when both accounts and balances exist. **Reset Data** only appears when data exists. **View Accounts (N)** only appears when at least one account exists.
- **Edge cases:** **Reset Data** requires the confirmation **Clear all accounts and balance entries? This cannot be undone.**
- **Related workflows:** Add accounts from scratch; Manage account metadata in bulk.

### Empty states on Accounts
- **What it is:** The first-time messages shown when the user does not yet have enough data.
- **Why it exists:** They tell the user exactly how to begin.
- **Who sees it:** Users with no accounts or with accounts but no balance history.
- **Data shown:** **No accounts yet** with **Add your first account** or **Add your first account or import from a CSV to get started**; and **No balance entries yet** with **Record your first monthly balance or import from CSV**.
- **Actions available:** **+ Add Account**, optional **Import from CSV**, and **+ Add Entry**.
- **Default state:** The no-accounts state appears first.
- **Other states:** Once accounts exist, the empty state shifts to the no-balances state.
- **Rules:** The balance-entry empty state only appears after at least one account exists.
- **Edge cases:** The page can move from one empty state to the next as soon as the minimum required data exists.
- **Related workflows:** Add accounts from scratch; Record a new month of balances.

### Accounts manager
- **What it is:** The account-management workspace opened from **View Accounts (N)**.
- **Why it exists:** It lets the user create, edit, filter, group, sort, and bulk-edit accounts.
- **Who sees it:** Users with at least one account, or users who choose to create their first account.
- **Data shown:** Filters **All (N)**, **Active (N)**, and **Inactive (N)**; sortable columns **Account**, **Goal**, **Type**, **A/L**, **Allocation**, **Owner**, and **Status**; badges and supporting details; and a **Groups** area.
- **Actions available:** **+ Add Account**, **Edit**, **Delete**, apply column filters, sort columns, open **Groups**, select rows, and use bulk menus such as **Goal…**, **Type…**, **Owner…**, **Status…**, **A/L…**, **Allocation…**, **Group…**, and **Clear**.
- **Default state:** Shows the account list view first.
- **Other states:** Empty filtered state **No accounts** with **Click "+ Add Account" to create one**; Groups view with **+ New Group**, **Ungrouped**, and drag-and-drop grouping.
- **Rules:** Bulk actions only appear when at least two visible accounts are selected. Group creation can begin by typing a new name, and the new group becomes real when an account is dropped into it.
- **Edge cases:** The group list can show **inactive** markers, and dragging accounts into **Ungrouped** removes their group assignment.
- **Related workflows:** Add accounts from scratch; Manage account metadata in bulk.

### Account form
- **What it is:** The form used when adding or editing an account.
- **Why it exists:** It captures the information needed to organize and analyze an account correctly.
- **Who sees it:** Users creating or editing an account.
- **Data shown:** Fields for **Account Name**, **Institution**, **Group**, **Goal Allocation**, **Type**, **Owner**, **Status**, **Asset / Liability**, **Asset Allocation**, and **Linked Asset** when applicable.
- **Actions available:** Enter details, create a new group from the picker, **Add Account** or **Update**, and **Cancel**.
- **Default state:** Opens empty for a new account.
- **Other states:** Opens prefilled for editing.
- **Rules:** The available owner choices depend on the saved profile names and can include **Joint**. The available goal choices include **FI (Financial Independence)** and **GW (Generational Wealth)**.
- **Edge cases:** **Linked Asset** only appears when the account is a liability and there are eligible assets to link.
- **Related workflows:** Add accounts from scratch; Manage account metadata in bulk.

### Charts view
- **What it is:** The visual history view on the Accounts tab.
- **Why it exists:** It helps the user understand trends faster than reading a grid.
- **Who sees it:** Users on **Accounts** when **Charts** is selected.
- **Data shown:** Chart types **FI vs GW**, **Net Worth**, and **Assets vs Liabilities**; date filters **All**, **YTD**, **Last 12 mo**, **Year-End**, and **Custom**; and custom **Year**, **Month**, and **to** selectors.
- **Actions available:** Switch chart type, switch date filter, and set a custom date range.
- **Default state:** **Charts** is the default subview within Accounts.
- **Other states:** Empty chart-range state **No data for the selected range**.
- **Rules:** Custom range becomes available only when **Custom** is selected.
- **Edge cases:** The user can have overall balance data but still see **No data for the selected range** after narrowing the filter.
- **Related workflows:** Review balance history visually.

### Spreadsheet view
- **What it is:** The grid-based balance entry and review view on the Accounts tab.
- **Why it exists:** It makes monthly balance maintenance fast and compact.
- **Who sees it:** Users on **Accounts** when **Spreadsheet** is selected.
- **Data shown:** Top filters **Date**, **Owner**, **Goal**, **Type**, **Asset/Liability**, and **Allocation**; preset ranges **All**, **YTD**, **Last 12 mo**, **Year-End**, and **Custom**; a sticky **Total** column; and one column per account or group.
- **Actions available:** Toggle **Show inactive**, click **+ Add Entry**, click **Copy Last Month**, clear filters with **Clear all**, delete a month, and expand or collapse grouped accounts with **Split into sub-accounts** and **Merge sub-accounts**.
- **Default state:** Opens to the saved balance grid with the latest visible data.
- **Other states:** Inline entry row with a month picker, **Save**, and **Cancel**; delete confirmation **Delete all balance entries for Jan 2024? This cannot be undone.** with **Cancel** and **Delete**.
- **Rules:** **Copy Last Month** prefills from the latest saved month. The copy-forward button is described as **Copy balances from last month**.
- **Edge cases:** Spreadsheet filters can narrow what months or accounts are shown without changing the stored data itself.
- **Related workflows:** Record a new month of balances.

### Allocation view
- **What it is:** The portfolio-allocation workspace under the **Allocation** tab.
- **Why it exists:** It shows how current holdings are distributed and lets the user compare them to custom target ratios.
- **Who sees it:** Users who open **Allocation**.
- **Data shown:** **Breakdown**, **My Allocations**, scope tabs **Total**, **FI**, and **GW**, empty texts such as **No data**, **No data for this scope**, and **No allocations yet. Click “+ New Ratio” to get started.**
- **Actions available:** Create ratios with **+ New Ratio**, start from presets such as **Blank**, **Stock vs Bond**, **US vs International**, **Equity vs Fixed Income**, or **Growth vs Defensive**, rename ratios, delete ratios, change scope, add and remove groups, assign classes to groups, and review rebalancing guidance.
- **Default state:** Shows current allocation using the latest available data.
- **Other states:** Ratio-creation and ratio-editing states, plus on-track messaging such as **Your allocation is on track with the goal.**
- **Rules:** The scope tabs let the user compare Total, FI-only, and GW-only allocations.
- **Edge cases:** One scope can show **No data for this scope** while another scope still has data.
- **Related workflows:** Review allocation and yearly growth.

### Growth view
- **What it is:** The yearly savings and income analysis workspace under the **Growth** tab.
- **Why it exists:** It helps the user explain how net worth changed from year to year.
- **Who sees it:** Users who open **Growth**.
- **Data shown:** Modes **Savings** and **Income**; **YoY change** with a button that flips between **$** and **%**; savings columns **Year**, **Net Income**, **Expense**, **Exp Δ**, **Savings**, **Sav Δ**, **Growth**, **Gro Δ**, **Net Worth**; income columns **Year**, **Gross Income**, **Taxes**, **Tax Rate**, **Net Income**; and hint text about how the view is calculated.
- **Actions available:** Switch modes, toggle the delta format, and click values or **—** to enter missing yearly override fields where editing is allowed.
- **Default state:** Opens on **Savings** with year-over-year deltas in dollars.
- **Other states:** Empty state **No data available. Add account balances in the Accounts tab and/or upload budget CSVs to get started.**
- **Rules:** **Gross Income** and **Taxes** are always editable. **Net Income** and **Savings** are only editable when no budget-derived data exists for that year. Missing editable values appear as **—**. Missing non-editable values can appear as **N/A**.
- **Edge cases:** If the prior comparison value is zero, the percentage delta is hidden as **—**.
- **Related workflows:** Review allocation and yearly growth.

## Page-level states
- **First-time / empty:** The page starts with a no-accounts or no-balance state and clear setup actions.
- **Returning / populated:** The page shows Accounts, Allocation, and Growth views with charts, grids, account tools, and yearly analysis.
- **Error / blocked:** Reset Data and month deletion both require confirmation, and some imports may fail quietly enough that the user only notices by reviewing the resulting data.

## Data and decisions
- **User inputs captured:** Account details, group names, account status, bulk updates, balance values, month selections, chart filters, spreadsheet filters, custom ratios, allocation goals, rebalance inputs, and yearly income and tax overrides.
- **Derived values shown:** Total balances, grouped totals, FI/GW chart series, net worth, assets versus liabilities, allocation percentages and values, ratio variances, yearly savings, yearly growth, tax rate, and year-over-year changes.
- **Saved choices / preferences:** Accounts, groups, balances, custom ratios, ratio goals, yearly growth overrides, and imported data.
- **Cross-page impact:** Net Worth data powers Home, goal progress, allocation summaries, and yearly growth analysis.

## Open questions / known gaps
- CSV import does not surface much row-level error detail, which makes troubleshooting hard.
- The Growth view uses budget-derived naming that can be confusing because the visible labels do not fully explain how **Net Income**, **Savings**, and **Growth** relate.
- Spreadsheet totals can still surprise users when inactive-account behavior and active filters do not feel perfectly aligned.
