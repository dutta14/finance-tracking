import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDateFilter } from './useDateFilter'

afterEach(() => {
  vi.useRealTimers()
})

describe('useDateFilter', () => {
  const months = ['2024-12', '2024-01', '2025-01', '2025-02', '2025-12', '2026-01', '2026-02']

  it('returns sorted months, distinct years, and month options by default', () => {
    const { result } = renderHook(() => useDateFilter(months))

    expect(result.current.dateFilter).toBe('all')
    expect(result.current.filteredMonths).toEqual([
      '2024-01',
      '2024-12',
      '2025-01',
      '2025-02',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
    expect(result.current.availableYears).toEqual(['2024', '2025', '2026'])
    expect(result.current.monthOptions[0]).toEqual({ val: '01', label: 'Jan' })
    expect(result.current.monthOptions[11]).toEqual({ val: '12', label: 'Dec' })
  })

  it('filters for ytd, last-12, and year-end views', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-15T12:00:00.000Z'))

    const { result } = renderHook(() => useDateFilter(months))

    act(() => result.current.setDateFilter('ytd'))
    expect(result.current.filteredMonths).toEqual(['2026-01', '2026-02'])

    act(() => result.current.setDateFilter('last-12'))
    expect(result.current.filteredMonths).toEqual([
      '2024-01',
      '2024-12',
      '2025-01',
      '2025-02',
      '2025-12',
      '2026-01',
      '2026-02',
    ])

    act(() => result.current.setDateFilter('eoy'))
    expect(result.current.filteredMonths).toEqual(['2024-12', '2025-12'])
  })

  it('supports custom ranges and month-part updates', () => {
    const { result } = renderHook(() => useDateFilter(months, 'custom'))

    act(() => result.current.setCustomMonth('from', 'year', '2025'))
    act(() => result.current.setCustomMonth('from', 'month', '02'))
    act(() => result.current.setCustomMonth('to', 'year', '2026'))
    act(() => result.current.setCustomMonth('to', 'month', '01'))

    expect(result.current.customFrom).toBe('2025-02')
    expect(result.current.customTo).toBe('2026-01')
    expect(result.current.filteredMonths).toEqual(['2025-02', '2025-12', '2026-01'])

    act(() => {
      result.current.setCustomFrom('')
      result.current.setCustomTo('2025-01')
    })

    expect(result.current.filteredMonths).toEqual(['2024-01', '2024-12', '2025-01'])
  })
})
