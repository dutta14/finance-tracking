export type TaxDocOwner = 'primary' | 'partner' | 'joint'

export type ChecklistCategory = 'paystub' | 'account' | 'tax-return' | 'custom'

export interface TaxDocFile {
  id: string
  name: string
  /** base64 data URL — undefined when content has been migrated to IndexedDB */
  content: string | undefined
  ext: string
  uploadedAt: string
}

export interface TaxChecklistItem {
  id: string
  label: string
  owner: TaxDocOwner
  category: ChecklistCategory
  accountIds: number[] // linked Data-page account IDs
  files: TaxDocFile[]
}

export interface TaxYear {
  items: TaxChecklistItem[]
}

export interface TaxStore {
  years: Record<number, TaxYear>
}

export const EMPTY_STORE: TaxStore = { years: {} }

export const getEmptyYear = (): TaxYear => ({ items: [] })

/* ── Templates ──────────────────────────────────────────────── */
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

const TEMPLATES_KEY = 'tax-templates'

export function loadTemplates(): TaxTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]')
  } catch { return [] }
}

export function saveTemplates(templates: TaxTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}
