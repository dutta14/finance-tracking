# Goals

- **Status:** Current state
- **Owner:** Jordan
- **Last updated:** 2025-06-09

## Page summary
- **Purpose:** Help the user create retirement and wealth plans, compare scenarios, and understand the savings pace required to reach them.
- **Primary user:** Someone planning for Financial Independence and optional Generational Wealth goals.
- **When they use it:** When creating a new plan, comparing multiple plans, tuning assumptions, or reviewing one plan in depth.
- **Success looks like:** The user can define a plan, understand required savings, track FI and GW progress, and adjust assumptions with confidence.

## What this page includes
| Area / feature | One-line purpose |
|---|---|
| Header and tabs | Switches between Plans and Calculator. |
| Plans header actions | Opens Mix & Match and new-goal creation. |
| Goal toolbar | Filters plans, counts results, enters compare mode, and switches grid/list view. |
| Goal cards | Shows compact progress summaries for each plan. |
| Compare mode | Lets the user select multiple plans and compare them side by side. |
| Goal wizard | Creates or edits a plan through a five-step flow. |
| Mix & Match modal | Combines one FI base plan with selected GW goals from other plans. |
| Goal detail page | Shows a single plan with summary, FI, GW, settings, and analysis. |
| Growth Settings | Adjusts global planning assumptions. |
| Calculator tab | Opens the FI calculator tool. |

## Core user workflows
### Create a new goal
- **Start:** User opens Plans and clicks **+ New Goal**.
- **User intent:** Define a new retirement plan.
- **Steps:** 1. Name the goal. 2. Set the timeline. 3. Enter annual expenses. 4. Set growth assumptions. 5. Review and create.
- **End state:** The goal appears in Plans and can be opened in detail.
- **Notes:** The wizard can also start from a template.

### Filter, browse, and compare goals
- **Start:** User has multiple saved plans.
- **User intent:** Narrow choices or compare scenarios.
- **Steps:** 1. Apply filters. 2. Switch grid or list view if helpful. 3. Click **Compare** or use modifier-click selection. 4. Review the comparison table.
- **End state:** The user understands differences across plans.
- **Notes:** Reordering is disabled while filtered or while compare mode is active.

### Review and adjust a goal in detail
- **Start:** User opens a specific plan.
- **User intent:** Understand the plan and refine assumptions.
- **Steps:** 1. Review the summary card. 2. Review FI and GW sections. 3. Open **Growth Settings** if needed. 4. Optionally open **Analysis**.
- **End state:** The user knows required savings, current progress, and the effect of assumptions.
- **Notes:** The detail page supports previous/next goal navigation.

### Manage GW goals inside a plan
- **Start:** User is on a goal detail page.
- **User intent:** Add, edit, copy, or remove wealth-transfer goals tied to the plan.
- **Steps:** 1. Open the GW section. 2. Add a new GW goal or copy one from another plan. 3. Edit or delete existing items. 4. Review progress.
- **End state:** The current plan has the right set of GW targets.
- **Notes:** Each GW goal can be undone for 10 seconds after deletion is triggered.

### Run what-if analysis
- **Start:** User wants to understand pace and sustainability.
- **User intent:** See whether current or planned savings can support the goal through end of life.
- **Steps:** 1. Open **Analysis**. 2. Switch between **Projected** and **Planned**. 3. Change interval or switch between table and chart. 4. Review milestone points and balances.
- **End state:** The user sees a long-term projection instead of a single target number.
- **Notes:** Savings pace and analysis respond to budget history, balances, and global growth settings.

## Feature specs
### Header and top-level navigation
- **What it is:** The top of the Goals page with tabs for **Plans** and **Calculator**.
- **Why it exists:** It separates saved plans from the standalone planning tool.
- **Who sees it:** Always visible on the Goals page.
- **Data shown:** Page title **Goals**, the active tab, and top-level actions.
- **Actions available:** Switch tabs, open **Mix & Match**, and click **+ New Goal**.
- **Default state:** **Plans** is selected first.
- **Other states:** The **Calculator** tab can briefly show **Loading…** before the tool appears.
- **Rules:** **Mix & Match** only appears when the user has at least one FI goal and at least one GW goal.
- **Edge cases:** The user can reach the calculator without leaving Goals.
- **Related workflows:** Create a new goal; Run what-if analysis.

