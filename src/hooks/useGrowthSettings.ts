import { useState, useCallback, useMemo, useEffect } from 'react'

export interface GrowthSettings {
  preBoundaryGrowth: number
  postBoundaryGrowth: number
  ageBoundary: number
  gwGrowth: number
  inflation: number
  retirementCap: number
  nonRetirementBase: number
  primaryRetirementAccessAge: number
  partnerRetirementAccessAge: number
}

export interface FiGrowthOverride {
  preBoundaryGrowth?: number
  postBoundaryGrowth?: number
}

const STORAGE_KEY = 'goal-growth-settings'
const OVERRIDE_PREFIX = 'goal-growth-override-'

const DEFAULTS: GrowthSettings = {
  preBoundaryGrowth: 8,
  postBoundaryGrowth: 6,
  ageBoundary: 60,
  gwGrowth: 8,
  inflation: 3,
  retirementCap: 6000,
  nonRetirementBase: 6000,
  primaryRetirementAccessAge: 59.5,
  partnerRetirementAccessAge: 59.5,
}

const LIMITS: Record<keyof GrowthSettings, readonly [min: number, max: number]> = {
  preBoundaryGrowth: [0, 30],
  postBoundaryGrowth: [0, 30],
  ageBoundary: [40, 80],
  gwGrowth: [0, 30],
  inflation: [0, 15],
  retirementCap: [0, 100000],
  nonRetirementBase: [0, 100000],
  primaryRetirementAccessAge: [40, 80],
  partnerRetirementAccessAge: [40, 80],
}

// Out-of-range numbers are clamped; anything that is not a finite number takes the fallback.
function clamp(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

function sanitizeSettings(input: unknown, fallback: GrowthSettings): GrowthSettings {
  const source = typeof input === 'object' && input !== null && !Array.isArray(input) ? input : {}
  const result = { ...fallback }
  for (const key of Object.keys(LIMITS) as (keyof GrowthSettings)[]) {
    result[key] = clamp((source as Record<string, unknown>)[key], LIMITS[key], fallback[key])
  }
  return result
}

function loadSettings(): GrowthSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return sanitizeSettings(JSON.parse(raw), DEFAULTS)
  } catch {}
  return { ...DEFAULTS }
}

function loadFiOverride(goalId: number): FiGrowthOverride | null {
  try {
    const raw = localStorage.getItem(OVERRIDE_PREFIX + goalId)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export function useGrowthSettings() {
  const [settings, setSettings] = useState<GrowthSettings>(loadSettings)

  // Sync across hook instances in the same tab
  useEffect(() => {
    const handler = () => setSettings(loadSettings())
    window.addEventListener('growth-settings-changed', handler)
    return () => window.removeEventListener('growth-settings-changed', handler)
  }, [])

  const updateSettings = useCallback((partial: Partial<GrowthSettings>) => {
    setSettings(prev => {
      // Invalid values keep the current setting rather than resetting it to a default.
      const next = sanitizeSettings({ ...prev, ...partial }, prev)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      window.dispatchEvent(new Event('growth-settings-changed'))
      return next
    })
  }, [])

  const getFiOverride = useCallback((goalId: number): FiGrowthOverride | null => {
    return loadFiOverride(goalId)
  }, [])

  const setFiOverride = useCallback((goalId: number, override: FiGrowthOverride | null) => {
    const key = OVERRIDE_PREFIX + goalId
    if (!override || (override.preBoundaryGrowth == null && override.postBoundaryGrowth == null)) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(override))
    }
  }, [])

  const getGwOverride = useCallback((gwGoalId: number): number | null => {
    try {
      const raw = localStorage.getItem(`gw-growth-override-${gwGoalId}`)
      if (raw) return JSON.parse(raw)
    } catch {}
    return null
  }, [])

  const setGwOverride = useCallback((gwGoalId: number, rate: number | null) => {
    const key = `gw-growth-override-${gwGoalId}`
    if (rate == null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(rate))
    }
  }, [])

  const getEffectiveFiRates = useCallback(
    (goalId: number) => {
      const override = loadFiOverride(goalId)
      return {
        pre: override?.preBoundaryGrowth ?? settings.preBoundaryGrowth,
        post: override?.postBoundaryGrowth ?? settings.postBoundaryGrowth,
        hasOverride: override != null,
      }
    },
    [settings.preBoundaryGrowth, settings.postBoundaryGrowth],
  )

  const getEffectiveGwRate = useCallback(
    (gwGoalId: number) => {
      const override = getGwOverride(gwGoalId)
      return {
        rate: override ?? settings.gwGrowth,
        hasOverride: override != null,
      }
    },
    [settings.gwGrowth, getGwOverride],
  )

  return useMemo(
    () => ({
      settings,
      updateSettings,
      getFiOverride,
      setFiOverride,
      getGwOverride,
      setGwOverride,
      getEffectiveFiRates,
      getEffectiveGwRate,
    }),
    [
      settings,
      updateSettings,
      getFiOverride,
      setFiOverride,
      getGwOverride,
      setGwOverride,
      getEffectiveFiRates,
      getEffectiveGwRate,
    ],
  )
}
