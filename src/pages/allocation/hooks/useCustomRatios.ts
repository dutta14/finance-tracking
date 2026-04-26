import { useState, useCallback, useEffect, useRef } from 'react'
import { Scope, CustomRatio, RatioPreset, RatioGoal } from '../types'
import { loadCustomRatios, saveCustomRatios, makeDefaultRatio, makeId } from '../utils'

export function useCustomRatios() {
  const [customRatios, setCustomRatios] = useState<CustomRatio[]>(loadCustomRatios)
  const [activeRatioId, setActiveRatioId] = useState<string | null>(() => {
    const saved = loadCustomRatios()
    return saved.length > 0 ? saved[0].id : null
  })
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const createMenuRef = useRef<HTMLDivElement>(null)

  const activeRatio = customRatios.find(r => r.id === activeRatioId) ?? null

  const persist = useCallback((next: CustomRatio[]) => {
    setCustomRatios(next)
    saveCustomRatios(next)
  }, [])

  const updateActiveRatio = useCallback(
    (updater: (r: CustomRatio) => CustomRatio) => {
      if (!activeRatioId) return
      setActivePreset(null)
      setCustomRatios(prev => {
        const next = prev.map(r => (r.id === activeRatioId ? updater(r) : r))
        saveCustomRatios(next)
        return next
      })
    },
    [activeRatioId],
  )

  const createRatio = () => {
    const nr = makeDefaultRatio()
    const next = [...customRatios, nr]
    persist(next)
    setActiveRatioId(nr.id)
    setActivePreset(null)
  }

  const requestDeleteRatio = (id: string) => {
    const ratio = customRatios.find(r => r.id === id)
    const goalCount = ratio?.goals ? Object.keys(ratio.goals).length : 0
    if (goalCount > 0) {
      setConfirmDeleteId(id)
      return
    }
    doDeleteRatio(id)
  }

  const doDeleteRatio = (id: string) => {
    const next = customRatios.filter(r => r.id !== id)
    persist(next)
    if (activeRatioId === id) {
      setActiveRatioId(next.length > 0 ? next[0].id : null)
    }
    setActivePreset(null)
    setConfirmDeleteId(null)
  }

  /* Sync active selection if ratios change externally */
  useEffect(() => {
    if (activeRatioId && !customRatios.find(r => r.id === activeRatioId)) {
      setActiveRatioId(customRatios.length > 0 ? customRatios[0].id : null)
    }
  }, [customRatios, activeRatioId])

  /* Close create menu on outside click */
  useEffect(() => {
    if (!createMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) setCreateMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [createMenuOpen])

  const createFromPreset = (preset: RatioPreset) => {
    const nr: CustomRatio = {
      id: makeId(),
      name: preset.name,
      scope: preset.scope,
      groups: preset.groups.map(g => ({ label: g.label, classes: [...g.classes] })),
    }
    persist([...customRatios, nr])
    setActiveRatioId(nr.id)
    setCreateMenuOpen(false)
  }

  /* ── ratio mutation helpers ──────────────────────────────── */

  const applyPreset = (preset: RatioPreset) => {
    setActivePreset(preset.id)
    updateActiveRatio(r => ({
      ...r,
      scope: preset.scope,
      name: preset.name,
      groups: preset.groups.map(g => ({ label: g.label, classes: [...g.classes] })),
    }))
  }

  const updateGroupLabel = (idx: number, label: string) => {
    updateActiveRatio(r => ({
      ...r,
      groups: r.groups.map((g, i) => (i === idx ? { ...g, label } : g)),
    }))
  }

  const toggleClass = (groupIdx: number, cls: AssetAllocation) => {
    updateActiveRatio(r => {
      const next = r.groups.map((g, i) => {
        if (i === groupIdx) {
          const has = g.classes.includes(cls)
          return { ...g, classes: has ? g.classes.filter(c => c !== cls) : [...g.classes, cls] }
        }
        return g
      })
      const used = new Set(next[groupIdx].classes)
      return {
        ...r,
        groups: next.map((g, i) => (i === groupIdx ? g : { ...g, classes: g.classes.filter(c => !used.has(c)) })),
      }
    })
  }

  const addGroup = () => {
    if (!activeRatio || activeRatio.groups.length >= 6) return
    updateActiveRatio(r => ({
      ...r,
      groups: [...r.groups, { label: `Group ${String.fromCharCode(65 + r.groups.length)}`, classes: [] }],
    }))
  }

  const removeGroup = (idx: number) => {
    if (!activeRatio || activeRatio.groups.length <= 2) return
    updateActiveRatio(r => ({
      ...r,
      groups: r.groups.filter((_, i) => i !== idx),
    }))
  }

  const updateRatioName = (name: string) => {
    updateActiveRatio(r => ({ ...r, name }))
  }

  const updateRatioScope = (s: Scope) => {
    setActivePreset(null)
    updateActiveRatio(r => ({ ...r, scope: s }))
  }

  const setGoalForScope = (scopeKey: Scope, goal: RatioGoal | null) => {
    updateActiveRatio(r => {
      const prev = r.goals ?? {}
      if (goal === null) {
        const { [scopeKey]: _, ...rest } = prev
        return { ...r, goals: rest }
      }
      return { ...r, goals: { ...prev, [scopeKey]: goal } }
    })
  }

  return {
    customRatios,
    activeRatioId,
    setActiveRatioId,
    activePreset,
    setActivePreset,
    activeRatio,
    confirmDeleteId,
    setConfirmDeleteId,
    createMenuOpen,
    setCreateMenuOpen,
    createMenuRef,
    createRatio,
    createFromPreset,
    requestDeleteRatio,
    doDeleteRatio,
    applyPreset,
    updateGroupLabel,
    toggleClass,
    addGroup,
    removeGroup,
    updateRatioName,
    updateRatioScope,
    setGoalForScope,
  }
}
