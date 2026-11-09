# Data Safety Net

- **Status:** Proposed
- **Owner:** Anindya
- **Last updated:** 2026-11-08
- **Priority:** 1 of 5 in the next-features list
- **Effort:** M (5 PR-sized slices, plus a later flag-removal cleanup)

## 1. Summary and goal

**Problem.** worth stores everything as plain files that the user may also sync between machines (README, "How do I use this on two devices?"). Today the write path has four silent failure modes: a write still inside the 300 ms debounce when the tab closes is dropped; a write that fails ends in `.catch(console.error)` so the user never learns about it; a JSON file that fails to parse is replaced by the fallback and the next save overwrites the evidence; and a tab that loaded a file before another machine changed it will happily overwrite the newer version. There is no snapshot to go back to. For an app whose pitch is "your money, on your own disk", losing a month of balances without a sound is the worst possible failure.

**Goal.** Never silently lose or overwrite financial data in a plain-files app, using only local files and with no new network traffic.

**Success metrics (no telemetry; all verifiable by tests or a manual protocol):**

1. Unit: a `pagehide` / `visibilitychange(hidden)` event starts a write for every pending path before any timer fires (AC-1, AC-2).
2. Unit: for 20 malformed JSON inputs (empty object truncated, BOM, trailing garbage, HTML, etc.), zero bytes are written to the original path and a `.corrupt-` copy with identical bytes exists (AC-9).
3. Unit and e2e: a failed write surfaces a `role="alert"` banner within 1 s, the edit is still on screen, and "Try again" persists it after the fault clears (AC-4 to AC-6).
4. Unit and e2e: a file changed externally is never overwritten without the user choosing "Reload" or "Keep my version", and the overwritten disk version is recoverable from `_backups/` (AC-12 to AC-16).
5. Unit: after 25 simulated sessions editing one file, `_backups/` holds at most 10 copies of it (AC-21).
6. Playwright network log: the only requests during all safety-net scenarios are the existing `feature-flags.json` fetch (AC-30).
7. Manual protocol (section 7.5) passes on Chrome stable on macOS with a real iCloud Drive folder, run once before flag rollout.

## 2. Current behavior (verified)

Each row was checked in the code on 2026-11-08.

| # | Claim | Evidence |
|---|---|---|
| 1 | Writes are debounced 300 ms per path and resolve only after the disk write finishes. | `src/utils/fileStore.ts` L5 `WRITE_DEBOUNCE_MS`, `queueWrite` L252-268, `flushPath` L270-281 |
| 2 | `flush()` exists but nothing calls it outside `fileStore.test.ts` (L318). No `beforeunload`, `pagehide`, `visibilitychange` or focus listener exists anywhere in `src/` or `e2e/` (grep). | `fileStore.ts` L172-183 |
| 3 | `flush()` is not on the `FileStore` interface, so it is only reachable on the concrete `FileSystemFileStore`. | `src/utils/fileStoreTypes.ts` L13-26 |
| 4 | Write errors reject the waiter promises, and callers swallow them. 31 non-test `.catch(console.error)` sites, e.g. `DataContext.setAccounts` L36 and `setBalances` L44, `useProfile` L47, `useLeverage` L308, `PayDown` L682, `FICalculator` L297. `saveGoalsPart` logs and swallows (`src/pages/goal/utils/localStorageService.ts` L84). | files cited |
| 5 | `readJSON` returns the caller's fallback when `JSON.parse` throws and does not cache it, so the file stays corrupt on disk until something writes. `MemoryFileStore.readJSON` does the same. | `fileStore.ts` L68-79; `memoryFileStore.ts` L34-41 |
| 6 | The overwrite follows directly. `loadGoalsFile` falls back to `EMPTY_FILE`; the next `saveGoalsPart` reads the fallback and writes `{financialGoals:[x], gwGoals:[]}` over the corrupt file. | `localStorageService.ts` L50-58 and `saveGoalsPart` (read-modify-write); `useFinancialGoals.ts` L39-46 |
| 7 | Cross-tab: a `BroadcastChannel('filestore-sync')` message `{path}` drops that path from the cache and notifies subscribers. Nothing compares disk state to what the tab loaded, and `File.lastModified` is never read (grep). Edits from another machine are invisible until a reload, and a stale tab overwrites them. | `fileStore.ts` L4, L187-196 |
| 8 | Writes take a `navigator.locks` lock named `filestore:${path}`, so tabs on one browser do not interleave. The architecture HTML says `filestore-write-` + path; that doc is stale. | `fileStore.ts` L26-30, L165, L286; `docs/filesystem-storage-architecture.html` (Write locking) |
| 9 | `balanceStorage.saveBalances` awaits `listFiles` before queuing anything, then `await`s each `writeCSV` inside a `for` loop. Each await resolves only after its debounce and disk write, so year N is queued roughly N x 300 ms late. | `src/utils/balanceStorage.ts` L46-62 |
| 10 | `saveBalances` deletes every `balances/YYYY.csv` that is absent from in-memory state. A stale tab deletes a year file another machine just created. | `balanceStorage.ts` L51, L59-60 |
| 11 | `DataContext` subscribes only to `accounts.json`. Balances reload only on a `window` `data-changed` event, which no non-test code dispatches (grep). | `src/contexts/DataContext.tsx` L72-77 |
| 12 | On startup the saved handle is re-used via `requestPermission` with no user gesture. Anything other than `granted` shows `FolderPicker`. No `queryPermission` call exists, and nothing handles permission loss after startup. | `src/contexts/FileStoreContext.tsx` L406-414; `vite-env.d.ts` L14-15 typings only |
| 13 | Demo mode and e2e mode use `MemoryFileStore` (`getHandle()` returns `null`). | `FileStoreContext.tsx` L80-94, L145-394; `memoryFileStore.ts` L17-19 |
| 14 | No `_backups`, `.corrupt` or snapshot concept exists (grep of `src/`). The README and Guide say "there is no recycle bin" and point to the user's own backup tool. | `src/pages/guide/sections/PrivacyAndData.tsx` L52-56 |
| 15 | Folder-listing callers only touch specific subfolders (`balances`, `taxes`, `taxes/{y}/files`, `transactions`, `transactions/{y}`) and filter by regex or `.csv` suffix. Drive builds from `loadBudgetStore` and `loadTaxStore`, never from the root listing. A root `_backups/` folder and sibling `*.corrupt-*` files are therefore invisible to the app. | `balanceStorage.ts` L25, L51; `taxes/types.ts` L57, L67, L116; `budgetStorage.ts` L205-212; `drive/buildBudgetTree.ts` L14 |
| 16 | Flags: `defineFlag` in `src/flags/flagDefinitions.ts`, consumed with `useFlag(FLAGS.X)`; rollout in `feature-flags.json`. `FlagProvider` sits inside `FileStoreGate`, so it is not available to `FileStoreProvider`. | `App.tsx` L42-44, L218-228; `flagDefinitions.ts` |
| 17 | Existing banner patterns: sticky `.demo-banner` above the routes (`App.tsx` L132-137, CSS in root `styles/app.css` L184-210) and `UndoToast` (`role="alert"`). Settings > Data Folder is `DataFolderPane.tsx`. | files cited |
| 18 | e2e specs run against `MemoryFileStore` via `_e2eMode`, so no current Playwright test exercises `FileSystemFileStore`. Unit tests use hand-written fake handles (`fileStore.test.ts` L7-62) whose `getFile()` returns a new `File` each call, so `lastModified` is not stable. | `e2e/fixtures/base.ts`; `fileStore.test.ts` |

