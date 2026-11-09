import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, it, expect } from 'vitest'
import { useGrowthSettings } from './useGrowthSettings'

describe('useGrowthSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing is stored', () => {
    const { result } = renderHook(() => useGrowthSettings())
    expect(result.current.settings).toEqual({
      preBoundaryGrowth: 8,
      postBoundaryGrowth: 6,
      ageBoundary: 60,
      gwGrowth: 8,
      inflation: 3,
      retirementCap: 6000,
      nonRetirementBase: 6000,
      primaryRetirementAccessAge: 59.5,
      partnerRetirementAccessAge: 59.5,
    })
  })

  it('persists settings to localStorage on update', () => {
    const { result } = renderHook(() => useGrowthSettings())
    act(() => result.current.updateSettings({ preBoundaryGrowth: 10 }))
    expect(result.current.settings.preBoundaryGrowth).toBe(10)
    const stored = JSON.parse(localStorage.getItem('goal-growth-settings')!)
    expect(stored.preBoundaryGrowth).toBe(10)
  })

  it('persists inflation retirement cap and non-retirement minimum when global settings are updated', () => {
    const { result } = renderHook(() => useGrowthSettings())

    act(() => result.current.updateSettings({ inflation: 5, retirementCap: 8000, nonRetirementBase: 4000 }))

    expect(result.current.settings).toMatchObject({
      inflation: 5,
      retirementCap: 8000,
      nonRetirementBase: 4000,
    })

    const stored = JSON.parse(localStorage.getItem('goal-growth-settings')!)
    expect(stored).toMatchObject({
      inflation: 5,
      retirementCap: 8000,
      nonRetirementBase: 4000,
    })
  })

  it('loads persisted settings on mount', () => {
    localStorage.setItem(
      'goal-growth-settings',
      JSON.stringify({ preBoundaryGrowth: 12, postBoundaryGrowth: 5, ageBoundary: 55, gwGrowth: 7 }),
    )
    const { result } = renderHook(() => useGrowthSettings())
    expect(result.current.settings).toEqual({
      preBoundaryGrowth: 12,
      postBoundaryGrowth: 5,
      ageBoundary: 55,
      gwGrowth: 7,
      inflation: 3,
      retirementCap: 6000,
      nonRetirementBase: 6000,
      primaryRetirementAccessAge: 59.5,
      partnerRetirementAccessAge: 59.5,
    })
  })

  it('getEffectiveFiRates returns global values when no override', () => {
    const { result } = renderHook(() => useGrowthSettings())
    const rates = result.current.getEffectiveFiRates(123)
    expect(rates).toEqual({ pre: 8, post: 6, hasOverride: false })
  })

  it('getEffectiveFiRates returns override values when set', () => {
    const { result } = renderHook(() => useGrowthSettings())
    act(() => result.current.setFiOverride(42, { preBoundaryGrowth: 10 }))
    const rates = result.current.getEffectiveFiRates(42)
    expect(rates.pre).toBe(10)
    expect(rates.post).toBe(6)
    expect(rates.hasOverride).toBe(true)
  })

  it('setFiOverride with null removes the override', () => {
    const { result } = renderHook(() => useGrowthSettings())
    act(() => result.current.setFiOverride(42, { preBoundaryGrowth: 10 }))
    act(() => result.current.setFiOverride(42, null))
    const rates = result.current.getEffectiveFiRates(42)
    expect(rates.hasOverride).toBe(false)
  })

  it('getEffectiveGwRate returns global GW rate when no override', () => {
    const { result } = renderHook(() => useGrowthSettings())
    const { rate, hasOverride } = result.current.getEffectiveGwRate(99)
    expect(rate).toBe(8)
    expect(hasOverride).toBe(false)
  })

  it('getEffectiveGwRate returns override when set', () => {
    const { result } = renderHook(() => useGrowthSettings())
    act(() => result.current.setGwOverride(99, 5))
    const { rate, hasOverride } = result.current.getEffectiveGwRate(99)
    expect(rate).toBe(5)
    expect(hasOverride).toBe(true)
  })

  describe('validation', () => {
    const DEFAULT_INFLATION = 3

    const loadWith = (stored: unknown) => {
      localStorage.setItem('goal-growth-settings', JSON.stringify(stored))
      return renderHook(() => useGrowthSettings()).result.current.settings
    }

    it.each([
      ['null', null],
      ['a numeric string', '5'],
      ['a non-numeric string', 'abc'],
      ['an object', {}],
      ['a boolean', true],
    ])('falls back to the default when a stored value is %s', (_label, value) => {
      expect(loadWith({ inflation: value }).inflation).toBe(DEFAULT_INFLATION)
    })

    it('falls back to the default when a stored field is missing', () => {
      expect(loadWith({ gwGrowth: 7 }).inflation).toBe(DEFAULT_INFLATION)
    })

    it('clamps negative and oversized stored values into range', () => {
      const settings = loadWith({
        preBoundaryGrowth: -5,
        postBoundaryGrowth: 500,
        ageBoundary: 10,
        inflation: 99,
        retirementCap: 1e12,
        nonRetirementBase: -1,
        primaryRetirementAccessAge: 120,
        partnerRetirementAccessAge: 0,
      })
      expect(settings).toMatchObject({
        preBoundaryGrowth: 0,
        postBoundaryGrowth: 30,
        ageBoundary: 40,
        inflation: 15,
        retirementCap: 100000,
        nonRetirementBase: 0,
        primaryRetirementAccessAge: 80,
        partnerRetirementAccessAge: 40,
      })
    })

    it('keeps valid stored values unchanged', () => {
      expect(loadWith({ inflation: 4.5, primaryRetirementAccessAge: 62 })).toMatchObject({
        inflation: 4.5,
        primaryRetirementAccessAge: 62,
      })
    })

    it.each([
      ['an array', [1, 2, 3]],
      ['a number', 42],
      ['null', null],
    ])('returns all defaults when the stored value is %s', (_label, stored) => {
      expect(loadWith(stored).inflation).toBe(DEFAULT_INFLATION)
    })

    it('returns defaults when the stored value is not valid JSON', () => {
      localStorage.setItem('goal-growth-settings', '{not json')
      const { result } = renderHook(() => useGrowthSettings())
      expect(result.current.settings.inflation).toBe(DEFAULT_INFLATION)
    })

    it.each([
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['-Infinity', -Infinity],
    ])('keeps the current value when an update passes %s', (_label, value) => {
      const { result } = renderHook(() => useGrowthSettings())
      act(() => result.current.updateSettings({ inflation: 5 }))
      act(() => result.current.updateSettings({ inflation: value }))
      expect(result.current.settings.inflation).toBe(5)
      expect(JSON.parse(localStorage.getItem('goal-growth-settings')!).inflation).toBe(5)
    })

    it('clamps out-of-range updates before persisting them', () => {
      const { result } = renderHook(() => useGrowthSettings())
      act(() => result.current.updateSettings({ preBoundaryGrowth: 1000, ageBoundary: -3 }))
      expect(result.current.settings).toMatchObject({ preBoundaryGrowth: 30, ageBoundary: 40 })
      const stored = JSON.parse(localStorage.getItem('goal-growth-settings')!)
      expect(stored).toMatchObject({ preBoundaryGrowth: 30, ageBoundary: 40 })
    })
  })
})