### Goal toolbar
- **What it is:** The control row above the plan cards.
- **Why it exists:** It helps the user count, filter, compare, and change the browsing layout.
- **Who sees it:** Users on the **Plans** tab.
- **Data shown:** Count labels such as **N goals** or **2 of 5**, filter pills, **Compare** or **Exit Compare**, **Grid view**, **List view**, and compare guidance text.
- **Actions available:** Apply or clear filters, enter compare mode, exit compare mode, and switch between grid and list view.
- **Default state:** No filters, standard browse mode, and the current saved layout.
- **Other states:** Active filters show badges and footer text such as **1 filter active** or **2 filters active** with **Clear all**.
- **Rules:** Filter categories are **Retirement Age**, **FI Goal**, and **Expense at Creation**. Dropdowns close with **Done**.
- **Edge cases:** If no saved goals exist, the page shows **No goals created yet. Click "New Goal" to get started.** If filters remove every result, it shows **No goals match the current filters.**
- **Related workflows:** Filter, browse, and compare goals.

### Goal cards
- **What it is:** The saved-plan cards shown in grid or list view.
- **Why it exists:** They give the user a compact way to browse plans and spot progress quickly.
- **Who sees it:** Users with at least one saved goal.
- **Data shown:** Goal name, retirement year, FI progress bar and percent, FI goal amount, optional GW totals, and the **FI only** badge when there are no GW goals.
- **Actions available:** Open the plan, select it in compare mode, drag or move it to a new position, rename it, duplicate it, or delete it.
- **Default state:** Cards appear in the saved order.
- **Other states:** Compare-selection state, drag state, inline rename state, and context-menu state with **Open**, **Rename**, **Duplicate**, and **Delete**.
- **Rules:** Reordering is available in normal browsing mode but not while compare mode is active or while filters are narrowing the list.
- **Edge cases:** Move labels adjust by layout, such as **Move [goal name] left/right** in grid view and **Move [goal name] up/down** in list view.
- **Related workflows:** Filter, browse, and compare goals.

### Compare mode
- **What it is:** The side-by-side comparison experience for multiple plans.
- **Why it exists:** It helps the user evaluate tradeoffs across scenarios.
- **Who sees it:** Users who enter compare mode.
- **Data shown:** Compare hint text, the number of selected goals, section headers **Financial Independence** and optionally **Generational Wealth**, and rows such as **Goal Created**, **Goal End Year**, **Retirement Age**, **Retirement Date**, **Growth Rate**, **Annual Expense (at creation)**, **Annual Expense (at retirement)**, **FI Goal**, **Inflation Rate**, **Progress**, **# of Goals**, and **Total PV at Retirement**.
- **Actions available:** Select and deselect cards, click **Delete selected**, or click **Done**.
- **Default state:** Starts with selection guidance and no comparison table until the user selects enough plans.
- **Other states:** Selection bar with text like **1 goal selected** or **3 goals selected**.
- **Rules:** The compare hint uses the platform-appropriate modifier key and tells the user how to add or remove plans from the comparison.
- **Edge cases:** GW comparison rows only appear when at least one compared plan has GW goals.
- **Related workflows:** Filter, browse, and compare goals.

### Goal wizard
- **What it is:** The five-step flow used to create or edit a plan.
- **Why it exists:** It breaks long-term planning into manageable steps.
- **Who sees it:** Users who click **+ New Goal**, edit an existing goal, or start from a template.
- **Data shown:** Step labels **Name**, **Timeline**, **Expenses**, **Parameters**, and **Review**; prompts such as **What do you want to call this goal?**, **When are you creating this goal?**, **When should this goal end?**, **At what age do you want to retire?**, **What are your annual expenses?**, and **Set your financial parameters**; and review rows such as **Goal Name**, **Created On**, **Retirement Age**, **Annual Expense**, **Growth**, **Retirement**, **FI Goal**, and **Expense at Retirement**.
- **Actions available:** Use or hide templates, move **← Back** or **Next →**, **Cancel**, and finish with **Create Goal** or **Update Goal**.
- **Default state:** Opens on **Name**.
- **Other states:** Template picker with **Choose a template**, template cards such as **Early Retirement**, **Standard Retirement**, **Coast FI**, **Fat FI**, and **Barista FI**, and validation states.
- **Rules:** Validation messages include **Please enter a goal name**, **Please add your birthday in your profile first**, **Please enter the goal creation date**, **Please enter the goal end year**, **Goal end date must be after the start date**, **Goal end date must be within 100 years of your date of birth**, **Please enter a valid retirement age**, **Please enter a valid annual expense**, and **Please enter the growth rate**.
- **Edge cases:** The wizard can offer helper actions such as **🎲 Pick random name**, **Use Recommended**, and **Set to 100th birthday**.
- **Related workflows:** Create a new goal.