**PM evidence corrections.** All five PM claims hold. Additions found: row 6 (corrupt-then-overwrite is a concrete code path), rows 9-11 (balances ordering, stale year-file deletion, balances never refresh), and row 3 (flush is not on the interface).

## 3. Architecture

### 3.1 Design principles

1. **Centralize in the store, not in 31 call sites.** All protection lives in `FileSystemFileStore`; callers keep `.catch(console.error)` and need no change. The UI observes the store.
2. **Inert unless enabled.** The store behaves exactly as today until `configureSafety({ enabled: true })` is called. `MemoryFileStore` (demo, e2e, tests) never implements the safety API, so demo mode cannot touch a real folder.
3. **Never destroy; always keep a copy.** Anything about to be overwritten, deleted or discarded is copied to `_backups/` first.
4. **Be honest about guarantees.** The browser gives no guarantee that async file writes finish during unload (3.5).

### 3.2 Components

| Module | Status | Responsibility |
|---|---|---|
| `src/utils/safetyNet.ts` | NEW | Pure helpers and types: `FileStoreError`, `SafetySnapshot`, `Fingerprint`, `fingerprintBytes`, `compareFingerprint`, `stampFor`, `backupPathFor`, `corruptPathFor`, `isBackupEligible`, `pruneList`, `errorKind`. No I/O. |
| `src/utils/backupManager.ts` | NEW | Snapshot, list, prune and restore over a small `RawIO` interface (read bytes, write bytes, list, remove). Unit-testable with a Map-backed `RawIO`. |
| `src/utils/fileStore.ts` | MODIFIED | Baselines, pre-write guard, failure tracking, corrupt quarantine, held writes, snapshot hook, safety events, `hasUnsavedWork()`. |
| `src/utils/fileStoreTypes.ts` | MODIFIED | Add `SafetyNetStore` interface and `isSafetyNetStore()` type guard. The `FileStore` contract is unchanged, so `MemoryFileStore` and test doubles are untouched. |
| `src/hooks/usePageHideFlush.ts` | NEW | Registers `pagehide`, `visibilitychange`, `beforeunload` for a `SafetyNetStore`. |
| `src/contexts/SafetyNetContext.tsx` | NEW | Reads the flag, configures the store, exposes snapshot and actions via `useSyncExternalStore`, triggers the focus check, owns the remount `epoch`. |
| `src/components/DataSafetyBanner.tsx` | NEW | Single-row sticky alert region. |
| `src/pages/settings/components/BackupsSection.tsx` | NEW | Backups list and restore, rendered inside `DataFolderPane`. |
| `src/styles/DataSafetyNet.css` | NEW | Styles, prefix `dsn-`. |

**Mount point.** `InnerProviders` becomes `composeProviders(GoalsProvider, DataProvider, FlagProvider, SafetyNetProvider)`. It must be inside `FlagProvider` (flag) and inside `FileStoreGate` (a ready store). `FileStoreProvider` cannot read flags, which is why the store is configured from a child instead of deciding itself.

### 3.3 Data model and file formats

All new files are human-readable.

```
<data folder>/
  accounts.json                         (existing)
  accounts.json.corrupt-20261108T183437123Z   (NEW, only when accounts.json was unreadable; byte-for-byte copy)
  _backups/                             (NEW)
    README.txt
    accounts/20261108T183437123Z.json
    accounts/20261108T201502044Z-unsaved.json
    balances/2026/20261108T183437123Z.csv
    transactions/2025/2025-03/20261101T090000000Z.csv
    taxes/2025/20261030T120000000Z.json
```

Rules:

- **Path mapping.** `backupPathFor('balances/2026.csv', stamp, tag?)` = `_backups/balances/2026/<stamp>[-unsaved].csv`. The directory is the original path without its extension; the extension is kept on the copy so editors open it.
- **Stamp.** UTC `yyyymmddThhmmssmmmZ` (no colons, valid on Windows, sorts lexicographically).
- **Eligible paths.** Text files ending `.json` or `.csv`. Excluded: `_backups/**`, `budget/summary-cache.json` (derived), `taxes/*/files/**` and any binary (tax documents; size and not user-edited).
- **`_backups/README.txt`** (written once, plain text): "These are automatic copies made by worth before a file was changed. The newest 10 copies of each file are kept. You can delete this folder at any time. To restore a copy, use Settings > Data Folder > Backups, or copy the file back yourself."
- **Corrupt copy.** Sibling of the original so a Finder user finds it. Names such as `accounts.json.corrupt-...` fail every existing filter (`/^(\d{4})\.json$/`, `endsWith('.csv')`, `/^\d{4}\.csv$/`), so no loader picks them up (row 15).
- No new JSON schema is introduced; no existing file format changes. Older app versions ignore `_backups/` and `*.corrupt-*` (back-compat). A user who deletes them loses nothing else.

### 3.4 Types (TypeScript)

```ts
export type WriteFailureKind = 'permission' | 'disk-full' | 'other'
export class FileStoreError extends Error {
  constructor(public code: 'corrupt-blocked' | 'stale-blocked' | 'unseen-file' | 'write-failed', message: string) { super(message) }
}
export interface Fingerprint { lastModified: number; size: number; hash: string }
export interface SafetySnapshot {
  failed: { path: string; kind: WriteFailureKind }[]
  corrupt: { path: string; copyPath: string | null; hasBackup: boolean }[]
  stale: { path: string; deleted: boolean }[]
  permissionLost: boolean
  pendingCount: number
  backupsHealthy: boolean
}
export interface BackupEntry { path: string; backupPath: string; stamp: string; unsaved: boolean; size: number }

export interface SafetyNetStore {
  configureSafety(opts: { enabled: boolean }): void
  getSafetySnapshot(): SafetySnapshot            // referentially stable until something changes
  subscribeSafety(cb: () => void): () => void
  flush(): Promise<void>
  hasUnsavedWork(): boolean                      // pending || in flight || held || failed
  retryFailed(): Promise<void>
  checkExternalChanges(): Promise<void>          // throttled, no-op when hidden or disabled
  reloadFromDisk(): Promise<void>                // drops cache and baseline of stale paths, keeps unsaved edits as backups
  keepLocal(): Promise<void>                     // snapshots disk, then writes held payloads
  resolveCorrupt(path: string, action: 'restore-latest' | 'start-fresh'): Promise<void>
  requestReconnect(): Promise<PermissionState>   // must run inside a user gesture
  listBackups(): Promise<BackupEntry[]>
  restoreBackup(entry: BackupEntry): Promise<void>
}
export const isSafetyNetStore = (s: FileStore): s is FileStore & SafetyNetStore => 'getSafetySnapshot' in s
```

Constants: `SAFE_WRITE_DEBOUNCE_MS = 120` (used only when enabled; legacy stays 300), `BACKUPS_PER_FILE = 10`, `SNAPSHOT_REFRESH_MS = 6 h`, `FOCUS_CHECK_MIN_INTERVAL_MS = 5000`, `STAT_TIMEOUT_MS = 10000`, `STAT_CONCURRENCY = 6`.

