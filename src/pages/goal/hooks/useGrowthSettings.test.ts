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
    })
  })

  it('persists settings to localStorage on update', () => {
    const { result } = renderHook(() => useGrowthSettings())
    act(() => result.current.updateSettings({ preBoundaryGrowth: 10 }))
    expect(result.current.settings.preBoundaryGrowth).toBe(10)
    const stored = JSON.parse(localStorage.getItem('goal-growth-settings')!)
    expect(stored.preBoundaryGrowth).toBe(10)
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
})
