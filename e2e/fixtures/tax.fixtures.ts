import { Page } from '@playwright/test'

/**
 * Seed data helpers for Taxes Page E2E tests.
 *
 * When encryption is disabled (the default in these tests), appStorage reads
 * directly from localStorage. We seed plaintext JSON the same way demoMode.ts
 * does. The Taxes page reads:
 *   - tax-store      → { years: { [year]: { items: TaxChecklistItem[] } } }
 *   - tax-templates  → TaxTemplate[]
 *   - user-profile   → { name, avatarDataUrl, birthday, partner? }
 *   - data-accounts  → Account[]
 *
 * File BLOBS live in IndexedDB (db: finance-tracking-files, store: tax-files).
 * Seed those via seedTaxIndexedDBFiles AFTER navigation.
 */

export const CURRENT_YEAR = new Date().getFullYear()

export type TaxDocOwner = 'primary' | 'partner' | 'joint'
export type ChecklistCategory = 'paystub' | 'account' | 'tax-return' | 'custom'

export interface TaxDocFile {
  id: string
  name: string
  content?: string
  ext: string
  uploadedAt: string
}

export interface TaxChecklistItem {
  id: string
  label: string
  owner: TaxDocOwner
  category: ChecklistCategory
  accountIds: number[]
  files: TaxDocFile[]
}

export interface TaxYear {
  items: TaxChecklistItem[]
}

export interface TaxStore {
  years: Record<number, TaxYear>
}

export interface TaxTemplateItem {
  label: string
  owner: TaxDocOwner
  category: ChecklistCategory
}

export interface TaxTemplate {
  id: string
  name: string
  items: TaxTemplateItem[]
}

export interface ProfileShape {
  name: string
  avatarDataUrl: string
  birthday: string
  partner?: { name: string; avatarDataUrl: string; birthday: string } | null
}

export interface AccountShape {
  id: number
  name: string
  type: string
  owner: TaxDocOwner
  status: 'active' | 'inactive' | 'closed'
  nature: 'asset' | 'liability'
  goalType?: string
  allocation?: string
  institution?: string
  group?: string
}

export interface SeedOptions {
  store?: TaxStore | string | null
  templates?: TaxTemplate[] | null
  profile?: ProfileShape | null
  accounts?: AccountShape[] | null
  darkMode?: boolean
}

let _id = 1
const nextId = () => String(_id++)

export function makeItem(over: Partial<TaxChecklistItem> = {}): TaxChecklistItem {
  return {
    id: over.id ?? nextId(),
    label: over.label ?? 'W-2',
    owner: over.owner ?? 'primary',
    category: over.category ?? 'custom',
    accountIds: over.accountIds ?? [],
    files: over.files ?? [],
  }
}

export function singleProfile(name = 'Alex'): ProfileShape {
  return { name, avatarDataUrl: '', birthday: '1990-05-15' }
}

export function partnerProfile(primary = 'Alex', partner = 'Sam'): ProfileShape {
  return {
    name: primary,
    avatarDataUrl: '',
    birthday: '1990-05-15',
    partner: { name: partner, avatarDataUrl: '', birthday: '1991-07-22' },
  }
}

export function defaultAccounts(): AccountShape[] {
  return [
    {
      id: 1,
      name: 'Vanguard 401k',
      type: 'retirement',
      owner: 'primary',
      status: 'active',
      nature: 'asset',
      institution: 'Vanguard',
    },
    {
      id: 2,
      name: 'Fidelity IRA',
      type: 'retirement',
      owner: 'primary',
      status: 'active',
      nature: 'asset',
      institution: 'Fidelity',
    },
    {
      id: 3,
      name: 'Joint Savings',
      type: 'savings',
      owner: 'joint',
      status: 'active',
      nature: 'asset',
      institution: 'Chase',
    },
  ]
}

/** Tax store with primary + partner + joint items for the current year. */
export function partnerStore(year = CURRENT_YEAR): TaxStore {
  return {
    years: {
      [year]: {
        items: [
          makeItem({ id: 'pri-1', label: 'W-2 (Alex)', owner: 'primary', category: 'paystub' }),
          makeItem({ id: 'par-1', label: 'W-2 (Sam)', owner: 'partner', category: 'paystub' }),
          makeItem({
            id: 'joint-1',
            label: '1099-INT (Joint Savings)',
            owner: 'joint',
            category: 'account',
            accountIds: [3],
          }),
        ],
      },
    },
  }
}

