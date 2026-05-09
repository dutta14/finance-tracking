/**
 * Import Validator — validates and sanitizes imported JSON payloads
 * before they are applied to app state or localStorage.
 *
 * Used by both the file-import flow (ImportExportContext) and the
 * GitHub restore flow (GitHubSyncContext).
 */

import type { FinancialGoal, GwGoal } from '../types'
import type { Profile } from '../hooks/useProfile'
import type { Account, BalanceEntry } from '../pages/data/types'
import type { CategoryGroup } from '../pages/budget/types'
import type { TaxTemplate } from '../pages/taxes/types'

// ── Constants ──────────────────────────────────────────────────

const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024 // 50 MB
const MAX_STRING_LENGTH = 100
const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB data-url

const ALLOWED_ACCENT_THEMES = ['blue', 'teal', 'purple', 'orange', 'green', 'rose', 'slate'] as const
const ALLOWED_GOAL_VIEW_MODES = ['grid', 'list', ''] as const

// ── Result types ───────────────────────────────────────────────

export interface ImportValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  sanitized?: ImportPayload
}

export interface ImportSettings {
  accentTheme?: string
  darkMode?: boolean
  allowCsvImport?: boolean
  goalViewMode?: string
  homeCardOrder?: string
}

export interface ImportPayload {
  version?: number
  goals: FinancialGoal[]
  gwGoals?: GwGoal[]
  profile?: Partial<Profile>
  settings?: ImportSettings
  dataAccounts?: Account[]
  dataBalances?: BalanceEntry[]
  budgetCsvs?: Record<string, unknown>
  budgetConfig?: { years: number[]; categoryGroups: CategoryGroup[] }
  fiSimulations?: unknown[]
  sgtOverrides?: Record<string, unknown>
  allocationCustomRatios?: unknown[]
  taxStore?: Record<string, unknown>
  taxTemplates?: TaxTemplate[]
  gitHubConfig?: Record<string, unknown>
}

// ── Helpers ────────────────────────────────────────────────────

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

