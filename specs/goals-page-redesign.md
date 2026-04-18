# Goals Page Redesign — Option B: Rich Grid + Full-View Drawer

## Decision

PM and Designer both recommended Option B over Option A (current layout with polish).

**Option B** replaces the two-path navigation (grid → sidebar pane OR grid → solo page) with a single unified pattern: **grid → full-width drawer overlay**.

## What Changed

### Before
- Goals grid with compact mini cards (name, FI goal, GW total)
- Single-click → 420px right sidebar pane (GoalDetailPane)
- Double-click / "Go to Goal" → full page route at `/goal/:id` (GoalSoloPage)
- Two separate ways to view the same data, with different feature sets

### After
- Goals grid with enriched mini cards (name, retirement year, progress bar, FI goal, GW total)
- Single-click → full-width drawer overlay with ALL features
- No separate solo page route — drawer IS the detail view
- One path, one component, full feature parity

## Removed
- `GoalSoloPage.tsx` — absorbed into GoalDrawer
- `GoalDetailPane.tsx` — replaced by GoalDrawer
- `/goal/:id` route — redirects to `/goal`
- `goal-solo` page type
- `onGoToGoal`, `onGoToGoalEdit`, `onGoToGoalAddGw` prop chain

## Why
- Users shouldn't have two different paths to the same data
- The drawer provides full context (edit, dive deep, GW CRUD, savings plan) without leaving the grid
- Fewer components, simpler prop chain, less code to maintain
