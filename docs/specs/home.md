# Home

- **Status:** Current state
- **Owner:** Leo
- **Last updated:** 2025-06-09

## Page summary
- **Purpose:** Give the user a fast dashboard view of setup progress, current net worth, goal progress, balance trends, and latest asset allocation.
- **Primary user:** Someone tracking personal finances who wants a quick snapshot before going deeper.
- **When they use it:** On first setup, when checking progress, and when jumping into Net Worth, Goals, Budget, or Allocation work.
- **Success looks like:** The user can see what is missing, understand where they stand, and move into the next task with one click.

## What this page includes
| Area / feature | One-line purpose |
|---|---|
| Greeting | Personalizes the dashboard with a time-based welcome. |
| Setup guide restore link | Reopens the onboarding checklist after dismissal. |
| Setup guide | Walks first-time users through the four setup tasks that unlock the dashboard. |
| Net Worth card | Shows latest total net worth, month-over-month change, and FI/GW breakdown. |
| Charts card | Shows compact balance-history charts with quick date filters. |
| Goals card | Shows up to three goal summaries and FI/GW progress. |
| Asset Allocation card | Shows the latest portfolio mix for Total, FI, and GW. |
| Card reordering controls | Lets the user change dashboard card order. |

## Core user workflows
### First-time setup
- **Start:** User lands on Home with incomplete setup.
- **User intent:** Make the dashboard useful as quickly as possible.
- **Steps:** 1. Review the setup guide. 2. Open the current step. 3. Complete accounts, balances, goals, and budget setup in order. 4. Return to Home and watch progress update.
- **End state:** The setup guide reaches 4 of 4 complete and disappears.
- **Notes:** Only the first incomplete step is actionable.

### Review current financial snapshot
- **Start:** User opens Home after data exists.
- **User intent:** Check current status without opening deeper pages.
- **Steps:** 1. Review net worth. 2. Review chart trend. 3. Review goal progress. 4. Review allocation mix.
- **End state:** User understands current position and any gaps.
- **Notes:** Each card has a direct drill-in action.

### Reorder the dashboard
- **Start:** User wants a different card order.
- **User intent:** Put the most useful cards first.
- **Steps:** 1. Drag cards on larger screens, or use move controls on smaller screens. 2. Drop or move a card into a new position. 3. Reload later and see the same order.
- **End state:** Card order is updated and remembered.
- **Notes:** Boundary move buttons are disabled.

### Resume onboarding after dismissal
- **Start:** User dismissed setup before finishing.
- **User intent:** Bring the guide back.
- **Steps:** 1. Click **Setup guide** beside the greeting. 2. Review the checklist again. 3. Continue with the current step.
- **End state:** Setup guide is visible again.
- **Notes:** The restore link only appears while setup is still incomplete.

## Feature specs
### Greeting
- **What it is:** A large greeting that reads **Good morning**, **Good afternoon**, or **Good evening**.
- **Why it exists:** It makes the dashboard feel personal and anchors the page.
- **Who sees it:** Always visible.
- **Data shown:** Time-based greeting text and, when available, the saved first name.
- **Actions available:** None.
- **Default state:** Shows the time-based greeting without requiring any setup.
- **Other states:** Can show personalized text such as **Good morning, Anindya**.
- **Rules:** Morning is before noon, afternoon is noon through 4:59 PM, and evening is 5:00 PM onward.
- **Edge cases:** The greeting still appears even when no profile information exists.
- **Related workflows:** Review current financial snapshot; Resume onboarding after dismissal.

### Setup guide restore link
- **What it is:** A small **Setup guide** button beside the greeting.
- **Why it exists:** It lets the user bring onboarding back after dismissing it too early.
- **Who sees it:** Only users who dismissed onboarding before finishing all setup steps.
- **Data shown:** The label **Setup guide**.
- **Actions available:** Restore the setup guide in place.
- **Default state:** Hidden.
- **Other states:** Visible when onboarding is incomplete and previously dismissed.
- **Rules:** It disappears once all setup steps are complete.
- **Edge cases:** It does not appear for users who already finished setup, even if they dismissed the guide in the past.
- **Related workflows:** Resume onboarding after dismissal.

### Setup guide
- **What it is:** A checklist titled **Get started with your finances** with a count such as **0 of 4 complete** and a progress bar.
- **Why it exists:** It shows first-time users exactly what to do to unlock the rest of the product.
- **Who sees it:** Users whose setup is not yet complete and who have not dismissed the guide.
- **Data shown:** Completion count, progress bar, and four steps: **Add your accounts**, **Record your first balance**, **Set a financial goal**, and **Import your first budget**.
- **Actions available:** Open the current step, or dismiss the guide with the close button.
- **Default state:** Appears above the dashboard cards when setup is incomplete.
- **Other states:** Completed steps show as done, the first incomplete step is active, and later steps remain visible but inactive.
- **Rules:** The step actions are **Add accounts →**, **Enter balances →**, **Create a goal →**, and **Upload CSV →**. Any account completes step 1, any balance month completes step 2, any visible goal completes step 3, and any imported budget file completes step 4.
- **Edge cases:** On small screens the steps become horizontally scrollable instead of shrinking too tightly.
- **Related workflows:** First-time setup.

