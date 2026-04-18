# GoalDrawer Component

## Purpose

Full-width overlay drawer that opens when a user clicks a goal card. Replaces both GoalDetailPane (sidebar) and GoalSoloPage (full route).

## Features

- **GoalDetailedCard** — editable goal parameters (inline editing)
- **Dive Deep** — collapsible deep analysis with projection charts
- **GwSection** — full CRUD for General Wealth goals (add, edit, delete)
- **SavingsPlan** — monthly savings projections with growth rate controls
- **Prev/Next stepper** — arrow key navigation between goals
- **Rename** — inline goal name editing
- **Actions menu** — rename, duplicate, delete
- **Esc to close**, backdrop click to close, body scroll locked

## Layout

Two-column, equal 50/50 split:
- **Left**: GoalDetailedCard + Dive Deep + GwSection
- **Right**: SavingsPlan

Stacks vertically at ≤1100px. Full-screen at ≤900px.

## CSS

Uses CSS variables from `colorThemes.css` — no hardcoded colors. Only `body.dark` override is the backdrop opacity (0.3 light → 0.5 dark).

## Props

```typescript
interface GoalDrawerProps {
  goal: FinancialGoal
  goals: FinancialGoal[]
  profileBirthday: string
  gwGoals: GwGoal[]
  onClose: () => void
  onNavigate: (goalId: number) => void
  onUpdateGoal: (goalId: number, goal: FinancialGoal) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  onRenameGoal: (goalId: number, name: string) => void
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onUpdateGwGoal: (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void
  onDeleteGwGoal: (id: number) => void
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Esc | Close drawer (or cancel rename if renaming) |
| ← | Previous goal |
| → | Next goal |