### 3.5 Flows

**A. Normal save (enabled).** `writeJSON` sets the cache and queues a 120 ms debounce (unchanged shape). `flushPath` -> `persist`, now inside the existing `filestore:${path}` lock:
1. `getFileHandle(name)` without `create`. If missing, create and write (no guard needed).
2. Existing file: `getFile()`; compare `lastModified` and `size` to the path's baseline. Equal means safe. If only `lastModified` differs, read bytes and compare `hash`: equal means a sync tool touched it, so re-baseline silently; different means **stale**. Different `size` means stale without reading.
3. **No baseline** (this tab never read it) and the file exists: snapshot it, then write. Never block on content we have never seen.
4. Stale: do not write. Keep the latest payload in `held`, reject waiters with `FileStoreError('stale-blocked')`, raise `stale` in the snapshot.
5. Otherwise run the snapshot policy (3.7), then `createWritable` / `write` / `close`, then `getFile()` again to record the new baseline (hash computed from the bytes just written). Also post the existing BroadcastChannel message.

Cost: two extra metadata calls per write, one extra read only on mtime-only mismatch or on a snapshot. There is an unavoidable check-then-write race (another machine writes between step 2 and `close()`); no browser API closes it. The snapshot in step 5 limits the damage to one recoverable version.

**B. Page hide, close, tab switch.** Browser guarantee: none. `visibilitychange` to `hidden` is the most reliable lifecycle signal and normally fires before `pagehide` on close; neither lets the page await async work, and `FileSystemWritableFileStream` has no `keepalive` equivalent. So the design is layered best effort:
1. Shorter window: 120 ms debounce when enabled (was 300 ms).
2. On `visibilitychange` (hidden) and `pagehide`, call `store.flush()` without awaiting. This starts the writes immediately. On a tab switch or minimize the page stays alive and the writes complete; this is the common case and is reliable. On a true close the writes race the renderer teardown and may or may not finish.
3. On `beforeunload`, also call `flush()`, then `preventDefault()` and set `returnValue = ''` only if `hasUnsavedWork()` is true. Chrome then shows its generic leave-page dialog (text not customizable, and shown only if the page has had a user gesture). The page stays alive while the dialog is open, so the writes started in step 2 normally complete.
4. `saveBalances` is reordered (3.8) so every year's write is queued synchronously before any I/O, otherwise there is nothing for `flush()` to flush.

The spec claims only that flush is started and that unsaved work triggers the prompt. It does not claim zero loss on a hard close; the `_backups/` snapshot of the previous version is the net under that.

**C. Write failure.** `flushPath` catch: classify with `errorKind(error)` (`NotAllowedError` or `SecurityError` -> `permission`; `QuotaExceededError` -> `disk-full`; else `other`), move the payload to `failed`, keep the cache entry (the edit stays in memory and on screen), reject the waiters as today, notify safety subscribers. `retryFailed()` re-queues each failed payload with zero debounce. A newer write to the same path replaces the failed payload. The issue clears when a write to the path succeeds. One automatic retry runs on the next focus check; there is no retry loop.

**D. Permission loss.** On focus, `root.queryPermission({ mode: 'readwrite' })` not equal to `granted` sets `permissionLost` before the user types. A `permission` failure sets it too. `requestReconnect()` calls `root.requestPermission` from the Reconnect click (user gesture is required). `granted` clears the flag and calls `retryFailed()`; `denied` offers "Choose folder again" (existing `pickFolder`).

**E. Corrupt read.** In `readJSON`, a parse failure on non-empty text (after `trim()`) does, synchronously, `corrupt.set(path, ...)` and returns the fallback as today, so no caller changes. Asynchronously it copies the raw bytes to `corruptPathFor(path, stamp)` and verifies the copy's size. Any write to a path in `corrupt` is held (`FileStoreError('corrupt-blocked')`) rather than persisted. Zero-byte files are treated as missing (no quarantine; a sync client may have created a placeholder). Resolutions: `restore-latest` writes the newest backup that parses as JSON (its own snapshot is not needed, the corrupt copy exists) and unblocks; `start-fresh` writes the held payload (or nothing) and unblocks. CSV is out of scope for corruption detection in v1: `parseCSV` is lenient and loaders skip bad rows, so "corrupt" has no reliable definition (Q4).

**F. External changes on focus.** `window` `focus` and `document` `visibilitychange` (visible) call `checkExternalChanges()`, throttled to once per 5 s, skipped when hidden. Watch set = paths that have a baseline AND still have a cache entry (this tab holds loaded data it could overwrite with). For each path, with concurrency 6 and a 10 s per-stat timeout (iCloud may block on a not-yet-downloaded file; a timeout skips that path): `getFile()`, apply the same comparison as step 2 of flow A. A `NotFoundError` marks `deleted`. Typical cost: under 40 metadata calls, no content reads. Directory-level changes (a new `balances/2027.csv` from another machine) are not detected by this check; they surface through the delete guard (3.8) or on the next reload. FileSystemObserver is not used: its availability for user-picked local folders is unverified.

**G. Reload / Keep my version.** `reloadFromDisk()`: for each stale path, snapshot any held or pending payload as `-unsaved`, discard it, drop cache and baseline, `notify(path)`. Then the context bumps `epoch` and dispatches `window` `data-changed`. Subscribed hooks (accounts, goals, profile, budget categories, allocation, leverage, paydown) refresh from `notify`; `data-changed` refreshes balances (3.9); everything else re-reads because `SafetyNetProvider` renders `children` under `<Fragment key={epoch}>`, remounting the app shell. Explicit trade-off: open dialogs and scroll position reset, and `GoalsProvider` stays mounted (its `pendingDelete` undo toast survives). `keepLocal()`: snapshot the disk version, write the held payloads, re-baseline.

**H. Two tabs on one folder.** The lock plus BroadcastChannel stay as the live path: tab B drops its cache and refreshes subscribed paths on A's write, which also refreshes B's baseline. For a path B holds but did not refresh, B's baseline is stale; B's next write fails the step-2 guard and is held with the `stale` banner, or the focus check finds it first. This is the same UI as the cross-machine case, so there is no separate multi-tab behavior to learn.

**I. Demo and e2e.** `SafetyNetProvider` does nothing unless `isSafetyNetStore(fileStore) && fileStore.getHandle() !== null && !isDemoActive()`. Demo and `_e2eMode` store `MemoryFileStore`, which lacks the API; no listener is registered and no `_backups/` writes are possible.

### 3.6 `_backups/` placement (resolves PM open question b)

Inside the data folder. The File System Access grant covers only that directory; OPFS or IndexedDB copies would be invisible to the user, can be evicted, and break "plain files you can read". Effects:

