# GitHub Sync UX Audit
**Parker, PM — Drive & Settings**
**Date: 2026-05-10 | Scope: Full sync setup, operation, and recovery flows**

---

## 1. Current Architecture Summary

The sync system uses GitHub's Contents API to store JSON files in a private repo. Six domains sync independently: Goals, Balances, Tools, Allocation, Taxes, Budget. Token is encrypted client-side with AES-256-GCM (PBKDF2-derived key from a user passphrase) and stored in localStorage. Session-based unlock — token lives in memory only after passphrase entry.

**Files synced to GitHub:**
- `finance-goals.json` (goals, profile, settings)
- `finance-goals-data.json` (accounts, balances)
- `finance-goals-tools.json` (FI simulations)
- `finance-goals-allocation.json` (custom ratios)
- `finance-goals-taxes.json` (tax store, templates)
- Budget CSVs (individual files per month)

---

## 2. User Journey Map

### Step 1: Discovery
**How does a user find GitHub Sync?**
- Settings modal → "GitHub Sync" tab in the left nav
- There's a green dot badge on the nav item when there are pending changes
- No onboarding prompt, no first-run guidance, no mention on the Home page

**Rating: ⚠️ Friction** — Sync is hidden inside Settings. A new user could use the app for months without knowing backup exists. There's no empty-state prompt on the Home or Drive page saying "Your data is only stored in this browser. Set up backups."

### Step 2: Token Generation (external to our app)
**What the user must do:**
1. Go to `github.com/settings/tokens?type=beta` (link provided in the UI)
2. Create a fine-grained PAT
3. Select the correct repository
4. Grant "Contents: Read & Write" permission
5. Copy the token

**Rating: ❌ Broken/Confusing** — This is the highest-friction step in the entire flow. The user must:
- Know what a PAT is
- Navigate GitHub's token creation UI (which has changed multiple times)
- Correctly scope the token to the right repo (which they may not have created yet)
- Understand the difference between classic and fine-grained tokens
- The hint text says "Contents write access" but the actual GitHub UI labels this "Contents: Read and write"

The UI provides a link and a one-line hint. That's it. No step-by-step guide, no screenshots, no "create a repo first" instruction.

### Step 3: Token Storage
**What the user sees:**
- "New token" input field (password-masked, with show/hide toggle)
- "Passphrase for encryption" input (min 8 chars)
- "Save Token" button

**Rating: ✅ Good** — The encryption UX is clean. Clear labels, good validation (8-char minimum), success/error feedback. The passphrase model is solid — the token never touches localStorage in plaintext.

### Step 4: Repository Configuration
**What the user sees:**
- Owner field (placeholder: "your-github-username")
- Repository field (placeholder: "finance-backups")
- Once configured, collapses to show `owner/repo` with Edit button

**Rating: ⚠️ Friction** — Two problems:
1. The user must create the repo on GitHub first, manually. There's no guidance about this.
2. There's no validation that the repo exists until the user clicks "Test." If they typo the repo name, nothing tells them until they try to sync.

### Step 5: Connection Test
**What the user sees:**
- "Test" button next to the repo display
- Green "Connected" badge on success
- Error message on failure
- Warnings for: public repos, missing write access, overly broad token scope

**Rating: ✅ Good** — The test connection is thorough. It checks repo existence, token validity, write permissions, and repo visibility. The warnings about public repos exposing financial data are exactly right. This is trust-building UX.

### Step 6: Auto-Sync Toggle
**What the user sees:**
- Checkbox: "Auto-sync (commits ~60 seconds after any change)"

**Rating: ✅ Good** — Simple, clear. The 60-second debounce is explained inline. Off by default (good — explicit opt-in). Flushes on tab hide (good — no data loss when closing browser).

### Step 7: First Sync
**What happens:**
- User clicks "Sync" button
- Spinner with domain-by-domain progress (Goals ✓, Balances ✓, Tools ✓, Allocation ✓)
- "All synced" success message
- Status bar shows "Last synced [relative time] · [absolute time]"

**Rating: ✅ Good** — The multi-domain progress indicator is excellent. The user sees exactly what's syncing and can identify which domain failed if something goes wrong. The "Already up to date" message when nothing is dirty prevents confusion.

### Step 8: Ongoing Sync Status
**What the user sees:**
- Status bar with colored dot: green (success), red (error), gray (idle)
- Relative time since last sync
- "unsaved changes" warning badge when dirty
- Pending changes dot on the Settings nav item

**Rating: ✅ Good** — Status is clear and always visible within the sync pane. The dirty-flag system across 6 domains means syncs are incremental (only changed domains sync).

### Step 9: Sync Failure
**What the user sees:**
- Red dot + "Sync failed: [error message]"
- Per-domain error indicators in the progress list
- Retry: user must click "Sync" again manually

