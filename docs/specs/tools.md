# Tools Findings Memo

- **Status:** Current shipped behavior
- **Owner:** TBD
- **Last updated:** 2026-06-11

## Page summary
- **Purpose:** Give the user access to three utility workflows: FI planning, savings-vs-growth analysis, and PDF-to-CSV extraction.
- **Primary user:** A returning user actively planning FI, reconciling net worth changes, or converting statement PDFs into CSVs.
- **When they use it:** When they open **Goals → Calculator**, **Net Worth → Growth**, or **Budget → Upload menu → PDF → CSV**.
- **Success looks like:** The user leaves with a retirement savings target, a year-by-year net worth explanation, or a cleaned CSV they can copy/download.

## What this page includes
| Area / feature | One-line purpose |
|---|---|
| Tools access model | Exposes tools as embedded experiences instead of a standalone page |
| FI Calculator | Estimates annual savings needed to reach FI before retirement accounts unlock |
| Growth Tracker | Explains year-over-year net worth change through savings and growth |
| PDF → CSV | Converts selected table regions from PDFs into editable CSV output |
| Tools backup/export presence | Includes FI scenarios and Growth Tracker overrides in backup, restore, and export flows |

## Core user workflows
### Estimate FI readiness
- **Start:** Open **Goals**, then switch to **Calculator**.
- **User intent:** Understand how much to save each year to retire early.
- **Steps:** Review the prefilled **Annual Expense** value, adjust **Inflation**, **Growth**, **Retire in**, **Plan until**, retirement-access years, and optional **Include GW liquid**, then review the result and breakdown.
- **End state:** The user sees either **Save each year until {year}** with an annual amount or **You're ready to FI! 🎉**.
- **Notes:** The calculator can also expand **Year-by-year projection** for a more detailed runout view.

### Save and reuse an FI scenario
- **Start:** Configure the FI Calculator.
- **User intent:** Keep named versions of different FI assumptions.
- **Steps:** Click **+ Save**, enter a **Simulation name**, click **Save**, then later reopen the saved chip or remove it with **×**.
- **End state:** The named scenario becomes a reusable chip above the calculator.
- **Notes:** Saving with an existing name replaces the older snapshot with that same name.

### Reconcile net worth growth by year
- **Start:** Open **Net Worth**, then switch to **Growth**.
- **User intent:** Understand whether yearly net worth change came from savings, investment growth, or missing manual inputs.
- **Steps:** Review the default **Savings** view, switch to **Income** if needed, toggle **YoY change** between **$** and **%**, and click values or **—** to enter missing yearly amounts.
- **End state:** The user sees a year-by-year explanation of net income, expense, savings, growth, gross income, taxes, and tax rate where available.
- **Notes:** Some fields can only be edited when no budget-derived data exists for that year.

### Extract CSV from a PDF statement
- **Start:** Enable **PDF → CSV** in **Settings → Labs**, then open **Budget** and choose **PDF → CSV** from the upload menu.
- **User intent:** Pull transaction tables out of a PDF without manual retyping.
- **Steps:** Upload or drop a PDF, navigate pages if needed, zoom in or out, drag a rectangle over a table region, clean the extracted table, then use **Copy CSV** or **Download .csv**.
- **End state:** The user leaves with editable CSV output.
- **Notes:** Each new selection appends more rows to the same extracted table.

### Preserve tool data in backups
- **Start:** Use saved FI scenarios or edit Growth Tracker override values.
- **User intent:** Keep tool data included with the rest of the app's backup and restore flows.
- **Steps:** Save scenarios or edits, then use export, GitHub sync, or restore flows elsewhere in the app.
- **End state:** Tool-specific saved data participates in the app's broader backup model.
- **Notes:** The PDF → CSV tool itself does not keep its own saved workspace.

## Exhaustive feature inventory
### Access and navigation
- There is **no standalone Tools screen** in the current shipped product.
- The legacy **Tools** destination sends the user to **Budget**.
- Current entry points are:
  - **Goals → Calculator** for **FI Calculator**
  - **Net Worth → Growth** for **Growth Tracker**
  - **Budget** upload menu → **PDF → CSV** for the PDF extraction tool
- App search still exposes a **Tools** category with **FI Calculator**, **Growth Tracker**, and **PDF → CSV** entries.
- Backup and restore language elsewhere in the app still refers to the **Tools** domain.