function sanitizeString(input: unknown, maxLen: number = MAX_STRING_LENGTH): string {
  if (typeof input !== 'string') return ''
  return stripHtml(input).slice(0, maxLen)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// ── Per-field validators ───────────────────────────────────────

function validateGoal(g: unknown, index: number, warnings: string[]): FinancialGoal | null {
  if (!isRecord(g)) {
    warnings.push(`goals[${index}]: not an object — skipped`)
    return null
  }
  if (typeof g.id !== 'number') {
    warnings.push(`goals[${index}]: missing or invalid "id" (must be number) — skipped`)
    return null
  }
  if (typeof g.goalName !== 'string' || g.goalName.trim() === '') {
    warnings.push(`goals[${index}]: missing or empty "goalName" — skipped`)
    return null
  }
  return g as FinancialGoal
}

function validateGwGoal(g: unknown, index: number, warnings: string[]): GwGoal | null {
  if (!isRecord(g)) {
    warnings.push(`gwGoals[${index}]: not an object — skipped`)
    return null
  }
  if (typeof g.id !== 'number') {
    warnings.push(`gwGoals[${index}]: missing or invalid "id" — skipped`)
    return null
  }
  if (typeof g.fiGoalId !== 'number') {
    warnings.push(`gwGoals[${index}]: missing or invalid "fiGoalId" — skipped`)
    return null
  }
  if (typeof g.label !== 'string' || g.label.trim() === '') {
    warnings.push(`gwGoals[${index}]: missing or empty "label" — skipped`)
    return null
  }
  return g as GwGoal
}

function validateAccount(a: unknown, index: number, warnings: string[]): Account | null {
  if (!isRecord(a)) {
    warnings.push(`dataAccounts[${index}]: not an object — skipped`)
    return null
  }
  if (typeof a.id !== 'number') {
    warnings.push(`dataAccounts[${index}]: missing or invalid "id" — skipped`)
    return null
  }
  if (typeof a.name !== 'string' || a.name.trim() === '') {
    warnings.push(`dataAccounts[${index}]: missing or empty "name" — skipped`)
    return null
  }
  return a as Account
}

function validateBalance(b: unknown, index: number, warnings: string[]): BalanceEntry | null {
  if (!isRecord(b)) {
    warnings.push(`dataBalances[${index}]: not an object — skipped`)
    return null
  }
  if (typeof b.id !== 'number') {
    warnings.push(`dataBalances[${index}]: missing or invalid "id" — skipped`)
    return null
  }
  if (typeof b.accountId !== 'number') {
    warnings.push(`dataBalances[${index}]: missing or invalid "accountId" — skipped`)
    return null
  }
  if (typeof b.month !== 'string' || !/^\d{4}-\d{2}$/.test(b.month)) {
    warnings.push(`dataBalances[${index}]: invalid "month" (expected YYYY-MM) — skipped`)
    return null
  }
  if (typeof b.balance !== 'number') {
    warnings.push(`dataBalances[${index}]: missing or invalid "balance" — skipped`)
    return null
  }
  return b as BalanceEntry
}

function sanitizeProfile(raw: unknown, warnings: string[]): Partial<Profile> | undefined {
  if (!isRecord(raw)) return undefined

  const sanitized: Partial<Profile> = {}

  if ('name' in raw) {
    const cleaned = sanitizeString(raw.name)
    if (cleaned !== raw.name) warnings.push('profile.name: HTML tags stripped or truncated')
    sanitized.name = cleaned
  }

  if ('birthday' in raw && typeof raw.birthday === 'string') {
    sanitized.birthday = sanitizeString(raw.birthday)
  }

  if ('avatarDataUrl' in raw && typeof raw.avatarDataUrl === 'string') {
    if (raw.avatarDataUrl.length > MAX_AVATAR_BYTES) {
      warnings.push('profile.avatarDataUrl: exceeds 2 MB, dropped')
    } else {
      sanitized.avatarDataUrl = raw.avatarDataUrl
    }
  }

  if ('partner' in raw) {
    if (raw.partner === null) {
      sanitized.partner = null
    } else if (isRecord(raw.partner)) {
      const partner: Profile['partner'] = {
        name: sanitizeString(raw.partner.name),
        birthday: sanitizeString(raw.partner.birthday),
        avatarDataUrl: '',
      }
      if (typeof raw.partner.name === 'string' && partner.name !== raw.partner.name) {
        warnings.push('profile.partner.name: HTML tags stripped or truncated')
      }
      if (typeof raw.partner.avatarDataUrl === 'string') {
        if (raw.partner.avatarDataUrl.length > MAX_AVATAR_BYTES) {
          warnings.push('profile.partner.avatarDataUrl: exceeds 2 MB, dropped')
        } else {
          partner.avatarDataUrl = raw.partner.avatarDataUrl
        }
      }
      sanitized.partner = partner
    }
  }

  return sanitized
}

function sanitizeSettings(raw: unknown, errors: string[], warnings: string[]): ImportSettings | undefined {
  if (!isRecord(raw)) return undefined

  const settings: ImportSettings = {}

  // accentTheme — whitelist only
  const theme = raw.accentTheme ?? raw.fiTheme
  if (theme !== undefined) {
    if (typeof theme === 'string' && (ALLOWED_ACCENT_THEMES as readonly string[]).includes(theme)) {
      settings.accentTheme = theme
    } else {
      errors.push(
        `settings.accentTheme: "${String(theme)}" is not an allowed theme (${ALLOWED_ACCENT_THEMES.join(', ')})`,
      )
    }
  }

  // goalViewMode — whitelist only
  if (raw.goalViewMode !== undefined) {
    if (
      typeof raw.goalViewMode === 'string' &&
      (ALLOWED_GOAL_VIEW_MODES as readonly string[]).includes(raw.goalViewMode)
    ) {
      settings.goalViewMode = raw.goalViewMode
    } else {
      warnings.push(`settings.goalViewMode: "${String(raw.goalViewMode)}" ignored, not a valid mode`)
    }
  }

  // homeCardOrder — plain string, sanitize
  if (raw.homeCardOrder !== undefined) {
    if (typeof raw.homeCardOrder === 'string') {
      settings.homeCardOrder = sanitizeString(raw.homeCardOrder, 500)
    }
  }

  // Boolean flags
  if (raw.darkMode !== undefined) settings.darkMode = !!raw.darkMode
  if (raw.allowCsvImport !== undefined) settings.allowCsvImport = !!raw.allowCsvImport

  return settings
}

function validateTaxTemplate(t: unknown, index: number, warnings: string[]): TaxTemplate | null {
  if (!isRecord(t)) {
    warnings.push(`taxTemplates[${index}]: not an object — skipped`)
    return null
  }
  if (typeof t.id !== 'string') {
    warnings.push(`taxTemplates[${index}]: missing or invalid "id" — skipped`)
    return null
  }
  if (typeof t.name !== 'string') {
    warnings.push(`taxTemplates[${index}]: missing or invalid "name" — skipped`)
    return null
  }
  if (!Array.isArray(t.items)) {
    warnings.push(`taxTemplates[${index}]: missing or invalid "items" array — skipped`)
    return null
  }
  return t as TaxTemplate
}

// ── Main validator ─────────────────────────────────────────────

export function validateImportPayload(raw: unknown, rawJsonLength?: number): ImportValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Size check
  if (rawJsonLength !== undefined && rawJsonLength > MAX_PAYLOAD_BYTES) {
    return {
      valid: false,
      errors: [`Payload size ${(rawJsonLength / 1024 / 1024).toFixed(1)} MB exceeds 50 MB limit`],
      warnings,
    }
  }

  // Must be an object (or legacy array format)
  if (raw === null || typeof raw !== 'object') {
    return { valid: false, errors: ['Import data is not a valid JSON object'], warnings }
  }

  const parsed = raw as Record<string, unknown>
  const sanitized: ImportPayload = { goals: [] }

  // Version
  if (parsed.version !== undefined) {
    if (typeof parsed.version === 'number') {
      sanitized.version = parsed.version
    } else {
      warnings.push('version: ignored (not a number)')
    }
  }

  // Goals — required (accept legacy formats)
  const goalsSource = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.goals)
      ? parsed.goals
      : Array.isArray(parsed.plans)
        ? parsed.plans
        : null

  if (!Array.isArray(goalsSource)) {
    errors.push('Missing required "goals" array')
  } else {
    const validGoals: FinancialGoal[] = []
    for (let i = 0; i < goalsSource.length; i++) {
      const g = validateGoal(goalsSource[i], i, warnings)
      if (g) validGoals.push(g)
    }
    if (validGoals.length === 0 && goalsSource.length > 0) {
      errors.push('No valid goals found in goals array')
    }
    sanitized.goals = validGoals
  }

  // GwGoals
  const gwSource = parsed.gwGoals ?? parsed.gwPlans
  if (gwSource !== undefined) {
    if (Array.isArray(gwSource)) {
      const validGw: GwGoal[] = []
      for (let i = 0; i < gwSource.length; i++) {
        const g = validateGwGoal(gwSource[i], i, warnings)
        if (g) validGw.push(g)
      }
      sanitized.gwGoals = validGw
    } else {
      warnings.push('gwGoals: ignored (not an array)')
    }
  }

  // Profile
  if (parsed.profile !== undefined) {
    if (isRecord(parsed.profile)) {
      sanitized.profile = sanitizeProfile(parsed.profile, warnings)
    } else {
      warnings.push('profile: ignored (not an object)')
    }
  }

  // Settings
  if (parsed.settings !== undefined) {
    sanitized.settings = sanitizeSettings(parsed.settings, errors, warnings)
  }

  // Accounts
  if (parsed.dataAccounts !== undefined) {
    if (Array.isArray(parsed.dataAccounts)) {
      const valid: Account[] = []
      for (let i = 0; i < parsed.dataAccounts.length; i++) {
        const a = validateAccount(parsed.dataAccounts[i], i, warnings)
        if (a) valid.push(a)
      }
      sanitized.dataAccounts = valid
    } else {
      warnings.push('dataAccounts: ignored (not an array)')
    }
  }

  // Balances
  if (parsed.dataBalances !== undefined) {
    if (Array.isArray(parsed.dataBalances)) {
      const valid: BalanceEntry[] = []
      for (let i = 0; i < parsed.dataBalances.length; i++) {
        const b = validateBalance(parsed.dataBalances[i], i, warnings)
        if (b) valid.push(b)
      }
      sanitized.dataBalances = valid
    } else {
      warnings.push('dataBalances: ignored (not an array)')
    }
  }

  // Budget CSVs — object of MonthCSV records
  if (parsed.budgetCsvs !== undefined) {
    if (isRecord(parsed.budgetCsvs)) {
      sanitized.budgetCsvs = parsed.budgetCsvs
    } else {
      warnings.push('budgetCsvs: ignored (not an object)')
    }
  }

  // Budget Config
  if (parsed.budgetConfig !== undefined) {
    if (isRecord(parsed.budgetConfig)) {
      sanitized.budgetConfig = parsed.budgetConfig as ImportPayload['budgetConfig']
    } else {
      warnings.push('budgetConfig: ignored (not an object)')
    }
  }

  // FI Simulations
  if (parsed.fiSimulations !== undefined) {
    if (Array.isArray(parsed.fiSimulations)) {
      sanitized.fiSimulations = parsed.fiSimulations
    } else {
      warnings.push('fiSimulations: ignored (not an array)')
    }
  }

  // SGT Overrides
  if (parsed.sgtOverrides !== undefined) {
    if (isRecord(parsed.sgtOverrides)) {
      sanitized.sgtOverrides = parsed.sgtOverrides as Record<string, unknown>
    } else {
      warnings.push('sgtOverrides: ignored (not an object)')
    }
  }

  // Allocation custom ratios
  if (parsed.allocationCustomRatios !== undefined) {
    if (Array.isArray(parsed.allocationCustomRatios)) {
      sanitized.allocationCustomRatios = parsed.allocationCustomRatios
    } else {
      warnings.push('allocationCustomRatios: ignored (not an array)')
    }
  }

  // Tax Store
  if (parsed.taxStore !== undefined) {
    if (isRecord(parsed.taxStore)) {
      sanitized.taxStore = parsed.taxStore as Record<string, unknown>
    } else {
      warnings.push('taxStore: ignored (not an object)')
    }
  }

  // Tax Templates
  if (parsed.taxTemplates !== undefined) {
    if (Array.isArray(parsed.taxTemplates)) {
      const valid: TaxTemplate[] = []
      for (let i = 0; i < parsed.taxTemplates.length; i++) {
        const t = validateTaxTemplate(parsed.taxTemplates[i], i, warnings)
        if (t) valid.push(t)
      }
      sanitized.taxTemplates = valid
    } else {
      warnings.push('taxTemplates: ignored (not an array)')
    }
  }

  // GitHub config — pass through (shape validated by caller)
  if (parsed.gitHubConfig !== undefined) {
    if (isRecord(parsed.gitHubConfig)) {
      sanitized.gitHubConfig = parsed.gitHubConfig as Record<string, unknown>
    } else {
      warnings.push('gitHubConfig: ignored (not an object)')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized: errors.length === 0 ? sanitized : undefined,
  }
}

export { ALLOWED_ACCENT_THEMES, ALLOWED_GOAL_VIEW_MODES }
