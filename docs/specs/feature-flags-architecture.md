# Feature Flag System — Architecture Proposal

**Issue:** #19 (redesigned from "Modern Design toggle" → general-purpose flag system)  
**Author:** Alex (Tech Lead)  
**Status:** Draft  
**Date:** 2026-07-01

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Repository (dutta14/finance-tracking)                │
│                                                             │
│  feature-flags.json  ← single source of truth               │
│  (committed to main branch)                                 │
└────────────────────────────┬────────────────────────────────┘
                             │ GitHub Contents API (GET)
                             │ (uses existing PAT)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Client SPA                                                 │
│                                                             │
│  ┌───────────────┐   ┌──────────────────┐                  │
│  │ FlagProvider  │──▶│ localStorage     │ (cache layer)    │
│  │ (React ctx)   │   │ "ff-cache"       │                  │
│  └───────┬───────┘   └──────────────────┘                  │
│          │                                                  │
│          ▼                                                  │
│  ┌───────────────┐   ┌──────────────────┐                  │
│  │ useFlag()     │   │ Admin Panel      │                  │
│  │ hook          │   │ (Settings > Flags)│                  │
│  └───────────────┘   └──────────────────┘                  │
│                              │                              │
│                              │ GitHub Contents API (PUT)     │
│                              ▼                              │
│                       Writes back to feature-flags.json     │
└─────────────────────────────────────────────────────────────┘
```

**Key decisions:**
- Flag config lives in a **JSON file committed to the repo** (`feature-flags.json` at root)
- Fetched at runtime via GitHub Contents API (same auth path as existing sync)
- Cached in localStorage with a TTL
- Admin UI is a new section in the existing Settings modal
- Environment is determined by URL hostname

---

## 2. Flag Schema

```typescript
// src/flags/types.ts

type FlagValueType = 'boolean' | 'string' | 'number' | 'json'

interface FlagEnvironmentConfig {
  /** Value for this environment. Overrides the top-level defaultValue. */
  value: FlagValue
  /** 0–100. For booleans: % chance of resolving true. For multi-variant: used with variants. */
  percentage?: number
}

type FlagValue = boolean | string | number | Record<string, unknown>

interface FlagDefinition {
  /** Unique kebab-case identifier, e.g. "modern-design" */
  id: string
  /** Human-readable name for admin UI */
  name: string
  /** What this flag controls */
  description: string
  /** The value type this flag holds */
  type: FlagValueType
  /** Default value used when no environment override matches */
  defaultValue: FlagValue
  /** Per-environment overrides */
  environments?: {
    production?: FlagEnvironmentConfig
    staging?: FlagEnvironmentConfig
  }
  /** When this flag was created (ISO string) */
  createdAt: string
  /** Tags for grouping in admin UI */
  tags?: string[]
  /** If true, flag is a temporary experiment that should be cleaned up */
  temporary?: boolean
}

