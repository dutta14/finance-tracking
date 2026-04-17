# Contributing

## Prerequisites

- Node.js 18+
- npm

## Getting Started

```bash
git clone https://github.com/<your-username>/finance-tracking.git
cd finance-tracking
npm install
npm run dev
```

Dev server runs at `http://localhost:5173` with hot reload.

### Build & Deploy

```bash
npm run build      # Production build to dist/
npm run preview    # Preview production build locally
npm run deploy     # Build + deploy to GitHub Pages
```

## Project Structure

```
src/
├── App.tsx                  # Root component, routing, GitHub sync orchestration
├── main.tsx                 # React entry point
├── types.ts                 # Shared types (PageType, FinancialGoal, GwGoal, etc.)
├── components/              # Shared UI components
│   ├── SidebarNavigation    # Main nav with goal list, multi-select, settings
│   ├── SidebarToggle        # Mobile sidebar toggle
│   ├── GoalDetailedCard     # Full goal card with progress
│   ├── GoalMiniCard         # Compact goal card
│   ├── GoalCardActions      # Edit/delete actions on goal cards
│   ├── GoalActionsMenu      # Context menu for goal operations
│   ├── ProfileModal         # View/edit user profile
│   ├── GwUnlockModal        # Gate for withdrawal goal features
│   ├── UndoToast            # 10-second undo notification
│   └── Icons                # Shared SVG icon components
├── hooks/
│   ├── useProfile.ts        # Profile state (name, birthday, avatar, partner)
│   └── useGitHubSync.ts     # GitHub sync engine (encrypted tokens, auto-sync, restore)
├── pages/
│   ├── home/                # Dashboard with draggable cards
│   ├── goal/                # FI goals + withdrawal goals
│   │   ├── Goal.tsx         # Goal list page
│   │   ├── GoalSoloPage.tsx # Single-goal detail view
│   │   ├── hooks/           # useFinancialGoals, useGwGoals
│   │   ├── components/      # GoalForm, GoalMixer, DetailPane, FilterBar
│   │   └── utils/           # FI math, formatting
│   ├── data/                # Accounts, balances, charts
│   │   ├── Data.tsx         # Main data page
│   │   ├── BalanceSpreadsheet.tsx
│   │   ├── BalanceCharts.tsx
│   │   ├── AccountForm.tsx
│   │   ├── csvImport.ts / csvExport.ts
│   │   └── types.ts
│   ├── budget/              # CSV-based budget tracking
│   │   ├── Budget.tsx
│   │   ├── components/      # Header, aggregated view, Sankey, bar charts
│   │   ├── hooks/           # useBudgetStore, useCategoryManager
│   │   └── utils/           # csvParser, budgetStorage, budgetGitHubSync
│   ├── allocation/          # Asset allocation & rebalancing
│   │   ├── Allocation.tsx
│   │   ├── components/      # RatioBuilder, RatioTabs, RebalancePanel, GoalSection
│   │   └── hooks/           # useAllocationData, useCustomRatios, useGoals
│   ├── taxes/               # Tax document management
│   │   ├── Taxes.tsx        # Checklist UI with file upload
│   │   ├── useTaxStore.ts   # CRUD for tax items/files
│   │   ├── buildTaxTree.ts  # Drive integration (renders tax files in Drive)
│   │   ├── taxGitHubSync.ts # Upload tax PDFs as individual files to GitHub
│   │   └── types.ts
│   ├── drive/               # Hierarchical file browser
│   │   ├── Drive.tsx
│   │   ├── buildBudgetTree.ts  # Assembles Drive tree from budget + tax data
│   │   ├── CSVViewer.tsx
│   │   └── useDriveUpload.ts
│   ├── tools/               # FI Calculator, Savings/Growth Tracker, PDF-to-CSV
│   │   ├── Tools.tsx
│   │   └── components/
│   └── settings/            # Settings modal (refactored package)
│       ├── SettingsModal.tsx # Shell: nav sidebar + pane switching
│       ├── SettingsMenu.tsx  # Trigger button + modal state
│       ├── types.ts         # Prop interfaces
│       ├── utils.ts         # Color palettes, date formatters
│       ├── index.ts         # Barrel exports
│       └── components/      # ProfilePane, GitHubSyncPane, AppearancePane,
│                            # AdvancedPane, LabsPane
├── styles/                  # All CSS files (one per component/page)
styles/                      # Global styles
├── normalize.css
└── app.css
```

## Architecture Notes

### Data Storage

All state is persisted to `localStorage`. There is no backend. Key storage keys:

| Key                        | Content                                        |
| -------------------------- | ---------------------------------------------- |
| `fi-goals`                 | Financial independence goals                   |
| `gw-goals`                 | Generational wealth goals                      |
| `user-profile`             | Profile (name, birthday, avatar, partner)      |
| `data-accounts`            | Account definitions                            |
| `data-balances`            | Monthly balance entries                        |
| `budget-store`             | Budget CSVs and category config                |
| `tax-store`                | Tax checklist items with embedded file content |
| `tax-templates`            | Saved tax checklist templates                  |
| `allocation-custom-ratios` | Custom allocation ratio sets                   |
| `fi-simulations`           | Saved FI calculator simulations                |
| `sgt-overrides`            | Savings/growth tracker manual overrides        |
| `gh-sync-config`           | GitHub sync configuration                      |
| `gh-encrypted-token`       | AES-256 encrypted GitHub PAT                   |
| `accentTheme`              | Selected accent color theme                    |

### GitHub Sync

The sync engine in `useGitHubSync.ts` pushes data to a private GitHub repo via the Contents API:

- **Main file** (`finance-backup.json`) — goals, profile, settings
- **Data file** (`-data.json`) — accounts and balances
- **Tools file** (`-tools.json`) — FI simulations, SGT overrides
- **Allocation file** (`-allocation.json`) — custom ratios
- **Taxes file** (`-taxes.json`) — tax checklist metadata + templates
- **Tax documents** (`taxes/<year>/<name>.pdf`) — individual files via `taxGitHubSync.ts`
- **Budget CSVs** (`budget/<month>.csv`) — individual files via `budgetGitHubSync.ts`

Auto-sync uses a 60-second debounce. Change detection strips `exportedAt` timestamps to avoid false positives.

Token encryption uses AES-256-GCM with PBKDF2 key derivation (100k iterations, random salt and IV per encryption).

### Styling

- One CSS file per component/page in `src/styles/`.
- Dark mode via `body.dark` class.
- Accent theming via `--accent` and `--accent-rgb` CSS custom properties.
- Responsive breakpoints: desktop (1200px+), tablet (768–1199px), mobile (≤900px sidebar collapse).

### Events

Custom DOM events for cross-component communication:

| Event               | Source                  | Purpose                            |
| ------------------- | ----------------------- | ---------------------------------- |
| `tax-store-changed` | `useTaxStore.persist()` | Triggers auto-sync of tax data     |
| `labs-changed`      | LabsPane                | Refreshes Tools page feature gates |

## Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Start dev server               |
| `npm run build`   | Production build               |
| `npm run preview` | Preview production build       |
| `npm run deploy`  | Build + deploy to GitHub Pages |