### Mix & Match modal
- **What it is:** A planning modal titled **Mix & Match**.
- **Why it exists:** It lets the user test a combined scenario using one FI base plan and GW goals from other plans.
- **Who sees it:** Users with at least one FI goal and at least one GW goal who open the modal.
- **Data shown:** The subtitle **Pick an FI base and any GW goals to preview a combined goal**, columns **Base Goal** and **Goals**, the GW empty state **No GW goals found across any goals.**, and a preview headed **Preview at retirement (YYYY)** when the retirement year is known.
- **Actions available:** Select a base goal, select GW goals, click **Create as New Goal →**, or click **Cancel**.
- **Default state:** Opens with no combined goal yet saved.
- **Other states:** Preview can show the base goal, the selected GW goals, and **Total**.
- **Rules:** The created goal is named from the base goal plus **– Mixed**.
- **Edge cases:** The modal can be available even when only a small number of goals qualify.
- **Related workflows:** Create a new goal; Filter, browse, and compare goals.

### Goal detail page
- **What it is:** The full-page view for one saved plan.
- **Why it exists:** It gives the user the deepest planning detail and all plan-management actions.
- **Who sees it:** Users who open a goal card.
- **Data shown:** Back link **Goals**, the current goal name, **Goal X of Y**, buttons for **Previous goal** and **Next goal**, the action menu, the summary card, the **Financial Independence** section, the **Generational Wealth** section, and optional **Analysis**.
- **Actions available:** Rename the goal, duplicate it, delete it, move to adjacent goals, toggle **Growth Settings**, open **Analysis**, change the summary year selector, and switch savings values between monthly and yearly display.
- **Default state:** Opens on the selected goal with summary, FI, and GW sections visible.
- **Other states:** Not-found state **This goal may have been deleted or the link is no longer valid.** with **← Back to Goals**.
- **Rules:** The goal actions menu contains **Rename**, **Duplicate**, and **Delete**.
- **Edge cases:** The page can show no-goal guidance such as **Set an FI target or add GW goals to see your savings plan.**
- **Related workflows:** Review and adjust a goal in detail; Manage GW goals inside a plan.

### Growth Settings
- **What it is:** The expandable **Growth Settings** panel inside goal detail.
- **Why it exists:** It lets the user adjust the planning assumptions that affect projections.
- **Who sees it:** Users on a goal detail page.
- **Data shown:** Sections **Growth** and **Allocation**, plus fields such as **Pre-[boundary age]**, **Post-[boundary age]**, **GW**, **Inflation**, **Boundary**, **Retirement cap**, and **Non-retirement minimum**.
- **Actions available:** Edit fields and collapse or reopen the panel.
- **Default state:** Collapsed.
- **Other states:** Expanded settings editor.
- **Rules:** Changes commit when the user leaves the field.
- **Edge cases:** Different units appear depending on the field, including percent, years, and dollars per month.
- **Related workflows:** Review and adjust a goal in detail; Run what-if analysis.