### FI Calculator
- Primary labels and controls:
  - **Annual Expense**
  - **Use last year's ({amount})** when last year's expense can be inferred and differs from the current input
  - **Inflation** with **− / +** stepper controls
  - **Growth** with **− / +** stepper controls
  - **Retire in** with a year and a parenthetical year count like **(1yr)**
  - **Plan until** with **− / +** stepper controls
  - **Primary 401(k)** with **− / +** stepper controls
  - **Partner 401(k)** with **− / +** stepper controls when partner birth-year data exists
  - **Include GW liquid ({amount})** toggle
- Holdings summary always shows:
  - **FI Retirement (Primary)**
  - **FI Retirement (Partner)**
  - **FI Non-Retirement**
  - **GW Liquid** only when the GW toggle is on
- Result area shows either:
  - **Save each year until {retireYear}**
  - or **You're ready to FI! 🎉**
- Breakdown rows can include:
  - **Expense at retirement ({retireYear})**
  - **Non-ret corpus needed at {retireYear}**
  - **Primary 401(k) at {year}** when primary FI retirement assets exist
  - **Partner 401(k) at {year}** when partner FI retirement assets exist
  - **Existing non-ret at {retireYear}**
  - **Gap to close**
- Projection details are hidden behind **Year-by-year projection** and show columns for **Year**, **Expense**, and **Net Worth**, plus any note about retirement money becoming available.
- Saved scenario controls:
  - **+ Save**
  - **Simulation name**
  - **Save**
  - **✕** to cancel the save form
  - saved scenario chips with inline **×** delete
- Default behavior:
  - Starts prefilled from current balances, user profile birthdays, the app's inflation setting, and last year's budget expense when available
  - Falls back to **60,000** annual expense when no usable expense history exists
  - Starts with **Growth** at **8%**
  - Starts with **Retire in** set to next year
  - Starts with GW liquid excluded
- Important shipped rules:
  - The plan horizon defaults to age 100 for the older of the available people; without birthdays it defaults to a long forward horizon instead.
  - Retirement-access years default from birth years when known.
  - Only active balances count.
  - The calculator uses the latest month available in the balances dataset for current holdings.
  - Removed budget categories are excluded from the annual-expense prefill.
  - Bad or missing budget data fails softly instead of blocking the tool.

### Growth Tracker
- Top controls:
  - **Savings** button
  - **Income** button
  - **YoY change** toggle that flips between **$** and **%**
- Savings view columns:
  - **Year**
  - **Net Income**
  - **Expense**
  - **Exp Δ**
  - **Savings**
  - **Sav Δ**
  - **Growth**
  - **Gro Δ**
  - **Net Worth**
- Income view columns:
  - **Year**
  - **Gross Income**
  - **Taxes**
  - **Tax Rate**
  - **Net Income**
- Editing behavior:
  - Missing editable values appear as clickable **—**
  - Missing non-editable computed values appear as **N/A** or **—** depending on the field
  - Click, **Enter**, or **Space** starts editing
  - **Blur** or **Enter** commits edits
  - **Escape** cancels edits
- Hint copy:
  - Savings view: **Savings = Net Income from budget. Growth = Net Worth change − Savings. Click "—" to enter missing data.**
  - Income view: **Gross income & taxes are user-entered. Net income is derived from budget data when available.**
- Default behavior:
  - Opens on **Savings** view
  - Shows YoY deltas in dollars first
  - Builds the year list from any available balance history, budget history, and saved overrides
- Important shipped rules:
  - Year-end net worth uses December when available, otherwise the latest month in that year.
  - Net worth is a full summed balance for the selected month, matching the app's broader net worth total.
  - Budget categories with any negative monthly total are treated as expenses; others are treated as income.
  - Removed categories are excluded.
  - Percentage deltas are hidden when the prior comparison value is zero.
  - Expense delta coloring is intentionally inverted so higher expense reads as worse.
  - Gross income and taxes are always editable; net income and savings are only editable when no budget-derived data exists for that year.

### PDF → CSV
- Access is gated by the **PDF → CSV** Labs toggle.
- Budget entry labels:
  - Upload menu item: **PDF → CSV**
  - Modal title: **PDF → CSV**
  - Modal close control: **Close**
- Initial state:
  - **Drop a PDF here or click to browse**
  - hidden PDF file picker behind the dropzone