**Rating: ⚠️ Friction** — Errors are shown but:
1. No automatic retry on transient failures (the code has retry logic for 409/422 conflicts within a single sync, but no retry-after-failure for network errors)
2. Error messages are raw GitHub API errors — not user-friendly ("GitHub API error: 403" doesn't tell the user what to do)
3. No "Retry" button — the same "Sync" button is used, which feels uncertain

### Step 10: Restore Flow (New Device)
**What the user sees:**
- History tab with list of commits (sha, message, relative date)
- "Restore Latest" button at the top
- Per-commit "Restore" buttons
- Success/error feedback after restore

**What happens internally:**
1. Restores goals JSON from the main file
2. Then cascades: restores data, tools, allocation files
3. Applies settings (theme, accent, CSV import flag)
4. Reloads the page after 100ms

**Rating: ⚠️ Friction** — The restore flow works but has UX gaps:
1. The user must already have their token configured on the new device before they can restore. Chicken-and-egg: they need to remember owner/repo and re-create or re-enter their PAT.
2. No confirmation dialog before restore — it overwrites all local data immediately
3. No preview of what will be restored
4. The page reload after restore is abrupt — no explanation of why
5. History only shows commits for the main goals file, not data/tools/allocation/taxes — the user can't see when their balances were last synced

---

## 3. Pain Points Summary

### Critical
| # | Issue | Impact |
|---|-------|--------|
| 1 | **Token creation requires GitHub expertise** | Non-technical users (the target audience for a personal finance app) cannot complete setup without a tutorial. PAT creation, repo scoping, and permission selection are developer workflows. |
| 2 | **No guidance to create the repo first** | Users try to configure sync before creating a repo, get confused when "Test" fails. The repo must exist before setup, but we never say this. |
| 3 | **No restore without re-setup** | On a new device, the user must remember their GitHub username, repo name, re-enter a PAT, and remember their passphrase. There's no "restore from backup" flow that guides this. |

### High
| # | Issue | Impact |
|---|-------|--------|
| 4 | **Sync is buried in Settings** | No discoverability. No nudge. A user who loses their browser data discovers sync existed only after the loss. |
| 5 | **No sync status in the main UI** | The sync status only appears inside the Settings modal. There's no persistent indicator in the sidebar or header showing sync health. |
| 6 | **Error messages are not actionable** | "GitHub API error: 403" should say "Your token may have expired. Generate a new one at [link]." |
| 7 | **Token unlock required every session** | Every time the user opens the app, they must go to Settings → GitHub Sync → enter passphrase to enable sync. Auto-sync doesn't work until the token is unlocked. |

### Medium
| # | Issue | Impact |
|---|-------|--------|
| 8 | **No restore confirmation** | Restore overwrites all data without preview or confirmation. Dangerous for a finance app. |
| 9 | **History shows only goals file commits** | User can't verify when their balances, budget, or tax data was last backed up. |
| 10 | **6 separate API calls per full sync** | Each domain makes its own PUT request. On slow connections or rate-limited tokens, this compounds. |

---

## 4. Competitor Analysis

### 1Password (gold standard for sync trust)
- **Setup**: OAuth sign-in. Zero token management. Account creation handles everything.
- **Sync**: Fully automatic, invisible. No manual sync button needed.
- **Status**: Sync icon in the toolbar. Green check = synced. Spinning = syncing. Red = problem.
- **Conflict resolution**: Last-write-wins with merge for non-conflicting fields.
- **Restore**: Sign in on new device → everything downloads automatically.
- **Lesson**: The user should never think about sync. It should be infrastructure, not a feature.

### Obsidian Sync
- **Setup**: Sign in to Obsidian account → select vault → done. ~3 clicks.
- **Sync**: Real-time, automatic. Version history per file.
- **Status**: Persistent sync icon in the status bar (always visible).
- **Conflict resolution**: Shows diff and lets user choose.
- **Restore**: Version history per file with one-click restore.
- **Lesson**: Persistent status indicator builds trust. File-level history is more useful than repo-level.

### Standard Notes
- **Setup**: Sign in or create account. Encryption key derived from password.
- **Sync**: Automatic on every change. Offline-first with sync queue.
- **Status**: "All changes saved" / "Saving..." in the footer.
- **Restore**: Note history with visual diff.
- **Lesson**: The "all changes saved" pattern is the simplest trust signal that works.

### Key Patterns That Work
1. **OAuth over PAT** — No user should generate tokens manually for a consumer app
2. **Persistent status indicator** — Always visible, not buried in settings
3. **Automatic sync** — The user shouldn't have to click "Sync"
4. **Guided first-run** — Setup wizard, not a form with empty fields
5. **Confirmation before destructive restore** — Always

---

## 5. Recommendations

### Tier 1: Minimum Viable Improvements (ship now)
These fix real trust and usability issues with low engineering effort.

| # | Recommendation | Impact | Effort |
|---|---------------|--------|--------|
| A | **Add sync status to sidebar** — Small dot or icon next to "Settings" showing sync health (green/yellow/red). Always visible. | High | Low |
| B | **Add a backup nudge on Home page** — If sync is not configured after 7 days of use, show a dismissible card: "Your data lives only in this browser. Set up GitHub Sync to back it up." Link goes straight to Settings → GitHub Sync. | High | Low |
| C | **Add restore confirmation dialog** — Before overwriting data, show: "This will replace all your current data with the backup from [date]. This cannot be undone. Continue?" | High | Low |
| D | **Humanize error messages** — Map common HTTP status codes to actionable messages. 401 → "Token expired or invalid. Generate a new one." 403 → "Token doesn't have write access to this repo." 404 → "Repository not found. Check the owner and repo name." Network error → "Can't reach GitHub. Check your internet connection." | High | Low |
| E | **Add setup instructions inline** — Before the token input, add a collapsible "Setup guide" with 4 numbered steps: (1) Create a private repo on GitHub, (2) Go to Settings → Developer → Tokens, (3) Create fine-grained token scoped to that repo, (4) Paste it here. | High | Low |

### Tier 2: Meaningful UX Upgrades (next sprint)

| # | Recommendation | Impact | Effort |
|---|---------------|--------|--------|
| F | **Auto-unlock with app encryption passphrase** — If the user has set up the app-level encryption (SecurityPane), offer to derive the sync token key from the same passphrase. One unlock at app start covers both encryption and sync. | High | Med |
| G | **Expand history to all domains** — Show last-synced timestamp per domain (Goals, Balances, Tools, Allocation, Taxes, Budget) in the sync pane. User should know when each data type was last backed up. | Med | Med |
| H | **Add auto-retry on transient failures** — After a sync failure with 5xx or network error, retry 3 times with exponential backoff (5s, 15s, 45s). Only show the error if all retries fail. | Med | Low |
| I | **Guided restore flow for new devices** — When the app detects empty state (no goals, no accounts) and the user navigates to Settings → GitHub Sync, show a prominent "Restore from backup" CTA instead of the normal config UI. Guide: enter token → enter repo → unlock → restore. | High | Med |

### Tier 3: Ideal State (future)

| # | Recommendation | Impact | Effort |
|---|---------------|--------|--------|
| J | **GitHub OAuth App** — Replace PAT with OAuth flow. User clicks "Connect GitHub" → OAuth redirect → we get a scoped token automatically. Eliminates the entire PAT creation flow. Requires a small backend (Cloudflare Worker or Vercel Edge Function) to handle the OAuth exchange. | Very High | High |
| K | **"All changes saved" footer** — Persistent footer bar across the entire app: "All changes saved" / "Saving..." / "Offline — changes will sync when you reconnect". Replaces the need to check Settings. | High | Med |
| L | **Sync queue with offline support** — Queue changes when offline, flush when online. Show count of pending changes. Currently, if sync fails, changes are only tracked as "dirty" but could be lost if the browser clears storage before next sync. | High | High |

---

## 6. Verdict

### Is the current flow acceptable for v1?
**Conditionally yes, with caveats.** The core sync engine is solid. The multi-domain dirty tracking, debounced auto-sync, conflict retry (409/422), connection test with security warnings, and per-domain progress are all well-built. The token encryption is correctly implemented (AES-GCM, unique salt/IV, PBKDF2 key derivation).

**What makes it borderline:** The setup flow assumes a developer audience. Creating a PAT, creating a repo, and understanding GitHub's permission model are significant barriers for anyone who isn't a software engineer. For Anindya's personal use, this is fine. For any broader audience, it's a blocker.

### Minimum viable improvement (do this week):
**Items A + C + D + E from Tier 1.** Specifically:
1. **Sidebar sync indicator** — shows sync is active without opening Settings
2. **Restore confirmation** — prevents accidental data loss
3. **Human error messages** — makes failures recoverable
4. **Inline setup guide** — reduces the PAT creation drop-off

These four changes take the sync UX from "developer tool" to "power user feature." Estimated effort: 1-2 days of engineering.

### Ideal state:
OAuth-based setup (no PAT), persistent "all changes saved" footer, automatic restore on new device via sign-in, and a sync queue with offline support. This is a 2-3 sprint investment that would make sync invisible — which is what sync should be.

---

*Parker, PM — Drive & Settings*
*Sync is a trust contract. Right now, we're asking users to do too much work to earn that trust. The infrastructure is strong. The UX needs to meet it halfway.*