### GW section
- **What it is:** The **Generational Wealth** section inside goal detail.
- **Why it exists:** It lets the user add, track, and manage wealth-transfer targets tied to the plan.
- **Who sees it:** Users on a goal detail page.
- **Data shown:** Empty state **No generational wealth goals yet.**, action buttons **+ New GW goal** and **Copy from existing**, and per-goal cards with labels, progress text, and actions.
- **Actions available:** Add a new GW goal, copy one from another goal, edit an existing GW goal, delete a GW goal, or undo a recent delete.
- **Default state:** Shows either the empty state or the current set of GW goals.
- **Other states:** Add form with **Goal label**, **Age at disbursement**, **Target amount (YYYY $)**, **Add goal**, and **Cancel**; copy picker with **Copy from existing** and **Cancel**; pending-delete state **Goal will be deleted in 10s** with **Undo**.
- **Rules:** Validation includes **Please enter a label for this goal.**, **Disbursement age must be greater than your current age (N).**, and **Enter a valid target amount.**
- **Edge cases:** A goal without a label can display as **Unnamed goal**.
- **Related workflows:** Manage GW goals inside a plan.

### Analysis section
- **What it is:** The long-term projection area toggled by **Analysis** and **Close Analysis**.
- **Why it exists:** It lets the user move beyond a single goal number and see the full lifecycle of a plan.
- **Who sees it:** Users on a goal detail page who open the section.
- **Data shown:** Title **Analysis - [goal name]**, subheading **Full Lifecycle - Projected** or **Full Lifecycle - Planned**, empty message **No projection available - check retirement date and goal end year.**, scenario buttons **Projected ($X/mo)** and **Planned ($Y/mo)**, interval buttons **Monthly**, **Yearly**, **Every 5 Yrs**, and **Every 10 Yrs**, view toggles **View Table** and **View Chart**, and chart or table outputs.
- **Actions available:** Open or close the section, switch scenario, change interval, and switch between chart and table.
- **Default state:** Hidden until the user opens it.
- **Other states:** Chart mode, table mode, projected scenario, and planned scenario.
- **Rules:** The table includes headers such as **Month**, **Phase**, interval-specific expense, **Non-Retirement**, **Retirement (Primary)**, **Retirement (Partner)**, and **Portfolio Balance**.
- **Edge cases:** Milestone labels can include growth-rate changes, **Primary**, **Partner**, and **F.I.R.E.**
- **Related workflows:** Run what-if analysis.

### Calculator tab
- **What it is:** The FI calculator experience embedded under the **Calculator** tab.
- **Why it exists:** It gives the user a faster what-if tool separate from saved plans.
- **Who sees it:** Users who switch to **Calculator**.
- **Data shown:** The calculator interface and a brief **Loading…** fallback while it opens.
- **Actions available:** Use the calculator without leaving Goals.
- **Default state:** Hidden until the user selects the tab.
- **Other states:** Loading fallback, then the full calculator.
- **Rules:** The calculator is part of the Goals destination, not a separate top-level page.
- **Edge cases:** None beyond the brief loading state.
- **Related workflows:** Run what-if analysis.

## Page-level states
- **First-time / empty:** The Plans view shows **No goals created yet. Click "New Goal" to get started.**
- **Returning / populated:** Plan cards, filters, compare mode, detail pages, and the calculator all become available.
- **Error / blocked:** Invalid goal links show the dedicated not-found screen with a path back to Goals.

## Data and decisions
- **User inputs captured:** Goal name, dates, retirement age, annual expense, growth, template choice, compare selections, grid/list view choice, goal order, rename actions, GW goal fields, growth settings, analysis toggles, year selector choice, and optional savings overrides.
- **Derived values shown:** FI target, retirement date, FI and GW progress, monthly or yearly savings needed, GW present value at retirement, comparison metrics, on-track messaging, and lifecycle chart and table outputs.
- **Saved choices / preferences:** Goal definitions, GW goal definitions, saved order, layout choice, growth settings, and any saved overrides the page exposes.
- **Cross-page impact:** Goals pulls balances from Net Worth, budget history from Budget, and sends progress back to Home.

## Open questions / known gaps
- The compare view shows each goal's stored **Growth Rate**, while detail math can also reflect the current global Growth Settings, so users can see two valid but different growth stories at once.
- The UI exposes global Growth Settings clearly, but some deeper per-goal override behavior is not surfaced as clearly in the visible experience.
- Some older labels, such as **Goal End Year**, remain in comparison even though the creation flow now asks a fuller end-date question.