/** Tax store seeded for the current year with three primary items, no partner. */
export function singleOwnerStore(year = CURRENT_YEAR): TaxStore {
  return {
    years: {
      [year]: {
        items: [
          makeItem({ id: 'pri-1', label: 'W-2 (Alex)', owner: 'primary', category: 'paystub' }),
          makeItem({ id: 'pri-2', label: '1099-INT', owner: 'primary', category: 'account' }),
          makeItem({ id: 'pri-3', label: '1099-DIV', owner: 'primary', category: 'account' }),
        ],
      },
    },
  }
}

/** Two-year tax store. */
export function multiYearStore(year = CURRENT_YEAR): TaxStore {
  return {
    years: {
      [year]: {
        items: [makeItem({ id: 'this-1', label: 'W-2 This Year', owner: 'primary', category: 'paystub' })],
      },
      [year - 1]: {
        items: [makeItem({ id: 'last-1', label: 'W-2 Last Year', owner: 'primary', category: 'paystub' })],
      },
    },
  }
}

export const STANDARD_TEMPLATE: TaxTemplate = {
  id: 'tpl-standard',
  name: 'Standard Filing',
  items: [
    { label: 'W-2 (Primary)', owner: 'primary', category: 'paystub' },
    { label: '1099-INT', owner: 'primary', category: 'account' },
    { label: '1099-DIV', owner: 'primary', category: 'account' },
    { label: 'Tax Return (Federal)', owner: 'joint', category: 'tax-return' },
  ],
}

/**
 * Seeds localStorage with tax test data via addInitScript so it persists
 * across reloads and arrives before EncryptionProvider / TaxSyncProvider boot.
 *
 * Pass `store: '<corrupt-string>'` to set raw corrupt JSON. Pass
 * `store: null` to leave the key absent (default).
 */
export async function seedTaxes(page: Page, options: SeedOptions = {}) {
  const { store, templates, profile, accounts, darkMode } = options
  const storeRaw =
    typeof store === 'string' ? store : store === undefined || store === null ? null : JSON.stringify(store)

  await page.addInitScript(
    ({ storeRaw, templates, profile, accounts, darkMode }) => {
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')
      localStorage.setItem('onboarding-dismissed', '1')

      if (storeRaw !== null) localStorage.setItem('tax-store', storeRaw)
      if (templates) localStorage.setItem('tax-templates', JSON.stringify(templates))
      if (profile) localStorage.setItem('user-profile', JSON.stringify(profile))
      if (accounts) localStorage.setItem('data-accounts', JSON.stringify(accounts))
      if (darkMode !== undefined) localStorage.setItem('darkMode', darkMode ? '1' : '0')
    },
    { storeRaw, templates: templates ?? null, profile: profile ?? null, accounts: accounts ?? null, darkMode },
  )
}

/**
 * Reset the IndexedDB tax-files database. Run in beforeEach so file blobs
 * from a previous test never leak into the next.
 */
export async function resetTaxIndexedDB(page: Page) {
  await page.addInitScript(() => {
    try {
      indexedDB.deleteDatabase('finance-tracking-files')
    } catch {
      /* first-load: database does not exist yet, nothing to clean up */
    }
  })
}

/**
 * Seed file content into IndexedDB AFTER navigation. Use this when a test
 * needs pre-existing file blobs whose IDs are referenced by tax-store
 * metadata. Returns once the IDB transaction has committed.
 */
export async function seedTaxIndexedDBFiles(
  page: Page,
  files: Array<{ id: string; content: string }>,
): Promise<void> {
  await page.evaluate(async records => {
    const open = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('finance-tracking-files', 1)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('tax-files')) db.createObjectStore('tax-files', { keyPath: 'id' })
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('tax-files', 'readwrite')
      const store = tx.objectStore('tax-files')
      for (const r of records) store.put(r)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }, files)
}

/** Count IndexedDB tax-files records. Returns 0 if the DB / store is empty. */
export async function countTaxIndexedDBFiles(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    const open = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('finance-tracking-files', 1)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('tax-files')) db.createObjectStore('tax-files', { keyPath: 'id' })
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    const db = await open()
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction('tax-files', 'readonly')
      const req = tx.objectStore('tax-files').count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return count
  })
}

/** Build a Playwright-compatible file payload of a given byte length. */
export function makeFile(name: string, sizeBytes: number, mimeType = 'application/pdf') {
  return { name, mimeType, buffer: Buffer.alloc(sizeBytes, 'a') }
}

/** A small (1 KB) PDF-like blob suitable for normal upload tests. */
export function smallPdf(name = 'doc.pdf') {
  return makeFile(name, 1024)
}

/** Strip random uid suffix variations: test IDs we control are stable. */
export function uniqueLabel(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}
