# Docs

Internal documentation for finance-tracking. The user-facing README lives at the repo root.

## Layout

- **`specs/`** — feature and design specs (architecture decisions, UI specs, redesigns)
  - `encryption-ui.md` — **superseded** — passphrase / unlock / lock screen design (removed in the File System Access migration)
  - `feature-flags-architecture.md` — flag resolution, rollout, override model
  - `goal-drawer.md` — goal detail drawer spec
  - `goals-page-redesign.md` — Goals page IA + visual redesign
- **`planning/`** — sprint plans, test coverage plans, roadmap docs
  - `sprint-plan.md`
  - `test-coverage-plan.md` — **partially superseded** — items covering EncryptionContext, GitHubSyncContext, ImportExportContext, and IndexedDB patterns no longer apply; see CONTRIBUTING.md for current testing guidance
- **`ideas/`** — informal idea capture (see `ideas/README.md` for the drop-in workflow)
  - `github-sync-ux-audit.md` — **superseded** — GitHub Sync was removed in the File System Access migration
- **`screenshots/`** — PNGs embedded in the root `README.md` (regenerated via `scripts/capture-screenshots.ts`)
