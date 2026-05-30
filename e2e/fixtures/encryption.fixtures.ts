import { BrowserContext, Page, expect } from '@playwright/test'
import { SENSITIVE_KEYS as SOURCE_KEYS } from '../../src/utils/encryptedStorage'

/**
 * Encryption E2E fixtures.
 *
 * The 13 SENSITIVE_KEYS list is the single source of truth for envelope-shape
 * verification and roundtrip tests. The literal-tuple form below is required
 * for the `SensitiveKey` union type, but it is drift-checked against the
 * source-of-truth export from `src/utils/encryptedStorage.ts` at module load
 * — if a 14th key is added in source without updating this file, the e2e
 * suite refuses to load instead of silently passing over only 13 keys.
 *
 * When encryption is disabled, sensitive-key values in localStorage are
 * plaintext JSON. When encryption is enabled, each value is replaced with an
 * `EncryptedEnvelope` of shape `{ v: 1, iv: string, ct: string }` (see
 * src/utils/crypto.ts).
 */

export const SENSITIVE_KEYS = [
  'user-profile',
  'data-accounts',
  'data-balances',
  'budget-store',
  'budget-summary',
  'budget-config',
  'tax-store',
  'tax-templates',
  'financialGoals',
  'gw-goals',
  'fi-simulations',
  'allocation-custom-ratios',
  'sgt-overrides',
] as const

export type SensitiveKey = (typeof SENSITIVE_KEYS)[number]

/**
 * PBKDF2 deriveKey on a 2024-era laptop at 310k iterations.
 * Used as the budget unit for test timeouts and the perf canary
 * (see e2e/encryption.spec.ts "PBKDF2 deriveKey completes in <2s").
 */
export const PBKDF2_COST_MS = 1000

// Drift guard: if src/utils/encryptedStorage.ts gains or renames a key
// without this fixture being updated, tests would silently pass over only
// the keys this file knows about. Fail loudly at module load instead.
if (
  SOURCE_KEYS.length !== SENSITIVE_KEYS.length ||
  SOURCE_KEYS.some(k => !(SENSITIVE_KEYS as readonly string[]).includes(k))
) {
  throw new Error(
    `E2E SENSITIVE_KEYS drifted from src/utils/encryptedStorage.ts. ` +
      `Source: [${SOURCE_KEYS.join(', ')}]. Fixture: [${SENSITIVE_KEYS.join(', ')}].`,
  )
}

/**
 * Realistic plaintext content for each sensitive key. Shapes match what the
 * app would persist normally — minimal but valid JSON the app can parse.
 * Used by `seedAllSensitiveKeys` and the test-10 roundtrip snapshot.
 */
export function defaultPlaintextContent(): Record<SensitiveKey, unknown> {
  return {
    'user-profile': { name: 'Test User', avatarDataUrl: '', birthday: '1990-01-01' },
    'data-accounts': [
      { id: 1, name: 'Checking', type: 'cash', owner: 'self' },
      { id: 2, name: '401k', type: 'retirement', owner: 'self' },
    ],
    'data-balances': [
      { id: 1, accountId: 1, month: '2024-01', balance: 1000 },
      { id: 2, accountId: 2, month: '2024-01', balance: 50000 },
    ],
    'budget-store': { csvs: {}, configs: {}, years: [2024] },
    'budget-summary': { annualSavings: 12000, saveRate: 0.25, monthsOfData: 6 },
    'budget-config': { version: 1, years: [2024], categoryGroups: [] },
    'tax-store': { years: { 2024: { items: [] } } },
    'tax-templates': [{ id: 'tpl-1', name: 'Default', items: [] }],
    financialGoals: [{ id: 'g-1', goalName: 'Retirement', createdAt: '2024-01-01', birthday: '1990-01-01' }],
    'gw-goals': [{ id: 'gw-1', fiGoalId: 'g-1', label: 'House', createdAt: '2024-01-01' }],
    'fi-simulations': [{ id: 'sim-1', name: 'Baseline' }],
    'allocation-custom-ratios': { stocks: 0.6, bonds: 0.3, cash: 0.1 },
    'sgt-overrides': { '2024-01': { delta: 100 } },
  }
}

/**
 * Seed plaintext JSON for all 13 sensitive keys via `addInitScript` so the
 * values are present before EncryptionProvider mounts. Also clears the
 * encryption lifecycle keys so the app boots in the disabled state.
 *
 * Attaches to the `BrowserContext` so every page created within the context
 * (including tab B in cross-tab tests) inherits the seeded state regardless
 * of which page is opened first.
 *
 * Returns the snapshot so tests can use it for roundtrip verification.
 */