- **Drive page:** none (row 15). **App loaders:** none.
- **Sync tools (iCloud, Dropbox):** they will sync `_backups/` too. That is desirable (backups reach the other machine) but costs space: worst case 10 copies of every JSON/CSV, typically under a few MB. The README explains it and says it is safe to delete.
- **User backup tools / git:** a git user should add `_backups/` and `*.corrupt-*` to `.gitignore`; the README says so. The app never writes a `.gitignore`.
- Underscore prefix sorts first in Finder, is not hidden (users can find it), and avoids dot-name edge cases in the picker API (unverified).
- If a `_backups` entry exists as a file, or creating it fails, backups are disabled for the session and `backupsHealthy` is false; writes proceed (3.10).

### 3.7 Snapshot policy and rotation (resolves "how many")

Take a snapshot of the current on-disk bytes immediately before overwrite or delete when the path is eligible, the file exists and is non-empty, and either (a) no snapshot of this path was taken in this session, or (b) the last one this session is older than 6 h, and in both cases only if the bytes differ (fingerprint hash) from the newest existing snapshot. Always snapshot, regardless of the rules, before `keepLocal`, `restoreBackup`, `resolveCorrupt` restore, and `reloadFromDisk` of unsaved edits (tag `-unsaved`). Keep the newest 10 per original path and delete older ones after each snapshot. This gives "state at the start of each working session" for roughly the last 10 sessions, at one extra read and write per file per session.

### 3.8 Changes to existing write paths

- `balanceStorage.saveBalances`: queue all `writeCSV` calls first (`Promise.all`), then do the `listFiles` and delete pass. Behavior is unchanged except latency and ordering. Deletion of a year file is routed through `store.delete()`, which now guards (below).
- `FileSystemFileStore.delete()` for eligible text paths when enabled: with a baseline and an unchanged disk -> snapshot, then delete. Changed disk or no baseline and the file exists -> refuse with `FileStoreError('unseen-file' | 'stale-blocked')` and raise `stale`. This stops the stale-tab year-file deletion (row 10). Tax binaries and non-eligible paths are unchanged.

### 3.9 DataContext

No change to its write handlers. `data-changed` is an existing, currently unused event hook (row 11); the safety context dispatches it after Reload. A separate fix to subscribe `DataContext` to `balances/*.csv` is a good follow-up but out of scope here (Q8).

### 3.10 Failure-mode analysis