- While loading:
  - **Loading PDF…**
- Viewer toolbar after load:
  - file name display
  - page controls **←** and **→** with a label like **Page 1 / 2** when there are multiple pages
  - zoom controls **−**, percentage display, and **+**
  - **Change file**
- In-view guidance:
  - **Click and drag to select a table region. Each selection appends to the CSV below.**
- Error messages include:
  - **Please drop a PDF file**
  - the PDF parser's own error message when available
  - **Failed to load PDF** as the generic fallback
  - **No text found in selection. Try selecting a larger area.**
- Extracted results area shows:
  - **Extracted Table ({n} rows)**
  - **Clear**
  - **Merge Debits / Credits** when debit and credit headers are both detected
  - **Copy CSV** which briefly changes to **✓ Copied**
  - **Download .csv**
- Table editing controls:
  - **×** to remove a row
  - **↑** to merge a row into the row above
  - **×** to remove a column
  - inline editing inside header and body cells
- Important shipped rules:
  - Multiple selections append into one combined extracted table.
  - Page changes and zoom changes clear the active selection box.
  - Empty text fragments are ignored during extraction.
  - Download names use the original PDF file name with a **.csv** extension.
  - Selection is mouse-based only.

### Tools backup, export, and restore presence
- Saved FI scenarios and Growth Tracker yearly overrides are treated as part of the product's **Tools** data domain.
- That means they participate in GitHub backup status, sync progress, restore flows, and JSON export/import.
- The PDF → CSV workspace is session-only and is not represented as saved tool data.

## Page-level states
- **First-time / empty:**
  - There is no standalone Tools landing page.
  - FI Calculator falls back to generic defaults.
  - Growth Tracker shows **No data available. Add account balances in the Accounts tab and/or upload budget CSVs to get started.**
  - PDF → CSV shows only the upload dropzone until a PDF is loaded.
- **Returning / populated:**
  - FI Calculator may open with budget-informed expense, birthday-informed retirement timing, and saved simulation chips.
  - Growth Tracker can show multiple years, saved manual overrides, and either dollar or percentage deltas.
  - PDF → CSV can show a loaded PDF, an extracted table, and copy/download actions.
- **Error / blocked:**
  - PDF → CSV can block on invalid files, PDF load failures, or a selection with no text.
  - Growth Tracker and FI Calculator generally fail soft when upstream data is missing or malformed.
  - The PDF tool is blocked from the Budget upload menu unless **PDF → CSV** is turned on in **Labs**.

## Data and decisions
- **User inputs captured:**
  - FI assumptions: annual expense, inflation, growth, retirement year, plan horizon, retirement-access years, GW liquid inclusion, scenario names
  - Growth Tracker overrides: yearly gross income, taxes, and sometimes net income or savings
  - PDF tool inputs: uploaded PDF, selected table regions, manual cell edits, row deletions, row merges, and column deletions
- **Derived values shown:**
  - FI annual savings target, retirement-year expense, corpus requirement, account-access values, gap, and year-by-year runout
  - Growth Tracker net worth, savings, growth, deltas, and tax rate
  - PDF tool extracted row count and generated CSV output
- **Saved choices / preferences:**
  - Named FI scenarios
  - Growth Tracker yearly overrides
  - Labs preference for whether **PDF → CSV** is available
- **Cross-page impact:**
  - Tools live inside **Goals**, **Net Worth**, and **Budget**, so they affect those pages' navigation and mental model.
  - Saved tool data appears in backup/export/restore flows under the broader **Tools** domain.
  - Turning on **PDF → CSV** in **Labs** adds an upload-menu action inside **Budget**.
  - App search exposes these utilities under the **Tools** category.

## Open questions / known gaps
- The product still talks about **Tools** in search and backup flows even though there is no standalone Tools page.
- **Change file** in the PDF tool resets the viewer back to the upload state, but the extracted table below is not cleared automatically. If the raw spec assumes a full reset, current shipped behavior is broader than that.
- The Growth Tracker labels and hint text imply a clean separation between net income, savings, and growth, but the shipped calculation treats budget-derived **Net Income** as the positive-income total and then derives **Savings** by subtracting expenses. This is important but not obvious from the UI alone.
- Saving an FI scenario with an existing name silently overwrites the earlier scenario.
- The PDF tool has no keyboard-based selection flow.
