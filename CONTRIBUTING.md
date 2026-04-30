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
├── App.tsx                  # Root component, routing, provider composition
├── main.tsx                 # React entry point
├── types.ts                 # Shared types (PageType, FinancialGoal, GwGoal, etc.)
├── components/              # Shared UI components
│   ├── SidebarNavigation    # Main nav with goal list, multi-select, settings
│   ├── SidebarToggle        # Mobile sidebar toggle
│   ├── SearchModal          # Global search (⌘K) with indexed navigation
│   ├── ErrorBoundary        # Top-level error boundary with fallback UI
│   ├── TermAbbr             # Tooltip definitions for FI terms
│   └── UndoToast            # 10-second undo notification
├── contexts/                # React context providers (see Contexts section)
│   ├── SettingsContext      # Dark mode, appearance, labs
│   ├── GitHubSyncContext    # Encrypted backup engine
│   ├── GoalsContext         # FI + GW goal CRUD and state
│   ├── BudgetSyncContext    # Budget GitHub sync coordination
│   ├── TaxSyncContext       # Tax document sync coordination
│   ├── ImportExportContext  # Data import/export logic
│   ├── LayoutContext        # Sidebar, mobile, search modal state
│   └── DataContext          # Accounts and balances
├── flags/                   # Feature flag system (see Feature Flags section)
│   ├── FlagContext.tsx      # Provider: fetches config, manages overrides
│   ├── flagSystem.ts        # Resolution logic (override > rollout > default)
│   ├── flagDefinitions.ts   # Flag names and defaults
│   ├── useFlag.ts           # Hook: useFlag('flag-name') → boolean
│   └── ModernDesignToggle   # Applies body.modern-design class when flag is on
├── search/                  # Search index builder
│   └── searchIndex.ts       # Indexes pages, goals, accounts for SearchModal
├── hooks/
│   ├── useProfile.ts        # Profile state (name, birthday, avatar, partner)
│   ├── useGitHubSync.ts     # GitHub sync engine (encrypted tokens, auto-sync)
│   └── useFocusTrap.ts      # Focus trap for modals
├── pages/
│   ├── home/                # Dashboard with draggable cards
│   │   ├── Home.tsx
│   │   ├── GoalsPeek.tsx    # Top 3 goals with progress bars
│   │   ├── NetWorthSummary, MiniCharts, AllocationBreakdown
│   │   └── WelcomeGuide.tsx # First-visit onboarding
│   ├── goal/                # FI goals + withdrawal goals
│   │   ├── Goal.tsx         # Goal list page
│   │   ├── components/      # GoalForm, GoalMixer, DetailPane, FilterBar,
│   │   │                    # TrajectorySparkline, TemplatePicker
│   │   ├── data/goalTemplates.ts  # Presets: Early Retirement, Coast FI, etc.
│   │   ├── hooks/           # useFinancialGoals, useGwGoals
│   │   └── utils/           # FI math, formatting
│   ├── data/                # Accounts, balances, charts
│   ├── budget/              # CSV-based budget tracking
│   ├── allocation/          # Asset allocation & rebalancing
│   ├── taxes/               # Tax document management
│   ├── drive/               # Hierarchical file browser
│   ├── tools/               # FI Calculator, Savings/Growth Tracker, PDF-to-CSV
│   └── settings/            # Settings modal (refactored package)
├── styles/                  # CSS files (one per component/page)
│   ├── colorThemes.css      # Base :root + body.dark variables
│   └── modern-design.css    # Modern design system (scoped under body.modern-design)
├── utils/
│   └── taxFileDB.ts         # IndexedDB for tax file blobs
└── test/
    └── setup.ts             # Vitest global setup (jsdom, testing-library matchers)
