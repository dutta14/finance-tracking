import { Page, expect } from '@playwright/test'

/**
 * Encryption E2E fixtures.
 *
 * The 13 SENSITIVE_KEYS list is the single source of truth for envelope-shape
 * verification and roundtrip tests. It must stay in sync with
 * src/utils/encryptedStorage.ts.
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
 * Returns the snapshot so tests can use it for roundtrip verification.
 */
export async function seedAllSensitiveKeys(
  page: Page,
  content: Record<SensitiveKey, unknown> = defaultPlaintextContent(),
): Promise<Record<SensitiveKey, unknown>> {
  const serialized: Record<string, string> = {}
  for (const key of SENSITIVE_KEYS) {
    serialized[key] = JSON.stringify(content[key])
  }

  await page.addInitScript(payload => {
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '0')
    localStorage.setItem('onboarding-dismissed', '1')
    for (const [k, v] of Object.entries(payload)) {
      localStorage.setItem(k, v)
    }
  }, serialized)

  return content
}

/**
 * Bare seed: clears localStorage and disables onboarding, with no sensitive
 * keys present. Use for lifecycle tests that don't care about data content.
 */
export async function seedEmptyEncryptionState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '0')
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