interface FlagConfigFile {
  /** Schema version for future migrations */
  version: 1
  /** Last modified ISO timestamp */
  updatedAt: string
  /** All flag definitions */
  flags: FlagDefinition[]
}
```

**Example `feature-flags.json`:**

```json
{
  "version": 1,
  "updatedAt": "2026-07-01T12:00:00Z",
  "flags": [
    {
      "id": "modern-design",
      "name": "Modern Design",
      "description": "Applies modernized CSS to the entire app via body.modern-design class",
      "type": "boolean",
      "defaultValue": false,
      "environments": {
        "staging": { "value": true },
        "production": { "value": false }
      },
      "createdAt": "2026-07-01T12:00:00Z",
      "tags": ["design"],
      "temporary": true
    },
    {
      "id": "pdf-to-csv",
      "name": "PDF → CSV",
      "description": "Extract transaction tables from bank/brokerage PDFs into CSV format",
      "type": "boolean",
      "defaultValue": false,
      "environments": {
        "staging": { "value": true },
        "production": { "value": false }
      },
      "createdAt": "2026-07-01T12:00:00Z",
      "tags": ["labs"],
      "temporary": true
    },
    {
      "id": "chart-type",
      "name": "Default Chart Type",
      "description": "Which chart type to show by default on the home dashboard",
      "type": "string",
      "defaultValue": "line",
      "createdAt": "2026-07-01T12:00:00Z",
      "tags": ["ux"]
    }
  ]
}
```

---

## 3. Storage & Sync

### Where flags live

**Primary:** `feature-flags.json` in the repository root on `main` branch.

**Why this approach:**
- Versioned — every change is a git commit with history
- Auditable — you can see who changed what and when
- No new infrastructure — reuses existing GitHub Contents API + PAT
- Editable via GitHub UI directly if admin panel is unavailable
- Works offline — cached locally
- Survives deploys — it's data, not code

**Rejected alternatives:**
| Option | Why rejected |
|--------|-------------|
| GitHub Gist | No branch protection, harder to review, separate from repo |
| localStorage only | Not remotely configurable — defeats the purpose |
| Separate branch | Over-complicated; adds merge conflicts; can't protect without GitHub Enterprise |
| GitHub environment variables | Only available at build time, not runtime configurable |

### Fetch strategy

```
App boot → check localStorage cache
  ├── Cache exists AND age < TTL (5 min) → use cached flags
  └── Cache missing OR stale → fetch from GitHub API
        ├── Success → update cache + use fresh flags
        └── Failure (network/auth) → fall back to stale cache OR hardcoded defaults