export async function seedAllSensitiveKeys(
  pageOrContext: Page | BrowserContext,
  content: Record<SensitiveKey, unknown> = defaultPlaintextContent(),
): Promise<Record<SensitiveKey, unknown>> {
  const serialized: Record<string, string> = {}
  for (const key of SENSITIVE_KEYS) {
    serialized[key] = JSON.stringify(content[key])
  }

  await pageOrContext.addInitScript(payload => {
    // Idempotent: runs on every new page in the context. Don't clear LS
    // here — within a single test, multiple tabs share localStorage and
    // clearing would wipe state set by another tab (e.g. tab A enabling
    // encryption before tab B opens). Playwright gives each test a fresh
    // browser context with empty localStorage by default, so no clear is
    // needed.
    localStorage.setItem('onboarding-dismissed', '1')
    for (const [k, v] of Object.entries(payload)) {
      // Only seed if not already set — preserves state written by other
      // tabs in the same test.
      if (localStorage.getItem(k) === null) {
        localStorage.setItem(k, v)
      }
    }
  }, serialized)

  return content
}

/**
 * Bare seed: clears localStorage and disables onboarding, with no sensitive
 * keys present. Use for lifecycle tests that don't care about data content.
 *
 * Accepts either a `Page` or a `BrowserContext`. For multi-tab tests, pass
 * the context so every new page inherits the seeded state. For single-tab
 * tests, passing the page is fine.
 */
export async function seedEmptyEncryptionState(pageOrContext: Page | BrowserContext): Promise<void> {
  await pageOrContext.addInitScript(() => {
    // Idempotent: runs on every new page in the context. See note in
    // seedAllSensitiveKeys above — no localStorage.clear() so state written
    // by tab A is visible to tab B when it opens.
    localStorage.setItem('onboarding-dismissed', '1')
  })
}

/**
 * Read the raw value at `key` from localStorage and JSON-parse it. Returns
 * `null` if the key is missing.
 */
export async function readEnvelope(page: Page, key: string): Promise<unknown> {
  return page.evaluate(k => {
    const raw = localStorage.getItem(k)
    if (raw === null) return null
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }, key)
}

/**
 * Type guard for the `EncryptedEnvelope` shape produced by
 * `src/utils/crypto.ts`: `{ v: 1, iv: string, ct: string }`.
 */
export function isEnvelope(obj: unknown): obj is { v: number; iv: string; ct: string } {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return (
    'v' in o &&
    'iv' in o &&
    'ct' in o &&
    typeof o.iv === 'string' &&
    typeof o.ct === 'string' &&
    o.iv.length > 0 &&
    o.ct.length > 0
  )
}

/**
 * Verify every sensitive key holds an `EncryptedEnvelope`. One assertion per
 * key with the key name in the failure message — when a future regression
 * leaks plaintext, the test report names exactly which key.
 */
export async function assertAllKeysAreEnvelopes(page: Page): Promise<void> {
  for (const key of SENSITIVE_KEYS) {
    const envelope = await readEnvelope(page, key)
    expect(envelope, `${key} should be envelope-encrypted but was missing from localStorage`).not.toBeNull()
    expect(isEnvelope(envelope), `${key} missing v/iv/ct envelope shape (got ${JSON.stringify(envelope)})`).toBe(true)
  }
}

/**
 * Verify every sensitive key holds plaintext content that matches the
 * snapshot. Plaintext = parsed JSON value that is NOT an envelope.
 */
export async function assertAllKeysMatchPlaintextSnapshot(
  page: Page,
  snapshot: Record<SensitiveKey, unknown>,
): Promise<void> {
  for (const key of SENSITIVE_KEYS) {
    const value = await readEnvelope(page, key)
    expect(value, `${key} should be present as plaintext after disable but was missing`).not.toBeNull()
    expect(isEnvelope(value), `${key} should be plaintext after disable but still has envelope shape`).toBe(false)
    expect(value, `${key} plaintext content does not match pre-encrypt snapshot`).toEqual(snapshot[key])
  }
}

/**
 * Simulate another tab dispatching the cross-tab lock signal. The real
 * cross-tab mechanism (src/utils/appStorage.ts) writes
 * `_encryption-lock-signal` to localStorage, which fires a native `storage`
 * event in every OTHER tab. Each receiving tab dispatches the
 * `encryption-remote-lock` CustomEvent in its own window, which the
 * EncryptionContext listens for and clears the in-memory key.
 *
 * In a single-tab test, the writer never receives its own storage event, so
 * calling this in tab A only locks OTHER tabs.
 */
export async function dispatchRemoteLock(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('_encryption-lock-signal', String(Date.now()))
  })
}
