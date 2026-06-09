import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useYearMonthlySaving } from './useYearMonthlySaving'
import { loadBudgetStore, getGlobalCategoryGroups } from '../../budget/utils/budgetStorage'
import { parseCSV } from '../../budget/utils/csvParser'

vi.mock('../../budget/utils/budgetStorage', () => ({
  loadBudgetStore: vi.fn(),
  getGlobalCategoryGroups: vi.fn(),
}))

vi.mock('../../budget/utils/csvParser', () => ({
  parseCSV: vi.fn(),
  buildMonthKey: vi.fn((year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`),
}))

describe('useYearMonthlySaving', () => {
  const mockedLoadBudgetStore = vi.mocked(loadBudgetStore)
  const mockedGetGlobalCategoryGroups = vi.mocked(getGlobalCategoryGroups)
  const mockedParseCSV = vi.mocked(parseCSV)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 1))

    mockedLoadBudgetStore.mockReset()
    mockedGetGlobalCategoryGroups.mockReset()
    mockedParseCSV.mockReset()

    mockedGetGlobalCategoryGroups.mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when no months have csv data', () => {
    mockedLoadBudgetStore.mockReturnValue({
      years: [2023, 2024, 2026],
      csvs: {},
      configs: {},
      categoryGroups: [],
    })

    const { result } = renderHook(() => useYearMonthlySaving())

    expect(result.current.availableYears).toEqual([2026, 2024])
    expect(result.current.summaryYear).toBe(2026)
    expect(result.current.yearMonthlySaving).toBeNull()
    expect(mockedParseCSV).not.toHaveBeenCalled()
  })

  it('computes positive monthly savings when income exceeds expenses', () => {
    mockedLoadBudgetStore.mockReturnValue({
      years: [2026],
      csvs: {
        '2026-01': { month: '2026-01', csv: 'jan', uploadedAt: '2026-01-01T00:00:00.000Z' },
        '2026-02': { month: '2026-02', csv: 'feb', uploadedAt: '2026-02-01T00:00:00.000Z' },
      },
      configs: {},
      categoryGroups: [],
    })
    mockedParseCSV.mockImplementation(csv => {
      if (csv === 'jan') {
        return [
          { category: 'Salary', amount: 5000 },
          { category: 'Rent', amount: -2000 },
          { category: 'Groceries', amount: -500 },
        ]
      }

      return [
        { category: 'Salary', amount: 5000 },
        { category: 'Rent', amount: -2000 },
        { category: 'Groceries', amount: -500 },
      ]
    })

    const { result } = renderHook(() => useYearMonthlySaving())

    expect(result.current.yearMonthlySaving).toBe(2500)
  })

  it('categorizes positive totals as income and negative totals as expenses', () => {
    mockedLoadBudgetStore.mockReturnValue({
      years: [2026],
      csvs: {
        '2026-01': { month: '2026-01', csv: 'mixed', uploadedAt: '2026-01-01T00:00:00.000Z' },
      },
      configs: {},
      categoryGroups: [],
    })
    mockedParseCSV.mockReturnValue([
      { category: 'Salary', amount: 100 },
      { category: 'Bank Fee', amount: -40 },
    ])

    const { result } = renderHook(() => useYearMonthlySaving())

    expect(result.current.yearMonthlySaving).toBe(60)
  })

  it('excludes categories in the removed group', () => {
    mockedLoadBudgetStore.mockReturnValue({
      years: [2026],
      csvs: {
        '2026-01': { month: '2026-01', csv: 'removed', uploadedAt: '2026-01-01T00:00:00.000Z' },
      },
      configs: {},
      categoryGroups: [],
    })
    mockedGetGlobalCategoryGroups.mockReturnValue([{ id: 'removed', categories: ['Ignore me'] }])
    mockedParseCSV.mockReturnValue([
      { category: 'Salary', amount: 3000 },
      { category: 'Rent', amount: -1000 },
      { category: 'Ignore me', amount: 10000 },
    ])

    const { result } = renderHook(() => useYearMonthlySaving())

    expect(result.current.yearMonthlySaving).toBe(2000)
  })

  it('handles a parseCSV throw gracefully and skips the bad month', () => {
    mockedLoadBudgetStore.mockReturnValue({
      years: [2026],
      csvs: {
        '2026-01': { month: '2026-01', csv: 'good', uploadedAt: '2026-01-01T00:00:00.000Z' },
        '2026-02': { month: '2026-02', csv: 'bad', uploadedAt: '2026-02-01T00:00:00.000Z' },
      },
      configs: {},
      categoryGroups: [],
    })
    mockedParseCSV.mockImplementation(csv => {
      if (csv === 'bad') {
        throw new Error('bad csv')
      }

      return [
        { category: 'Salary', amount: 3000 },
        { category: 'Rent', amount: -1500 },
      ]
    })

    const { result } = renderHook(() => useYearMonthlySaving())

    expect(result.current.yearMonthlySaving).toBe(750)
    expect(mockedParseCSV).toHaveBeenCalledTimes(2)
  })

  it('ignores categories whose totals net to zero', () => {
    mockedLoadBudgetStore.mockReturnValue({
      years: [2026],
      csvs: {
        '2026-01': { month: '2026-01', csv: 'zeroed', uploadedAt: '2026-01-01T00:00:00.000Z' },
      },
      configs: {},
      categoryGroups: [],
    })
    mockedParseCSV.mockReturnValue([
      { category: 'Transfer', amount: 100 },
      { category: 'Transfer', amount: -100 },
    ])

    const { result } = renderHook(() => useYearMonthlySaving())

    expect(result.current.yearMonthlySaving).toBe(0)
  })
})
