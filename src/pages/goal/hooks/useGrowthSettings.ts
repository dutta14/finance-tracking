import { useState, useCallback, useMemo } from 'react'

export interface GrowthSettings {
  preBoundaryGrowth: number
  postBoundaryGrowth: number
  ageBoundary: number
  gwGrowth: number
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
}

function loadSettings(): GrowthSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
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

  const updateSettings = useCallback((partial: Partial<GrowthSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
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
