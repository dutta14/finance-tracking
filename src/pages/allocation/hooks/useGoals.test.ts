import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGoals } from './useGoals'
import type { RatioGoal } from '../types'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-17'))
})

afterEach(() => {
  vi.useRealTimers()
})

function setProfile(profile: object) {
  localStorage.setItem('user-profile', JSON.stringify(profile))
}

describe('useGoals', () => {
  describe('getAge', () => {
    it('returns correct age for primary', () => {
      setProfile({ birthday: '1990-01-15' })
      const { result } = renderHook(() => useGoals())
      // 2026-04-17 minus 1990-01-15 = 36 (birthday already passed in Jan)
      expect(result.current.getAge('primary')).toBe(36)
    })

    it('returns age minus 1 if birthday has not occurred yet this year', () => {
      setProfile({ birthday: '1990-12-25' })
      const { result } = renderHook(() => useGoals())
      // Dec 25 hasn't happened yet on Apr 17 → still 35
      expect(result.current.getAge('primary')).toBe(35)
    })

    it('returns correct age for partner', () => {
      setProfile({ birthday: '1990-01-01', partner: { birthday: '1985-06-15' } })
      const { result } = renderHook(() => useGoals())
      // 2026-04-17 minus 1985-06-15 = 40 (June hasn't happened yet)
      expect(result.current.getAge('partner')).toBe(40)
    })

    it('returns null when no birthday set', () => {
      setProfile({})
      const { result } = renderHook(() => useGoals())
      expect(result.current.getAge('primary')).toBeNull()
    })

    it('returns null when partner has no birthday', () => {
      setProfile({ birthday: '1990-01-01', partner: {} })
      const { result } = renderHook(() => useGoals())
      expect(result.current.getAge('partner')).toBeNull()
    })

    it('returns null for invalid date string', () => {
      setProfile({ birthday: 'not-a-date' })
      const { result } = renderHook(() => useGoals())
      expect(result.current.getAge('primary')).toBeNull()
    })

    it('returns null when no profile stored', () => {
      const { result } = renderHook(() => useGoals())
      expect(result.current.getAge('primary')).toBeNull()
    })
  })

  describe('computeGoalPcts', () => {
    it('returns pcts for constant goal when group count matches', () => {
      setProfile({})
      const { result } = renderHook(() => useGoals())
      const goal: RatioGoal = { type: 'constant', pcts: [60, 40] }
      expect(result.current.computeGoalPcts(goal, 2)).toEqual([60, 40])
    })

    it('returns null for constant goal when group count mismatches', () => {
      setProfile({})
      const { result } = renderHook(() => useGoals())
      const goal: RatioGoal = { type: 'constant', pcts: [60, 40] }
      expect(result.current.computeGoalPcts(goal, 3)).toBeNull()
    })

    it('returns startPcts when age <= startAge', () => {
      // Age = 36, startAge = 40
      setProfile({ birthday: '1990-01-15' })
      const { result } = renderHook(() => useGoals())
      const goal: RatioGoal = {
        type: 'gradual',
        owner: 'primary',
        startAge: 40,
        endAge: 60,
        startPcts: [80, 20],
        endPcts: [40, 60],
      }
      expect(result.current.computeGoalPcts(goal, 2)).toEqual([80, 20])
    })

    it('returns endPcts when age >= endAge', () => {
      // Age = 36, endAge = 30
      setProfile({ birthday: '1990-01-15' })
      const { result } = renderHook(() => useGoals())
      const goal: RatioGoal = {
        type: 'gradual',
        owner: 'primary',
        startAge: 20,
        endAge: 30,
        startPcts: [80, 20],
        endPcts: [40, 60],
      }
      expect(result.current.computeGoalPcts(goal, 2)).toEqual([40, 60])
    })

    it('interpolates pcts when age is between start and end', () => {
      // Age = 36, startAge = 30, endAge = 50 → progress = 6/20 = 0.3
      setProfile({ birthday: '1990-01-15' })
      const { result } = renderHook(() => useGoals())
      const goal: RatioGoal = {
        type: 'gradual',
        owner: 'primary',
        startAge: 30,
        endAge: 50,
        startPcts: [80, 20],
        endPcts: [40, 60],
      }
      const pcts = result.current.computeGoalPcts(goal, 2)
      // 80 + (40-80)*0.3 = 80 - 12 = 68
      // 20 + (60-20)*0.3 = 20 + 12 = 32
      expect(pcts).toEqual([68, 32])
    })

    it('returns null when age is unavailable for gradual goal', () => {
      setProfile({}) // no birthday
      const { result } = renderHook(() => useGoals())
      const goal: RatioGoal = {
        type: 'gradual',
        owner: 'primary',
        startAge: 30,
        endAge: 50,
        startPcts: [80, 20],
        endPcts: [40, 60],
      }
      expect(result.current.computeGoalPcts(goal, 2)).toBeNull()
    })

    it('returns null when numGroups mismatches gradual pcts length', () => {
      setProfile({ birthday: '1990-01-15' })
      const { result } = renderHook(() => useGoals())
      const goal: RatioGoal = {
        type: 'gradual',
        owner: 'primary',
        startAge: 30,
        endAge: 50,
        startPcts: [80, 20],
        endPcts: [40, 60],
      }
      expect(result.current.computeGoalPcts(goal, 3)).toBeNull()
    })
  })
})