```

**Implementation details:**
- TTL: **5 minutes** for production, **30 seconds** for staging
- Cache key: `ff-cache` (the JSON) + `ff-cache-ts` (timestamp)
- The fetch is **non-blocking** — app renders immediately with cached/default values, updates reactively when fresh data arrives
- Uses `If-None-Match` / ETag header to minimize GitHub API rate limit usage (conditional requests don't count against the 5000/hr limit)

### Write strategy (Admin UI)

When a flag is edited in the admin panel:
1. Optimistic update to local state + cache
2. PUT to GitHub Contents API (same as existing sync logic)
3. On conflict (409): fetch latest, merge changes, retry
4. On success: commit SHA stored for next write

---

## 4. Admin UI

### Location

New section in the existing Settings modal: **"Feature Flags"** tab, positioned after "Labs" in the nav.

**Why not a separate route?**
- Consistent with existing patterns (all config lives in Settings)
- The Settings modal already handles the sidebar nav pattern
- No new routing infrastructure needed
- Naturally gated by the same access the user already has

### Authentication check

The app already has a decrypted GitHub PAT in memory (via `useGitHubSync`). The admin panel:

1. Requires GitHub Sync to be configured AND token to be unlocked
2. On first load, calls `GET /repos/{owner}/{repo}/collaborators/{username}` to verify the token's user has `push` access
3. Caches the permission check for the session (no need to re-verify until page reload)

```typescript
// Pseudocode for access check
const checkFlagAdminAccess = async (token: string, owner: string, repo: string): Promise<boolean> => {
  // Get authenticated user
  const userRes = await fetch('https://api.github.com/user', { headers: authHeaders(token) })
  const { login } = await userRes.json()
  
  // Check if user has push access to this repo
  const permRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/collaborators/${login}/permission`,
    { headers: authHeaders(token) }
  )
  const { permission } = await permRes.json()
  return ['admin', 'write'].includes(permission)
}
```

**Why this works for security:**
- Without a valid PAT that has push access, you can't see or edit flags
- The file in the repo is the source of truth — even if someone edits localStorage, the next fetch overwrites it
- This is appropriate security for a personal/small-team app

### UI components

```
SettingsModal
  └── FlagAdminPane
        ├── FlagList (table/card view of all flags)
        │     └── FlagRow (id, name, type, current value per env, toggle)
        ├── FlagEditor (modal/drawer for editing a flag)
        │     ├── Name, description, type selector
        │     ├── Default value input (type-aware)
        │     ├── Environment overrides (production / staging toggles)
        │     └── Metadata (tags, temporary checkbox)
        └── CreateFlagButton
```

### CRUD operations

| Operation | Implementation |
|-----------|---------------|
| **List** | Read from FlagProvider context (already fetched) |
| **Create** | Add to flags array, PUT entire file |
| **Update** | Modify in-place, PUT entire file |
| **Delete** | Remove from array, PUT entire file |

All writes go through a single `saveFlagConfig()` function that handles the GitHub API PUT with conflict resolution.

---

## 5. Consumer API

### React Context + Hook

```typescript
// src/flags/FlagContext.tsx

interface FlagContextValue {
  /** Get the resolved value of a flag for the current environment */
  getFlag: <T extends FlagValue>(flagId: string, fallback: T) => T
  /** Check if a boolean flag is enabled */
  isEnabled: (flagId: string) => boolean
  /** All flag definitions (for admin UI) */
  flags: FlagDefinition[]
  /** Current resolved environment */
  environment: 'production' | 'staging'
  /** Loading state */
  isLoading: boolean
  /** Last fetch error */
  error: string | null
  /** Force refresh from GitHub */
  refresh: () => Promise<void>
  /** Save updated config (admin only) */
  saveConfig: (config: FlagConfigFile) => Promise<void>
  /** Whether current user has admin access */
  isAdmin: boolean
}
```

### Hook API

```typescript
// Usage in components:

// Boolean flag
const modernDesign = useFlag('modern-design', false)
// → boolean

// String flag
const chartType = useFlag('chart-type', 'line')
// → string

// Number flag
const maxItems = useFlag('dashboard-max-items', 10)
// → number

// JSON flag
const layoutConfig = useFlag('home-layout', { columns: 2, density: 'normal' })
// → { columns: number, density: string }
```

### Resolution logic

```typescript
function resolveFlag<T extends FlagValue>(
  flag: FlagDefinition | undefined,
  environment: Environment,
  fallback: T
): T {
  if (!flag) return fallback
  
  // Check environment-specific override
  const envConfig = flag.environments?.[environment]
  if (envConfig) {
    // Handle percentage rollout for booleans
    if (flag.type === 'boolean' && envConfig.percentage !== undefined) {
      return (evaluatePercentage(flag.id, envConfig.percentage) as unknown as T)
    }
    return envConfig.value as T
  }
  
  // Fall back to default
  return flag.defaultValue as T
}
```

### Percentage rollout resolution

For a single-user app, "percentage" maps to **environment-based progressive rollout**:

- `100%` → always enabled in this environment
- `0%` → always disabled in this environment
- `1-99%` → deterministic hash of `flagId + userId` → consistent on/off per user

For the current single-user case, percentage effectively becomes a toggle (anything > 0 = on). But the schema supports future multi-user scenarios by using a deterministic hash:

```typescript
function evaluatePercentage(flagId: string, percentage: number): boolean {
  // Hash the flag ID + a stable user identifier
  const userId = localStorage.getItem('user-profile-id') || 'default'
  const hash = simpleHash(`${flagId}:${userId}`)
  return (hash % 100) < percentage
}
```

This means: if you later add collaborators, each gets a consistent but different roll based on their identity.

---

## 6. Environment Model

### Detection strategy: URL-based

```typescript
type Environment = 'production' | 'staging'

function detectEnvironment(): Environment {
  const hostname = window.location.hostname
  
  // Production: GitHub Pages canonical URL
  if (hostname === 'dutta14.github.io') return 'production'
  
  // Staging: any other deployment (PR previews, Vercel previews, etc.)
  // Also: localhost is treated as staging for development
  return 'staging'
}
```

**Why URL-based:**
- Zero configuration — no build-time variables needed
- Works with future PR preview deploys (any non-production URL = staging)
- `localhost` is naturally staging, which means developers see staging flags during development
- No need for a "flag to control flags" chicken-and-egg problem

**How this ties to #42:** Issue #42 proposes PR preview deploys. Once those exist:
- Preview URL (e.g., `dutta14.github.io/finance-tracking/pr-42/`) → detected as `staging`
- Flags with `staging` overrides automatically apply on previews
- You can test flag-gated features on preview deploys before merging

### Extensibility

The schema supports adding more environments later:

```typescript
environments?: {
  production?: FlagEnvironmentConfig
  staging?: FlagEnvironmentConfig
  // Future: could add "canary", "beta", etc.
}
```

---

## 7. Migration Plan

### Current state to migrate

| Current mechanism | Location | Migration target |
|-------------------|----------|-----------------|
| `darkMode` localStorage | SettingsContext | Stays as-is (not a feature flag — it's a user preference) |
| `accentTheme` localStorage | SettingsContext | Stays as-is (user preference) |
| `allowCsvImport` localStorage | SettingsContext | Stays as-is (user preference) |
| `lab-pdf-to-csv` localStorage | LabsPane | → `pdf-to-csv` flag |
| Demo Mode | LabsPane | Stays as-is (runtime-only state, not configurable remotely) |
| **Issue #19 "Modern Design"** | Not yet implemented | → `modern-design` flag |

### Migration steps

1. **Phase 1:** Build the flag system. Add `modern-design` as the first flag.
2. **Phase 2:** Migrate `lab-pdf-to-csv` to a flag. Remove the localStorage-based toggle. The LabsPane still renders but reads from `useFlag()` instead of localStorage.
3. **Phase 3:** The LabsPane becomes a **read-only view** of boolean flags tagged `labs`. Editing happens in the Flag Admin panel.

### Backward compatibility

- On first load after deploy, if `lab-pdf-to-csv` exists in localStorage but not in the flag config, the migration code copies the user's preference into the flag system.
- Old localStorage keys are cleaned up after successful migration.

---

## 8. Tie-in with Issue #42 (Staging)

Issue #42 proposes:
- PR preview deploys
- E2E tests in CI
- Stripping debug logs

**How feature flags integrate:**

| #42 Proposal | Flag system benefit |
|--------------|---------------------|
| PR preview deploys | Previews auto-detect as `staging` environment → flags with staging overrides are active |
| E2E tests in CI | E2E tests can run with flags in specific states (set via `feature-flags.json` or test fixture) |
| Future "canary" deploys | Flag system already supports per-environment overrides — just add a new environment key |

**Practical workflow once both #19 and #42 are done:**

1. Developer creates a feature behind a flag (e.g., `new-dashboard-layout`)
2. Sets flag config: `staging: { value: true }, production: { value: false }`
3. PR preview deploy shows the feature enabled
4. After QA on preview, update flag config: `production: { value: true }`
5. Feature goes live without a code deploy
6. If broken, revert the flag JSON (one commit) — instant rollback

---

## 9. Effort Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| **Phase 1: Core infrastructure** | FlagContext, useFlag hook, fetch/cache logic, environment detection, `feature-flags.json` schema | **M** (4–6 hours) |
| **Phase 2: Admin UI** | FlagAdminPane in Settings, list/edit/create/delete, permission check | **L** (6–8 hours) |
| **Phase 3: Modern Design flag** | Wire `modern-design` flag → `body.modern-design` class (replaces Issue #19 original scope) | **S** (1–2 hours) |
| **Phase 4: Migrate Labs** | Move `pdf-to-csv` to flag system, LabsPane reads from flags | **S** (2–3 hours) |
| **Phase 5: Tests** | Unit tests for resolution logic, context, admin panel; E2E for flag toggle flow | **M** (4–5 hours) |

**Total: ~17–24 hours across 5 phases**

Phases 1–3 can ship together as the MVP. Phases 4–5 follow immediately after.

---

## 10. Tradeoffs

### Chose: JSON file in repo via Contents API

| Pro | Con |
|-----|-----|
| Zero new infrastructure | Writes require a full file PUT (no partial updates) |
| Full git history of every flag change | 5000 req/hr GitHub API limit (but conditional requests are free) |
| Works offline via cache | ~200ms latency on cold fetch |
| Editable via GitHub UI as escape hatch | File conflicts possible if edited simultaneously from two places |
| Naturally fits existing auth model | Requires repo push access to edit (but that's the security model we want) |

### Chose: Single file (not one file per flag)

- Simpler to fetch (one API call vs N)
- Atomic updates (all flags consistent)
- For <50 flags, file size is trivial (<10KB)
- If we ever need 1000+ flags, we can shard (but we won't)

### Chose: Settings modal tab (not separate route)

- Consistent with existing patterns
- No new route to protect
- Flag admin is a configuration concern, not a "page"
- Keeps the app simple for the primary use case (personal finance tracking)

### Chose: 5-minute cache TTL

- Balances freshness vs API usage
- Flag changes propagate within 5 minutes without any action
- User can force-refresh from admin panel for immediate propagation
- Staging uses 30s TTL for faster iteration during development

### Rejected: LaunchDarkly/Unleash/PostHog

- Adds external dependency for a personal app
- Requires a backend or serverless function for evaluation
- Overkill for <10 flags and 1-2 users
- The GitHub Contents API gives us everything we need for free

### Rejected: Build-time flags via Vite env vars

- Requires a redeploy to change flag values
- Doesn't satisfy the "config-driven, no code deploy" requirement
- Appropriate for truly static config (like `base` URL) but not for feature rollout

---

## Appendix: File Structure

```
src/
├── flags/
│   ├── types.ts              # FlagDefinition, FlagConfigFile, FlagValue types
│   ├── FlagContext.tsx        # FlagProvider + useFlagContext
│   ├── FlagContext.test.tsx   # Unit tests
│   ├── useFlag.ts            # Consumer hook (thin wrapper over context)
│   ├── useFlag.test.ts       # Hook tests
│   ├── flagResolution.ts     # Pure resolution logic (testable without React)
│   ├── flagResolution.test.ts
│   ├── flagFetcher.ts        # GitHub API fetch + cache logic
│   ├── flagFetcher.test.ts
│   └── environment.ts        # detectEnvironment() utility
├── pages/
│   └── settings/
│       └── components/
│           ├── FlagAdminPane.tsx    # Admin UI (new)
│           └── FlagEditor.tsx       # Create/edit form (new)
├── styles/
│   └── FlagAdmin.css         # Styles for admin panel
feature-flags.json            # (repo root) Flag configuration
```

---

## Appendix: Provider Integration

The `FlagProvider` wraps inside `GitHubSyncProvider` (needs the active token) but outside page-level providers:

```tsx
// App.tsx (updated provider tree)
<SettingsProvider>
  <GoalsProvider>
    <GitHubSyncProvider>
      <FlagProvider>          {/* ← NEW */}
        <BudgetSyncProvider>
          <TaxSyncProvider>
            <DataProvider>
              <LayoutProvider>
                <ImportExportProvider>
                  <AppShell />
                </ImportExportProvider>
              </LayoutProvider>
            </DataProvider>
          </TaxSyncProvider>
        </BudgetSyncProvider>
      </FlagProvider>
    </GitHubSyncProvider>
  </GoalsProvider>
</SettingsProvider>
```

---

## Next Steps

1. **Review this proposal** — flag any concerns or missing requirements
2. **Create sub-issues** for each phase (I'll break these out once approved)
3. **Phase 1 implementation** — start with the core infrastructure + `modern-design` flag