```

## Architecture Notes

### Data Storage

All state is persisted to `localStorage`. There is no backend. Key storage keys:

| Key                        | Content                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `fi-goals`                 | Financial independence goals                                   |
| `gw-goals`                 | Generational wealth goals                                      |
| `user-profile`             | Profile (name, birthday, avatar, partner)                      |
| `data-accounts`            | Account definitions                                            |
| `data-balances`            | Monthly balance entries                                        |
| `budget-store`             | Budget CSVs and category config                                |
| `tax-store`                | Tax checklist items with embedded file content                 |
| `tax-templates`            | Saved tax checklist templates                                  |
| `allocation-custom-ratios` | Custom allocation ratio sets                                   |
| `fi-simulations`           | Saved FI calculator simulations                                |
| `sgt-overrides`            | Savings/growth tracker manual overrides                        |
| `gh-sync-config`           | GitHub sync configuration                                      |
| `gh-encrypted-token`       | AES-256 encrypted GitHub PAT                                   |
| `accentTheme`              | Selected accent color theme (legacy, kept for backward compat) |
| `flag-rollout-cache`       | Cached feature flag rollout config                             |
| `flag-overrides`           | Local feature flag overrides (dev/testing)                     |
| `flag-user-seed`           | Stable random seed for percentage rollout                      |

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
- **Modern design system** — `modern-design.css`, scoped entirely under `body.modern-design`. Includes Inter font, translucent borders, composite shadows, premium inputs, dark surface layering, glass sidebar, pill tabs, accent glow, and borderless tables. Toggled via the `modern-design` feature flag (currently 100% rollout).
- Accent theming via `--accent` and `--accent-rgb` CSS custom properties.
- `colorThemes.css` contains only base `:root` and `body.dark` variables (the 9-color theme picker was removed).
- Responsive breakpoints: desktop (1200px+), tablet (768–1199px), mobile (≤900px sidebar collapse).

### Events

Custom DOM events for cross-component communication:

| Event               | Source                  | Purpose                            |
| ------------------- | ----------------------- | ---------------------------------- |
| `tax-store-changed` | `useTaxStore.persist()` | Triggers auto-sync of tax data     |
| `labs-changed`      | LabsPane                | Refreshes Tools page feature gates |

## Scripts

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `npm run dev`           | Start dev server                           |
| `npm run build`         | Production build                           |
| `npm run preview`       | Preview production build                   |
| `npm run deploy`        | Run tests + build + deploy to GitHub Pages |
| `npm test`              | Vitest in watch mode                       |
| `npm run test:run`      | Single test run (used in CI)               |
| `npm run test:coverage` | Test run with coverage report              |
| `npm run lint`          | ESLint check                               |
| `npm run lint:fix`      | ESLint auto-fix                            |
| `npm run format`        | Prettier write                             |
| `npm run format:check`  | Prettier check (used in CI)                |

## Contexts

`App.tsx` composes all providers in a fixed nesting order:

```
FlagProvider → SettingsProvider → DataProvider → GoalsProvider →
GitHubSyncProvider → BudgetSyncProvider → TaxSyncProvider →
ImportExportProvider → LayoutProvider → AppShell
```

Each context lives in `src/contexts/` and exports a provider + a `useXxx()` hook. Components consume state via the hooks (e.g., `useSettings()`, `useGoals()`, `useLayout()`). Never access context values directly — always use the exported hook.

## Feature Flags

The flag system in `src/flags/` controls runtime feature rollout:

1. **Config** — `feature-flags.json` at repo root. Deployed as a static file. Fetched publicly (no auth) on app load. Admin writes (updating rollout %) require GitHub auth.
2. **Resolution order** — local override → rollout percentage → default value. Each user gets a stable random seed (`flag-user-seed` in localStorage) for consistent percentage bucketing.
3. **Usage** — `const enabled = useFlag('modern-design')` in any component.
4. **Adding a flag** — Define in `flagDefinitions.ts`, add rollout config to `feature-flags.json`.
5. **Local override** — Set `flag-overrides` in localStorage (JSON object of `{ "flag-name": true/false }`) for development/testing.
6. **ModernDesignToggle** — A special component that adds/removes `body.modern-design` class based on the `modern-design` flag.

## Modern Design

All modern design styles live in `src/styles/modern-design.css`, scoped under `body.modern-design`. This means:

- Styles only apply when the feature flag is enabled and `ModernDesignToggle` adds the class.
- You can safely add new modern styles without affecting the classic design.
- When contributing new components, add modern variants inside a `body.modern-design` selector block.

## Testing

686+ tests across 56 files using **Vitest** + **@testing-library/react** + **jsdom**.

### Running tests

```bash
npm test               # Watch mode (development)
npm run test:run       # Single run (CI, pre-commit)
npm run test:coverage  # With coverage report
```

### Writing tests

- Co-locate test files with source: `Component.test.tsx` next to `Component.tsx`.
- Use `@testing-library/react` queries (`getByRole`, `getByText`, `getByLabelText`).
- Global setup in `src/test/setup.ts` (jsdom, `@testing-library/jest-dom` matchers).
- Mock network requests with `msw` when testing GitHub sync or flag fetching.
- Test file naming: `*.test.ts` or `*.test.tsx`.

## CI/CD

### GitHub Actions (`.github/workflows/ci.yml`)

Runs on every push and PR to `main`. Two jobs:

1. **`build`** — `npm ci` → `npm audit --audit-level=high` → Prettier check → ESLint (`--max-warnings=0`) → Vitest → `vite build`. On push to main, uploads the `dist/` artifact for Pages.
2. **`deploy`** — Runs only on push to `main`, after `build` passes. Deploys to GitHub Pages via `actions/deploy-pages@v4`.

**Setup required:** Repository Settings → Pages → Source = "GitHub Actions".

### Pre-commit hook (`.husky/pre-commit`)

Runs automatically before each commit:

1. `npm audit --audit-level=high`
2. `npx prettier --check src/`
3. `npx eslint src/ --max-warnings=0`
4. `npx vitest run`

### Manual deploy

```bash
npm run deploy   # Runs tests, builds, then deploys via gh-pages
```

## Commit Conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/) style: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- To auto-close a GitHub issue, include `Fixes #N` in the commit **body** (not just `(#N)` in the subject line).
- The pre-commit hook enforces lint, format, and test passing — commits will fail if any check does not pass.
