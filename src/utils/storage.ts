/**
 * storage.ts — Typed localStorage access with schema validation.
 *
 * Provides `getStorageItem()` / `setStorageItem()` for non-sensitive keys
 * with type safety, validation, and safe fallbacks.
 *
 * Sensitive keys (the 13 SENSITIVE_KEYS) continue to flow through
 * appStorage.ts which handles encryption and in-memory caching.
 * This module is for the non-sensitive keys that live in plain localStorage.
 *
 * A `storage-schema-version` key is written on first load for future
 * migration support.
 */

import type { GitHubSyncConfig } from '../hooks/useGitHubSync'

// ── Schema version ────────────────────────────────────────────

const SCHEMA_VERSION_KEY = 'storage-schema-version'
const CURRENT_SCHEMA_VERSION = 1

/**
 * Ensure the schema version key is present.
 * Call once at app startup (e.g. in main.tsx).
 */
export function initStorageSchema(): void {
  const stored = localStorage.getItem(SCHEMA_VERSION_KEY)
  const version = stored ? Number(stored) : 0

  if (version < CURRENT_SCHEMA_VERSION) {
    // Future: run migrations here based on `version`
    localStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION))
  }
}

// ── Storage schema (non-sensitive keys only) ──────────────────

interface StorageSchema {
  darkMode: string // '0' | '1'
  accentTheme: string
  fiTheme: string // legacy, migrates to accentTheme
  allowCsvImport: string // '0' | '1'
  'goal-view-mode': string // 'grid' | 'list'
  'home-card-order': number[]
  'onboarding-dismissed': string // '0' | '1'
  'github-sync-config': GitHubSyncConfig
  'lab-pdf-to-csv': string // '0' | '1'
  'flag-client-id': string
  'flag-overrides': Record<string, unknown>
  'flag-rollout-cache': { config: unknown; fetchedAt: number } | null
}

// ── Validators ────────────────────────────────────────────────

type Validator = (val: unknown) => boolean

function isStringOneOf(...values: string[]): Validator {
  return (v: unknown) => typeof v === 'string' && values.includes(v)
}

function isNonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.length > 0
}

function isCardOrder(v: unknown): boolean {
  return Array.isArray(v) && v.length === 4 && v.every((n: unknown) => typeof n === 'number' && n >= 0 && n <= 3)
}

function isGitHubSyncConfig(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj.owner === 'string' &&
    typeof obj.repo === 'string' &&
    typeof obj.filePath === 'string' &&
    typeof obj.autoSync === 'boolean'
  )
}

function isRecord(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isFlagCache(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return 'config' in obj && typeof obj.fetchedAt === 'number'
}

const validators: Partial<Record<keyof StorageSchema, Validator>> = {
  darkMode: isStringOneOf('0', '1'),
  allowCsvImport: isStringOneOf('0', '1'),
  'onboarding-dismissed': isStringOneOf('0', '1'),
  'lab-pdf-to-csv': isStringOneOf('0', '1'),
  'goal-view-mode': isStringOneOf('grid', 'list'),
  accentTheme: isNonEmptyString,
  fiTheme: isNonEmptyString,
  'home-card-order': isCardOrder,
  'github-sync-config': isGitHubSyncConfig,
  'flag-client-id': isNonEmptyString,
  'flag-overrides': isRecord,
  'flag-rollout-cache': isFlagCache,
}

// ── Which keys store JSON vs raw strings ──────────────────────

type JsonKey = 'home-card-order' | 'github-sync-config' | 'flag-overrides' | 'flag-rollout-cache'

const JSON_KEYS = new Set<string>(['home-card-order', 'github-sync-config', 'flag-overrides', 'flag-rollout-cache'])

function isJsonKey(key: string): key is JsonKey {
  return JSON_KEYS.has(key)
}

// ── Public API ────────────────────────────────────────────────

/**
 * Read a non-sensitive key from localStorage with type safety and validation.
 * Returns `fallback` if the key is missing, corrupt, or fails validation.
 */
export function getStorageItem<K extends keyof StorageSchema>(key: K, fallback: StorageSchema[K]): StorageSchema[K] {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback

    let parsed: unknown
    if (isJsonKey(key)) {
      parsed = JSON.parse(raw)
    } else {
      parsed = raw
    }

    const validate = validators[key]
    if (validate && !validate(parsed)) {
      console.warn(`[storage] Invalid data for key "${key}", using fallback`)
      return fallback
    }

    return parsed as StorageSchema[K]
  } catch {
    console.warn(`[storage] Failed to parse key "${key}", using fallback`)
    return fallback
  }
}

/**
 * Write a non-sensitive key to localStorage.
 * JSON keys are serialized; string keys are written directly.
 */
export function setStorageItem<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
  if (isJsonKey(key)) {
    localStorage.setItem(key, JSON.stringify(value))
  } else {
    localStorage.setItem(key, value as string)
  }
}

/**
 * Remove a non-sensitive key from localStorage.
 */
export function removeStorageItem<K extends keyof StorageSchema>(key: K): void {
  localStorage.removeItem(key)
}