| Failure | Behavior |
|---|---|
| Backup copy fails (disk full) | Log, set `backupsHealthy=false`, still write. Settings shows "Last backup failed" in the Backups section only; no banner (the user's edit matters more than the copy). |
| Corrupt copy fails | Original left untouched, writes to the path held, banner says no copy could be saved. |
| Stat hangs (cloud placeholder) | 10 s timeout, path skipped this round. |
| `getFile()` throws `NotAllowedError` | Sets `permissionLost`. |
| mtime coarse (2 s on FAT/exFAT) | A same-size external edit within the granularity can go undetected. Accepted; the backup limits the damage. |
| Sync tool rewrites with same content | Hash equal, silent re-baseline, no banner. |
| Sync tool preserves mtime but changes content at a different size | Caught by size. Same mtime and same size is undetectable; accepted. |
| Held payloads when tab closes | `hasUnsavedWork()` is true, so the leave-page prompt appears. |
| Performance | Reads unchanged. Writes: +2 metadata calls. Focus check: under 40 metadata calls every 5 s at most. Hash: 53-bit non-cryptographic (cyrb53) over bytes, synchronous, runs only on mtime-only mismatch. It detects change; it is not a security control, and it avoids `crypto.subtle`, which jsdom may lack. |

### 3.11 Rollout, flag, migration

- NEW flag in `src/flags/flagDefinitions.ts`: `DATA_SAFETY_NET: defineFlag('data-safety-net', { type: 'boolean', default: false, description: 'Protects data files: flush on page hide, visible save errors, corrupt-file quarantine, external-change detection, and _backups snapshots', temporary: true })`. Add `"data-safety-net": { "percentage": 0 }` to `feature-flags.json`.
- Sequence: author overrides locally (`flag-overrides`) and dogfoods; then 10%, then 100% via the JSON; after at least 2 weeks at 100% with no regressions, a cleanup PR deletes the flag, the legacy 300 ms path and the inert branches.
- Resolution lag: the flag resolves after `FlagProvider` loads (cache up to 5 min, `FlagContext.tsx` `CACHE_MAX_AGE_MS`). Until then the store behaves as today; this gap is accepted. Kill switch = set percentage 0; takes up to 5 minutes.
- Existing data folders need no migration. `_backups/` appears on the first overwrite after enabling. Turning the flag off leaves the folder in place and unused.
- No new network call. The CSP is unchanged.

## 4. Product requirements

### 4.1 User stories

- As someone whose data folder is synced across machines, I want the app to protect and refresh my files, so that a closed tab, a bad file or a stale tab never costs me data.
- As someone entering this month's balances, I want to be told when a save fails, so that I do not close the tab believing it worked.
- As someone whose sync tool left a broken file, I want the app to keep that file and show me my options, so that I can recover it.
- As someone who edits on two computers, I want to be asked before one overwrites the other, so that neither silently wins.
- As a screen-reader or keyboard-only user, I want these warnings announced and operable without a mouse.

### 4.2 Acceptance criteria

Flush and unload
- **AC-1** With the flag on, a pending write is started (its `createWritable` is called) after a `pagehide` event without advancing timers.
- **AC-2** Same for `visibilitychange` when `document.visibilityState === 'hidden'`; a `visible` event starts nothing.
- **AC-3** `beforeunload` is cancelled (`defaultPrevented`) only when `hasUnsavedWork()` is true (pending, in flight, held or failed); with nothing outstanding it is not cancelled. It also calls `flush()`.
- **AC-3a** `saveBalances` with 3 changed years queues 3 writes before the first resolves.

Write failure
- **AC-4** When `writable.close()` rejects, a `role="alert"` banner naming the file appears within 1 s.
- **AC-5** The edited value is still displayed and the store cache still holds it.
- **AC-6** "Try again" re-persists the payload; on success the banner is removed and "All changes saved." is announced once. On failure the banner stays with the updated cause.
- **AC-7** A newer edit to a failed path replaces the failed payload (the older value is never written after the newer one).
- **AC-8** Closing the tab while a failed or held payload exists triggers the leave-page prompt.

Corrupt file
- **AC-9** If `accounts.json` does not parse, zero writes reach that path, an identical `.corrupt-<stamp>` copy exists, and the banner appears. The app still loads with the fallback state.
- **AC-10** Edits to a corrupt path are held, not written. Resolving with "Restore latest backup" writes the newest valid backup; "Start fresh" writes the held payload (or nothing). Either clears the banner.
- **AC-11** A zero-byte file is treated as missing: no banner, no `.corrupt` copy.

External changes
- **AC-12** After a file changes on disk (different size, or different content with a new mtime), focusing the window within 5 s shows "Files changed on disk." (role `status`).
- **AC-13** An mtime-only change with identical content shows nothing and does not block writes.
- **AC-14** "Reload" refreshes visible data to the disk version; any unsaved local edit is kept as `-unsaved` in `_backups/`.
- **AC-15** While a path is stale, writes to it are held; no write reaches the disk until the user chooses.
- **AC-16** "Keep my version" first snapshots the disk version, then writes the held payload.
- **AC-17** A tab holding stale `balances` does not delete a year file it never loaded (delete is refused and surfaces the stale banner).
- **AC-17a** A deleted file shows the deleted wording; Reload shows the empty state, Keep my version recreates it.

Permission
- **AC-18** When write permission is lost, the banner shows "Reconnect folder"; pressing it calls `requestPermission` from the click handler. `granted` retries failed writes and clears the banner.
- **AC-19** `denied` changes the banner to "Choose folder again" with a warning that unsaved edits may be lost.
- **AC-20** Focus triggers `queryPermission` and shows the banner before any edit.

Backups
- **AC-21** The first overwrite of an eligible file in a session creates `_backups/<path-without-ext>/<stamp>.<ext>` containing the previous bytes; a second overwrite within 6 h creates none; the 11th copy deletes the oldest.
- **AC-22** Identical bytes to the newest copy are not duplicated.
- **AC-23** Binary files, `budget/summary-cache.json` and `_backups/**` are never snapshotted.
- **AC-24** Settings > Data Folder > Backups lists files that have copies, newest first, with date, time and size. Restore asks for inline confirmation, snapshots the current file first, writes the copy and refreshes the app.
- **AC-25** If a backup write fails, the user's save still succeeds and the Backups section shows the warning.

Scope and safety
- **AC-26** Demo mode and e2e mode register no listeners and write no `_backups/` files.
- **AC-27** With the flag off, every existing unit and e2e test passes unmodified and the store behaves as before.
- **AC-28** Only the highest-priority issue is shown (priority: permission, write failure, corrupt, external change); "N more" text shows the rest.
- **AC-29** Banner and Backups UI pass keyboard-only and screen-reader checks (section 5.7).
- **AC-30** No network request is made by any safety-net code.

### 4.3 Scope

**IN:** flush on hide and unload prompt; save-failure banner with retry; permission-loss reconnect; corrupt JSON quarantine with restore or start-fresh; external-change detection on focus and before write; per-file rolling backups in `_backups/`; Backups list and restore in Settings; flag, tests, docs.

**OUT (and why):**
- *Merge or conflict resolution:* needs a data-aware merge per file type; the user chooses a side and the other is kept in `_backups/`.
- *Encryption:* separate concern; would change the human-readable promise.
- *Full version history or diffing:* 10 snapshots is a safety net, not history.
- *CSV corruption detection:* no reliable definition (3.5 E).
- *Backup of tax PDFs and other binaries:* size; they are not edited in place.
- *Cloud or off-disk backup, scheduled export:* breaks "nowhere else".
- *Watching new files appearing in a directory:* no portable watch API; follow-up.
- *"Saving..." or last-saved indicator:* extra chrome; open question Q9.

### 4.4 States

- **First time:** no UI at all. `_backups/` appears after the first overwrite. Backups section shows the empty state.
- **Returning:** unchanged until something goes wrong.
- **Loading:** Backups list shows "Reading backups..."; retry button shows "Trying again..." with `aria-busy`.
- **Error:** every banner states what happened, what is safe, and what to do.
- **Empty:** no backups -> message; no issues -> banner not rendered (no empty live region content).
- **Demo:** none of this is visible.

### 4.5 Keyboard and screen reader

- The banner is not focus-trapped and never steals focus. Alerts are announced on insertion by their live region. Tab reaches its buttons in DOM order: after the page header, before page content, because it sits at the top of `main`.
- After Reload, "Keep my version", "Try again" or Reconnect succeeds, the banner disappears, so focus moves to `#main-content` (it has `tabIndex={-1}`) to avoid focus loss.
- Backups: native `<select>` for the file, buttons for restore. Inline confirm moves focus to "Restore this copy"; Cancel returns focus to that row's Restore button. Success message is `role="status"`.
- Escape does nothing in the banner (it is not a dialog).

### 4.6 Edge cases

- Two issues at once: only the top one is shown; resolving reveals the next.
- Issue resolves itself (retry succeeded through a later normal write): banner removed with the same "All changes saved." status.
- 50 stale files: banner says "50 files"; Reload/Keep apply to all.
- File changes again while the banner is up: the path stays in the list; nothing re-announces.
- User disconnects the folder or enters demo while issues exist: provider unmounts, listeners removed; held payloads are dropped with the store instance (the leave-page prompt is not raised for a deliberate disconnect).
- Restore of a backup for a file that currently has a corrupt/stale issue: restore bypasses the block and clears that issue.
- Windows/Unix paths with unusual characters: `backupPathFor` uses the same `/`-split as `splitPath`; names with characters invalid on the disk fail the copy and fall under backup failure.
- Clock skew between machines: stamps are UTC and names only need to be unique; ordering inside `_backups/` can be off by the skew, and pruning still removes the lexicographically smallest.
- Browser auto-revokes permission after inactivity: handled by the focus `queryPermission` check.

## 5. Design spec

### 5.1 Component hierarchy

```
<div class="dsn-region" role="region" aria-label="Data safety">          (sticky, top:0, z-index:200; only rendered when an issue exists)
  <section class="dsn-banner dsn-banner--error|--warning" role="alert" | role="status">
    <svg class="dsn-banner__icon" aria-hidden="true">...</svg>          (stroke-based, currentColor)
    <div class="dsn-banner__text">
      <p class="dsn-banner__title">...</p>
      <p class="dsn-banner__body">...</p>
      <p class="dsn-banner__more">2 more issues need attention.</p>
    </div>
    <div class="dsn-banner__actions"><button class="dsn-btn dsn-btn--primary">..</button><button class="dsn-btn">..</button></div>
  </section>
  <p class="sr-only" role="status" aria-live="polite">All changes saved.</p>   (persistent, text swapped on resolve)
</div>
```

`.sr-only` already exists (`src/styles/utilities.css`). The persistent live region is mounted with the region so its text change is announced; the region itself unmounts only when both it and the banner are empty (keep it mounted for 1 s after resolve so the announcement fires). Mounted in `AppShell` directly above `<Suspense>`, next to the demo banner.

Backups (inside `DataFolderPane`, after the existing description, using `settings-section-content` conventions):

```
<h4 class="dsn-backups__title" id="dsn-backups-title">Backups</h4>
<p class="settings-description">...</p>
<label for="dsn-backups-file">File</label><select id="dsn-backups-file" class="dsn-select">
<ul class="dsn-backups__list" aria-labelledby="dsn-backups-title">
  <li class="dsn-backups__row"><span>Nov 8, 2026, 6:34 PM</span><span class="dsn-backups__size">4.2 KB</span><button class="dsn-btn">Restore</button></li>
</ul>
<p class="dsn-backups__status" role="status"></p>
```

### 5.2 Visual spec (existing variables only, from `src/styles/colorThemes.css`)

| Element | Light and dark via variables |
|---|---|
| Banner container | `margin: 0; padding: 12px 16px; gap: 12px; border-bottom: 1px solid`; radius 0 at full width |
| Error banner | background `--color-negative-light`; border `--color-negative-border`; icon `--color-negative`; text `--color-text` |
| Warning banner (external change) | background `--color-warning-light`; border `--color-warning`; icon `--color-warning-text`; text `--color-text` |
| Title | `--fs-sm`, `--fw-semibold`, line-height 1.4 |
| Body | `--fs-sm`, `--fw-normal`, color `--color-text-secondary`, line-height 1.5, max-width 68ch |
| "N more" | `--fs-xs`, `--color-text-muted` |
| Buttons | height 32px (44px at 768 and below), padding 0 14px, `--fs-sm`, `--fw-semibold`, radius `--radius`; primary: surface background `--color-surface`, 2px border `--accent`, text `--color-text`; secondary: transparent, 1px `--color-border-light`, text `--color-text` |
| Backups row | padding 8px 0, bottom border `--color-border`; date `--fs-md`, size `--fs-sm` `--color-text-muted` |

Do not use `--accent` as a button fill with white text: in dark mode `#3b82f6` on white is about 3.7:1 and fails 1.4.3. Accent is used for borders and focus only.

### 5.3 States

| State | Treatment |
|---|---|
| Default | as above |
| Hover | button background `--color-surface-hover` |
| Focus | `outline: 2px solid var(--accent); outline-offset: 2px` (same as `.settings-modal-nav-item:focus-visible`) |
| Active | button background `--accent-light` |
| Disabled / loading | `aria-disabled`/`disabled`, opacity 0.6, label swaps to "Trying again..." with `aria-busy="true"` on the banner |
| Empty | Backups: muted description line; banner not rendered |
| Error (inside Backups) | text `--color-negative`, `role="alert"` |

### 5.4 Responsive

- 992px and up: one row: icon, text (flex 1), actions right-aligned.
- 768 to 991: same, text wraps up to 3 lines.
- Up to 768: actions wrap below the text, left-aligned, buttons min-height 44px.
- Up to 480: padding 12px; buttons full width and stacked; Backups rows become two lines (date and size, then a full-width Restore). The region stays sticky but only one banner row is ever shown (AC-28), so it cannot cover more than about a quarter of a 667px-high viewport. Sidebar collapse thresholds (900px, 479px) are unaffected; the banner is inside `main`.

### 5.5 Dark mode

Variable swaps are sufficient (`body.dark` redefines `--color-negative-light` as `#2d1b1b`, `--color-warning-light` as `#451a03`). Text `#e5e7eb` on these is about 12:1. Border uses the variable. Verify under `body.modern-design` (Inter, borders); add overrides in `modern-design.css` only if the base looks wrong. Never use `prefers-color-scheme`.

### 5.6 Interaction and motion

- Banner appears with a 150 ms opacity fade (`ease`), no slide, so layout does not jump; under `prefers-reduced-motion: reduce` there is no transition. It does not push content down after first paint beyond its own height.
- No auto-dismiss, no progress bar, no timeouts. Issues clear only when resolved.
- Inline restore confirm expands in place with no animation.

### 5.7 Accessibility notes (WCAG 2.1 AA)

- **4.1.3 Status Messages:** errors use `role="alert"`; the external-change warning and success messages use `role="status"` (polite) because they do not demand immediate interruption.
- **1.4.3 Contrast:** all text uses `--color-text` or `--color-text-secondary` on tinted backgrounds; verify with the dark set. **1.4.11:** focus ring and button borders are at least 3:1.
- **2.1.1 / 2.4.3 / 2.4.7:** every action is a native `<button>`; order follows the DOM; focus ring is visible.
- **3.3.1 / 3.3.3 Error identification and suggestion:** each error names the file and the next step.
- **1.3.1:** region has an accessible name; the file `<select>` has a visible `<label>`; the list is a real `<ul>`.
- **2.5.5 (best practice):** 44px targets at 768px and below.
- Restore buttons carry an `aria-label` naming file and time; the visible text stays "Restore".
- Icons are `aria-hidden`; no emoji (repo convention).

## 6. Copy

Voice: plain, calm, direct. No exclamation marks. File names appear as written on disk.

| Surface | String | Notes |
|---|---|---|
| Banner, save failed (1 file) title | Couldn't save changes to {file}. | `{file}` e.g. `balances/2026.csv` |
| Banner, save failed (n files) title | Couldn't save changes to {n} files. | |
| Save failed body | Your changes are still on screen but not on disk. Check that your data folder is available, then try again. | `other` |
| Save failed body, disk full | Your changes are still on screen but not on disk. The disk looks full. Free some space, then try again. | `disk-full` |
| Save failed button | Try again | |
| Retrying | Trying again... | button label while busy |
| Retry still failing | Still couldn't save {file}. Your changes are safe on screen; leaving this tab would lose them. | replaces body |
| Saved status | All changes saved. | `role="status"`, once |
| Permission title | Access to your data folder was lost. | |
| Permission body | Your changes are still on screen but not saved. Reconnect to keep them. | |
| Permission button | Reconnect folder | |
| Permission denied body | Access wasn't granted. Choosing the folder again reloads it from disk, so unsaved changes on screen may be lost. | |
| Permission denied button | Choose folder again | existing `pickFolder` |
| Corrupt title | Couldn't read {file}. | |
| Corrupt body (copy saved) | The file isn't valid JSON, so the app left it untouched and saved a copy as {copyName}. Changes to it won't be saved until you choose how to continue. | |
| Corrupt body (copy failed) | The file isn't valid JSON and a copy couldn't be saved, so the app left it untouched. Changes to it won't be saved until you choose how to continue. | |
| Corrupt buttons | Restore latest backup / Start fresh | Restore hidden if no valid backup |
| Corrupt resolved status | {file} restored from the backup of {date}. / {file} replaced. The unreadable copy is still in your folder. | `role="status"` |
| External title (1 file) | {file} changed on disk. | |
| External title (n files) | Files changed on disk. | PM wording kept for n > 1 |
| External body | They were changed outside this tab, maybe on another computer or by a sync tool. Saving to them is paused so nothing gets overwritten. | `{n}` > 1 uses "They"; 1 file uses "It was changed ... Saving to it is paused ..." |
| External deleted body | {file} was deleted outside this tab. Saving to it is paused. Reload to see what's on disk, or keep your version to create it again. | |
| External buttons | Reload / Keep my version | |
| Reload status | Reloaded from disk. Any unsaved edits were kept in _backups. | |
| Keep status | Saved your version. The previous version is in _backups. | |
| More issues | {n} more issues need attention. | |
| Region label | Data safety | `aria-label` |
| Backups heading | Backups | |
| Backups description | Before a file is changed, the app keeps a copy in the _backups folder inside your data folder. The newest 10 copies of each file are kept. Your sync and backup tools will see this folder too. | |
| Backups empty | No backups yet. Copies appear the first time a file is changed. | |
| Backups loading | Reading backups... | |
| Backups file label | File | |
| Backups row unsaved | Unsaved edit, {date} | |
| Backups restore button | Restore | `aria-label`: Restore {file} from {date} |
| Backups confirm | Replace the current {file} with this copy? The current version is backed up first. | |
| Backups confirm buttons | Restore this copy / Cancel | |
| Backups restored | Restored {file} from {date}. | |
| Backups restore error | Couldn't restore that copy. The current file was not changed. Check that your data folder is connected, then try again. | |
| Backups list error | Couldn't read the _backups folder. Check that your data folder is connected. | |
| Backups warning | The last backup copy couldn't be saved. Your changes were saved normally. | when `backupsHealthy` is false |
| README Privacy | Before it changes a file, the app copies the old version into a _backups folder inside your data folder. | exact README wording in 7.4 |

## 7. Engineering plan

### 7.1 File-by-file

| File | Status | Change |
|---|---|---|
| `src/utils/safetyNet.ts` and `.test.ts` | NEW | types and pure helpers (3.4) |
| `src/utils/backupManager.ts` and `.test.ts` | NEW | `snapshot(path, bytes, tag?)`, `list()`, `prune(path)`, `restore(entry)` over `RawIO` |
| `src/utils/fileStore.ts` | MODIFIED | `configureSafety`; baseline map; guard in `persist`; failure and held maps; corrupt quarantine in `readJSON`; `readText` records baselines (read bytes, then decode); `delete` guard; `hasUnsavedWork`; safety subscribers; read-after-write baseline |
| `src/utils/fileStore.test.ts` | MODIFIED | fake handles get stable `lastModified` and `queryPermission`/`requestPermission`; add safety suites; existing 32 `it` blocks unchanged |
| `src/utils/fileStoreTypes.ts` | MODIFIED | `SafetyNetStore`, `isSafetyNetStore` |
| `src/utils/balanceStorage.ts` | MODIFIED | queue-then-clean-up ordering |
| `src/utils/balanceStorage.test.ts` | NEW | none exists today (verified); covers ordering, year grouping, deletion |
| `src/hooks/usePageHideFlush.ts` and `.test.ts` | NEW | listeners and cleanup |
| `src/contexts/SafetyNetContext.tsx` and `.test.tsx` | NEW | provider and `useSafetyNet()` (inert default so tests without a provider work, like `useFileStore`) |
| `src/components/DataSafetyBanner.tsx` and `.test.tsx` | NEW | |
| `src/pages/settings/components/BackupsSection.tsx` and `.test.tsx` | NEW | |
| `src/pages/settings/components/DataFolderPane.tsx` | MODIFIED | render `BackupsSection` when `useSafetyNet().enabled` |
| `src/pages/settings/components/DataFolderPane.test.tsx` | MODIFIED | add a case; existing mock of `useFileStore` keeps working |
| `src/styles/DataSafetyNet.css` | NEW | imported by the banner and section |
| `src/App.tsx` | MODIFIED | add `SafetyNetProvider` to `InnerProviders`; render `<DataSafetyBanner />` above `<Suspense>`; update the provider-order comment |
| `src/flags/flagDefinitions.ts`, `feature-flags.json` | MODIFIED | flag (3.11) |
| `e2e/fixtures/fake-fsa.ts` | NEW | in-page fake `FileSystemDirectoryHandle` with controllable `lastModified`, failure injection, permission state; installs `window.showDirectoryPicker` |
| `e2e/data-safety-net.spec.ts` | NEW | scenarios in 7.3; uses plain `@playwright/test` (the shared fixture forces `_e2eMode`), re-adding the feature-flags route mock and the `flag-overrides` init script |

`MemoryFileStore`, `DataContext.tsx`, `GoalsContext.tsx` and the 31 `.catch(console.error)` sites are not modified.

Key signatures: `usePageHideFlush(store: (FileStore & SafetyNetStore) | null): void`; `backupPathFor(path: string, stamp: string, tag?: 'unsaved'): string`; `fingerprintBytes(bytes: Uint8Array, lastModified: number): Fingerprint`; `compareFingerprint(base: Fingerprint, current: { lastModified: number; size: number }): 'same' | 'size-changed' | 'mtime-only'`; `errorKind(error: unknown): WriteFailureKind`.

### 7.2 Implementation order (PR-sized slices, each green on the 5-step pre-commit checklist)

1. **PR1, plumbing and loud failures:** flag, `SafetyNetProvider`, `usePageHideFlush`, failure tracking, permission loss, banner (error rows only), `saveBalances` reorder, `fake-fsa.ts` and first e2e tests. Smallest useful slice; fixes the most common loss (AC-1 to AC-8, AC-18 to AC-20, AC-26 to AC-28).
2. **PR2, backups:** `backupManager`, snapshot hook, prune, README.txt, Backups section and restore (AC-21 to AC-25).
3. **PR3, corrupt files:** quarantine, held writes, resolutions (AC-9 to AC-11). Depends on PR2 for "Restore latest backup".
4. **PR4, external changes:** baselines, guard, focus check, delete guard, Reload and Keep (AC-12 to AC-17a).
5. **PR5, docs, rollout:** README, Guide, CONTRIBUTING, architecture HTML; set 10% rollout. Later: flag-removal PR.

Review gates follow `.github/copilot-instructions.md`: branch review by Alex and Casey before opening each PR.

### 7.3 Test plan

**Unit (vitest, `MemoryFileStore` or the fake handle):**
- `safetyNet.ts`: fingerprint determinism, `compareFingerprint` matrix, stamp format and sort, `backupPathFor` for each path shape in section 3.3, eligibility table, prune keeps 10 newest, `errorKind` mapping.
- `backupManager`: snapshot, dedupe by hash, 6 h rule with fake timers, prune, restore snapshots current first, README written once, list parsing of `-unsaved`.
- `fileStore` safety: flush on demand; guard matrix (no baseline, same, mtime-only same content, mtime-only different content, size changed, deleted); held payloads; `retryFailed`; error injection at `getFileHandle`, `createWritable`, `write`, `close`; 20 malformed JSON inputs (AC-9); zero-byte; delete guard (AC-17); inert when not configured (AC-27).
- `usePageHideFlush`: `pagehide`, `visibilitychange` both states, `beforeunload` prevented only with unsaved work, cleanup removes listeners.
- `SafetyNetContext`: flag off means inert; Memory store means inert; flag on registers once; epoch remounts children.
- `DataSafetyBanner`: priority order, role per kind, texts, busy state, focus moves to `#main-content` after resolve, "N more".
- `BackupsSection`: loading, empty, error, select filter, confirm flow focus, restore success and failure.

**Playwright e2e (real `FileSystemFileStore` over `fake-fsa.ts`; flag forced on; no `_e2eMode`):**
1. Edit a balance, fail the next `close()`: alert shows; edit still visible; clear the fault; "Try again"; reload page and value persists (repo anti-pattern 5: assert after reload).
2. Edit then `page.close({ runBeforeUnload: true })` with a slow fake writer: dialog appears; register the dialog handler before triggering (anti-pattern 3).
3. Seed corrupt `accounts.json`: banner; original bytes unchanged; `.corrupt-` copy identical; add an account; assert no write to the path; "Restore latest backup" restores.
4. Mutate a file's content and mtime in the fake, dispatch `focus`: "Files changed on disk" appears; Reload shows the new value; second run with "Keep my version" leaves the fake's `_backups` holding the old bytes.
5. Mtime-only touch: no banner.
6. Revoke permission in the fake: reconnect flow.
7. Keyboard-only run of scenario 1 using `page.keyboard` Tab order (anti-pattern 1: real Tab, not `.focus()`).
8. Network assertion: record requests; only `feature-flags.json` appears (AC-30).
9. Backups: three sessions of edits, Settings > Data Folder > Backups lists them; restore refreshes the Net Worth page.

**A11y:** the repo has no axe dependency (verified in `package.json`); do not add one for this spec. Use role/name assertions, the keyboard scenario above, and the manual contrast check in light and dark. `e2e/keyboard-nav.spec.ts` gets a banner-present case only if a page object already exists there.

**Manual protocol (run before rollout, Chrome stable, real folder in iCloud Drive and a plain folder):** (a) edit a balance and close the tab immediately, then check the file; (b) `chmod` the folder read-only, edit, observe banner, restore permissions, retry; (c) break `accounts.json` with a text editor, reload; (d) edit `profile.json` in an editor while the app is open, refocus; (e) `touch` the file, refocus, expect no banner; (f) edit on a second machine and wait for sync; (g) revoke the site's file access in Chrome site settings.

**Existing tests that change:** `fileStore.test.ts` fakes only (stable mtime, permission methods); possibly `App.test.tsx` if it asserts the provider tree (verify when implementing). `FileStoreContext.test.tsx` and all e2e specs run on memory stores and should not change. Coverage: new files must keep the 90% statements gate; target 95% on them.

### 7.4 Docs to update

- `README.md`: Privacy section "What 'backups' means now" (add the `_backups/` paragraph and the `.gitignore` tip); "How do I use this on two devices?" (add that the app now detects changes from the other machine and asks before overwriting); Settings section (Backups).
- `src/pages/guide/sections/PrivacyAndData.tsx` (trade-off paragraph, L52-56), `FeaturesByPage.tsx` (Settings tip, L185-187) and `CommonQuestions.tsx` (two-device answer; verify wording). Keep README and Guide in sync, and update `Guide.test.tsx` if it asserts these strings. Gate the new Guide copy on the flag until 100% so the docs never promise an unreleased behavior.
- `CONTRIBUTING.md`: file layout table (`_backups/`, `*.corrupt-*`), FileStore notes (debounce, safety API, inert on Memory store).
- `docs/filesystem-storage-architecture.html`: add safety net section; fix the stale lock name (`filestore:${path}`).
- `docs/README.md`: list `specs/data-safety-net.md`.
- Screenshots: regenerate Settings only after flag removal (the screenshot script runs with the flag at default).

### 7.5 Risks and mitigations

| Risk | Mitigation |
|---|---|
| Touches the write path | Flag, inert default, guard logic isolated and unit-tested against a fake, five slices, dogfood on the author's real folder first |
| False "changed on disk" alarms from sync tools | Content hash on mtime-only change; throttle; watch set limited to loaded files |
| False negatives (coarse mtime, same size) | Documented; snapshots limit damage |
| Held writes make the app feel stuck | Banner always offers a resolution; leave-page prompt protects unsaved work |
| Remount on Reload loses UI state | Only on explicit user action; documented trade-off |
| `_backups/` surprises users or bloats a synced folder | README.txt in the folder, Settings copy, 10-copy cap, JSON/CSV only |
| Backup read/write adds latency to the first save per session | One extra read and write per file per session; measure during dogfood |
| Chrome behavior differs from my assumptions (swap-file atomicity of `createWritable`, name rules for `_backups`, `getFile()` blocking on cloud placeholders) | Not verified in this repo; covered by the manual protocol, and nothing relies on them for correctness beyond the snapshot |
| Fake FSA diverges from real Chrome | Keep it minimal; the manual protocol is the real check |

## 8. Cross-feature dependencies

- **monthly-check-in:** Its final "done" step must `await` store writes (or call `flush()` via `isSafetyNetStore`) before showing completion. It needs no registration for backups: any new `.json` or `.csv` it adds is eligible by extension. This spec owns `fileStore.ts`, `balanceStorage.ts` ordering and `DataContext` behavior; check-in changes to `DataContext.setBalances` should rebase on the `saveBalances` reorder (owner: this spec).
- **import-wizard:** Bulk imports must write through `FileStore` (never raw handles) so the guard and snapshots apply; each overwritten month CSV gets a snapshot, which makes "undo this import" possible later. The wizard should await write promises before reporting success. The wizard owns its UI; this spec owns the failure banner, so the wizard should not build its own save-error UI.
- **category-budget-targets:** It will change `budget/categories.json` or add a file; both are covered automatically. It must keep loaders tolerant of unknown files and must not enumerate the data-folder root (`_backups/` and `*.corrupt-*` live there). `budget/categories.json` is subscribed by two hooks, so Reload refreshes it. The budget-targets spec owns its schema; this spec owns the guard.
- **annual-review:** Read-only consumer of most files. It benefits from `checkExternalChanges()` (fresher data) and must also skip `_backups/` in any export or file walk. If it writes a review file, the same guard applies. The annual-review spec owns that file.
- **Shared files:** `src/flags/flagDefinitions.ts`, `feature-flags.json` and `src/App.tsx` are touched by every spec (flag lines and provider or route additions); each spec adds its own lines, and the first to merge owns formatting. This spec owns the provider-composition change and banner mount in `App.tsx` and the `DataFolderPane` change.

## 9. Open questions and decisions

| # | Question | Recommendation | Blocks implementation |
|---|---|---|---|
| Q1 (a) | Can the API detect external changes cheaply on focus? | Yes: `FileSystemFileHandle.getFile()` returns a `File` with `lastModified` and `size` without reading content. Compare both, and hash content only on mtime-only changes. Sync tools that rewrite with identical content are absorbed silently. Same size plus same mtime is undetectable (accepted). No file-watch API is relied on. Approve. | No |
| Q2 (b) | `_backups/` inside the data folder? | Yes (3.6). No impact on Drive or loaders; synced and backed up by the user's tools; documented. Approve. | No |
| Q3 | How many backups and what rotation? | 10 per file, one per session plus one per 6 h in long sessions, deduplicated by hash (3.7). Approve. | No |
| Q4 | Detect corrupt CSV? | No in v1. Revisit if balances files ever get a header checksum. | No |
| Q5 | Is unload flushing guaranteed? | No. Browser gives no guarantee. Ship the layered best effort (3.5 B) and say so in the PR and docs. Approve the wording. | No |
| Q6 | Banner dismissible? | PM draft had dismiss-for-stale. Recommend not dismissible: it is a non-blocking strip, and dismissal would leave writes silently paused. Reload or Keep my version are the only exits. Approve. | Yes (UI shape) |
| Q7 | Two tabs on one folder | Keep the existing lock and channel; rely on the pre-write guard for stale baselines (3.5 H). No new coordination. Approve. | No |
| Q8 | Subscribe `DataContext` to balances files so changes refresh without Reload | Follow-up spec; `data-changed` is enough for this feature. | No |
| Q9 | Add a "Saving... / Saved" indicator | Not now; revisit after dogfooding, since the loud failure path covers the real risk. | No |
| Q10 | Quarantine copy location | Sibling `*.corrupt-<stamp>` for discoverability, not inside `_backups/`. Approve. | No |
| Q11 | Startup reconnect: `FolderPicker` shown whenever `requestPermission` is not `granted` (no user gesture) | Separate small spec: add a "Reconnect {folderName}" button using the stored handle. Out of scope here. | No |
| Q12 | Flag rollout schedule | Author-only override for 1 week, 10% for 1 week, 100%, remove flag after 2 weeks. Approve. | No |
| Q13 | Backup failure should not block saves | Yes (3.10). Approve. | No |