### Net Worth card
- **What it is:** A dashboard card titled **Net Worth** with a **View Data →** link.
- **Why it exists:** It gives the user a fast read on current net worth and how it changed from the previous month.
- **Who sees it:** Always visible as one of the four dashboard cards.
- **Data shown:** Latest selected-month net worth, the month label, month-over-month change when a prior month exists, and expandable FI and GW breakdown rows.
- **Actions available:** Open the full Net Worth page, move backward or forward through months, jump to another month, and expand or collapse FI and GW detail rows.
- **Default state:** Shows the latest available month.
- **Other states:** Empty state with **Add accounts and record your first balance to see your net worth here.** and **Add your data →**; populated state with arrows and breakdowns.
- **Rules:** FI and GW parent rows always appear. Zero-value child rows are hidden. Previous-month change only appears when a previous month exists.
- **Edge cases:** If there is only one month of balance history, the card shows the total without a month-over-month delta.
- **Related workflows:** Review current financial snapshot.

### Charts card
- **What it is:** A dashboard card titled **Charts** with a **View Data →** link.
- **Why it exists:** It gives the user a compact trend view without leaving Home.
- **Who sees it:** Always visible as one of the four dashboard cards.
- **Data shown:** One of three chart modes, date filters, and custom from/to selectors when **Custom** is chosen.
- **Actions available:** Open the full Net Worth page, switch chart mode, switch date filter, and set custom year/month ranges.
- **Default state:** Starts on **Net Worth** with **12 mo** selected.
- **Other states:** Empty state with **Charts will appear once you have balance data across multiple months.** and **Record balances →**; populated state with chart tabs **FI vs GW**, **Net Worth**, and **Assets / Liabilities**.
- **Rules:** Date filters are **All**, **YTD**, **12 mo**, **Year-End**, and **Custom**. Custom range shows **Year**, **Month**, and **to** selectors.
- **Edge cases:** A custom range with no matching months can leave the chart area blank without a dedicated empty-state message.
- **Related workflows:** Review current financial snapshot.

### Goals card
- **What it is:** A dashboard card titled **Goals** with a **View Goals →** link.
- **Why it exists:** It shows whether major long-term goals are on track without opening the full Goals page.
- **Who sees it:** Always visible as one of the four dashboard cards.
- **Data shown:** Up to three goals, each with the goal name, FI progress, optional GW progress, FI target amount, GW goal count, and FI timing or savings message when available.
- **Actions available:** Open the full Goals page, open a goal detail page, or jump to Budget from the inline **Add budget data →** action.
- **Default state:** Shows up to the first three goals.
- **Other states:** Empty state with **Set an FI target or general wealth goal to start tracking your progress.** and **Create a goal →**; populated state with labels such as **FI by Mon YYYY**, **🎉 Goal reached!**, **Add budget data →**, or **Not reachable at current rate**.
- **Rules:** Progress is capped between 0% and 100%. Optional monthly savings appears as **$X/mo** when it is positive and relevant.
- **Edge cases:** If more than three goals exist, the card shows overflow text such as **+2 more goals**.
- **Related workflows:** Review current financial snapshot.

### Asset Allocation card
- **What it is:** A dashboard card titled **Asset Allocation** with a **View Allocation →** link.
- **Why it exists:** It helps the user understand how current holdings are distributed.
- **Who sees it:** Always visible as one of the four dashboard cards.
- **Data shown:** Latest-month allocation for **Total**, **FI**, and **GW**, plus either a stacked bar or donut view and either percentage or dollar legend values.
- **Actions available:** Open the full Allocation view, switch chart style, and switch legend mode between **%** and **$**.
- **Default state:** Uses the latest available balance month.
- **Other states:** Empty state with **See how your assets are distributed once you add accounts and balances.** and **Set up allocation →**; per-section empty state **No data**.
- **Rules:** Only active accounts contribute. Negative or zero buckets are hidden after liabilities are applied.
- **Edge cases:** One section can show **No data** while the other sections still render normally.
- **Related workflows:** Review current financial snapshot.

### Card reordering controls
- **What it is:** The drag handles and move controls that let the user personalize card order.
- **Why it exists:** It lets the user put the most useful information first.
- **Who sees it:** All users, with drag behavior emphasized on larger screens and move buttons emphasized on smaller screens.
- **Data shown:** The current card order and move labels such as **Move Net Worth up**, **Move Charts down**, **Move Goals up**, and **Move Allocation down**.
- **Actions available:** Drag cards, drop cards, or move cards up and down with buttons.
- **Default state:** Card order is Net Worth, Charts, Goals, Asset Allocation.
- **Other states:** Customized order after the user reorders cards.
- **Rules:** Boundary move buttons are disabled, and dropping a card into its current position makes no change.
- **Edge cases:** If a saved order becomes invalid, the page falls back to the default order.
- **Related workflows:** Reorder the dashboard.

## Page-level states
- **First-time / empty:** Greeting plus setup guide; each dashboard card can show its own empty state.
- **Returning / populated:** The page becomes a dashboard with snapshot cards, quick controls, and drill-in links.
- **Error / blocked:** A single broken card can fail without taking down the rest of the page.

## Data and decisions
- **User inputs captured:** Setup guide dismissal, setup guide restore action, card order, chart tab choice, chart date filter, custom chart range, net worth month navigation, FI/GW expand-collapse, and allocation display toggles.
- **Derived values shown:** Setup completion count, progress-bar percent, net worth total, month-over-month change, FI/GW balances, trend charts, FI timing labels, FI and GW progress percentages, monthly savings needed, and allocation percentages and values.
- **Saved choices / preferences:** Dismissed setup-guide state and dashboard card order.
- **Cross-page impact:** Home routes users into Net Worth, Goals, Budget, and Allocation, and it reflects data entered elsewhere, especially balances, goals, and budget history.

## Open questions / known gaps
- The Home charts card can end up visually blank for a custom date range with no matching months.
- The Goals card depends on budget data for FI timing, but the page does not explain how much budget history is needed before that timing becomes meaningful.
