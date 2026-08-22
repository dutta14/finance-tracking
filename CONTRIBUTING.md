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
```

Deployment is automated: every push to `main` runs `.github/workflows/ci.yml`, which builds and deploys to GitHub Pages via `actions/deploy-pages` after CI + E2E pass.

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
│   ├── FileStoreContext     # File System Access API integration and demo mode
│   ├── GoalsContext         # FI + GW goal CRUD and state
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
│   ├── fileStoreTypes.ts    # FileStore interface (the contract every store must satisfy)
│   ├── fileStore.ts         # FileSystemFileStore — File System Access API implementation
│   ├── memoryFileStore.ts   # MemoryFileStore — in-memory implementation for tests and demo mode
│   ├── csvUtils.ts          # CSV serialization / deserialization helpers
│   ├── balanceStorage.ts    # Balance read/write against the FileStore
│   ├── handlePersistence.ts # Saves and loads the FileSystemDirectoryHandle in IndexedDB
│   └── storage.ts           # Thin localStorage wrapper for UI preferences only
└── test/
    ├── setup.ts             # Vitest global setup (jsdom, testing-library matchers)
    └── fileStoreTestUtils.tsx  # FileStoreTestProvider and makeFileStoreValue helpers
```

## Architecture Notes

### Data Storage

All financial data is stored as plain files in a folder the user chooses on their own disk, using the browser's File System Access API. The central abstraction is the `FileStore` interface in `src/utils/fileStoreTypes.ts`. There are two implementations:

- `FileSystemFileStore` (`src/utils/fileStore.ts`) — the production implementation. Backed by a `FileSystemDirectoryHandle`. Writes are debounced 300ms and guarded with `navigator.locks` so concurrent tabs never interleave. Cross-tab cache invalidation uses a `BroadcastChannel`.
- `MemoryFileStore` (`src/utils/memoryFileStore.ts`) — an in-memory implementation used for tests and Demo Mode.

`FileStoreContext` (`src/contexts/FileStoreContext.tsx`) owns the active store instance and exposes `pickFolder`, `disconnect`, `enterDemo`, and `exitDemo`. Components get the store via `useFileStore()`.

The chosen folder handle is persisted in IndexedDB via `src/utils/handlePersistence.ts` so the browser can reconnect on the next visit without re-prompting.

**File layout inside the chosen folder:**

| Path | Content |
| ---- | ------- |
| `profile.json` | Name, birthday, partner |
| `accounts.json` | Account definitions |
| `balances/{year}.csv` | Monthly balances (columns: `month,accountId,balance`) |
| `transactions/{year}/{yyyy-mm}.csv` | Budget transactions per month |
| `budget/categories.json` | Category groups and tracked years |
| `budget/summary-cache.json` | Derived savings-rate summary |
| `goals.json` | `{ financialGoals, gwGoals }` |
| `taxes/{year}.json` | Tax checklist for that year |
| `taxes/templates.json` | Reusable tax checklists |
| `taxes/{year}/files/{filename}` | Uploaded tax documents |
| `allocation.json` | Custom allocation ratios |
| `fi-simulations.json` | Saved FI calculator simulations |
| `leverage.json` | Leverage tool data |
| `savings-tracker-overrides.json` | Savings/growth tracker manual overrides |
| `paydown-loans.json` | Loan paydown tool data |

**UI preferences in `localStorage` (not financial data):**

`darkMode`, `accentTheme`, `allowCsvImport`, `goal-view-mode`, `home-card-order`, `onboarding-dismissed`, `lab-pdf-to-csv`, and the feature-flag keys (`flag-rollout-cache`, `flag-overrides`, `flag-user-seed`).

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
| `labs-changed`      | LabsPane                | Refreshes Tools page feature gates |

## Scripts

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `npm run dev`           | Start dev server                           |
| `npm run build`         | Production build                           |
| `npm run preview`       | Preview production build                   |
| `npm test`              | Vitest in watch mode                       |
| `npm run test:run`      | Single test run (used in CI)               |
| `npm run test:coverage` | Test run with coverage report              |
| `npm run lint`          | ESLint check                               |
| `npm run lint:fix`      | ESLint auto-fix                            |
| `npm run format`        | Prettier write                             |
| `npm run format:check`  | Prettier check (used in CI)                |
| `npm run typecheck`     | TypeScript check (used in CI and pre-push) |

## Contexts

`App.tsx` composes all providers in a fixed nesting order:

```
FlagProvider → SettingsProvider → FileStoreProvider → DataProvider →
GoalsProvider → LayoutProvider → AppShell
```

Each context lives in `src/contexts/` and exports a provider + a `useXxx()` hook. Components consume state via the hooks (e.g., `useSettings()`, `useGoals()`, `useFileStore()`, `useLayout()`). Never access context values directly — always use the exported hook.

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
- Mock network requests with `msw` when testing flag fetching.
- Test file naming: `*.test.ts` or `*.test.tsx`.

**Seeding data in tests:** Do not seed `localStorage` for financial data. Use a `MemoryFileStore` and wrap the component under test with `FileStoreTestProvider`:

```tsx
import { FileStoreTestProvider, makeFileStoreValue } from '../test/fileStoreTestUtils'

const store = new MemoryFileStore()
// write your seed data into store before rendering
render(
  <FileStoreTestProvider value={makeFileStoreValue({ fileStore: store })}>
    <ComponentUnderTest />
  </FileStoreTestProvider>
)
```

`makeFileStoreValue` accepts partial overrides and fills in sensible defaults for `isReady`, `folderName`, and the callback functions.

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
4. `npx tsc --noEmit`
5. `npx vitest run`

### Deployment

Deployment is automated. Every push to `main` triggers `.github/workflows/ci.yml`, which runs lint + unit tests + build + E2E, then deploys to GitHub Pages via `actions/deploy-pages`. No manual deploy step is needed.

## Commit Conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/) style: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- To auto-close a GitHub issue, include `Fixes #N` in the commit **body** (not just `(#N)` in the subject line).
- The pre-commit hook enforces lint, format, and test passing — commits will fail if any check does not pass.

## Regenerating Screenshots

The `docs/screenshots/` directory contains 12 PNGs that are embedded in the user-facing README. They are committed to the repo and serve as the source of truth for documentation — even though the files are several hundred KB each, this is intentional.

### When to regenerate

- Any UI change that affects a captured screen (Home, Net Worth, Goals, Budget, Taxes, Drive, Settings, or the folder picker / add-account onboarding states)
- Any change to the README that surfaces a different feature or flow
- New release builds where the screenshots have drifted from the current visual design

### How to regenerate

```bash
npm run dev          # in one terminal
npm run screenshots  # in another terminal
```

`scripts/capture-screenshots.ts` seeds a fixed fake persona ("Avery Chen") into a `MemoryFileStore` and uses Playwright to capture each screen at 1440×900 @ 2× device scale. The browser clock is pinned to June 1, 2025 so the seeded May-2025 data is "last month" regardless of when the script is run. All 12 PNGs land in `docs/screenshots/`.
