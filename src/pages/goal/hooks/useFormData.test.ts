import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormData } from './useFormData'
import type { FinancialGoal } from '../../../types'

const mockGoal: FinancialGoal = {
  id: 1,
  goalName: 'Retire Early',
  createdAt: '2025-01-01',
  birthday: '1990-01-01',
  goalCreatedIn: '2025-01',
  goalEndYear: '2050',
  resetExpenseMonth: false,
  retirementAge: 55,
  expenseMonth: 3,
  expenseValue: 50000,
  monthlyExpenseValue: 4167,
  expenseValueMar2026: 52000,
  expenseValue2047: 80000,
  monthlyExpense2047: 6667,
  inflationRate: 3,
  safeWithdrawalRate: 4,
  growth: 7,
  retirement: '2045-01',
  fiGoal: 2000000,
  progress: 25,
}

describe('useFormData', () => {
  it('initializes with default empty form data', () => {
    const { result } = renderHook(() => useFormData())
    expect(result.current.formData.goalName).toBe('')
    expect(result.current.formData.retirementAge).toBe('')
    expect(result.current.formData.resetExpenseMonth).toBe(false)
    expect(result.current.error).toBe('')
  })

  describe('handleInputChange', () => {
    it('updates a text field', () => {
      const { result } = renderHook(() => useFormData())
      act(() => {
        result.current.handleInputChange({
          currentTarget: { name: 'goalName', type: 'text', value: 'My Goal' },
        } as any)
      })
      expect(result.current.formData.goalName).toBe('My Goal')
    })

    it('strips non-numeric chars from expenseValue', () => {
      const { result } = renderHook(() => useFormData())
      act(() => {
        result.current.handleInputChange({
          currentTarget: { name: 'expenseValue', type: 'text', value: '$50,000' },
        } as any)
      })
      expect(result.current.formData.expenseValue).toBe('50000')
    })

    it('handles checkbox fields', () => {
      const { result } = renderHook(() => useFormData())
      act(() => {
        result.current.handleInputChange({
          currentTarget: { name: 'resetExpenseMonth', type: 'checkbox', checked: true },
        } as any)
      })
      expect(result.current.formData.resetExpenseMonth).toBe(true)
    })
  })

  describe('populateFromGoal', () => {
    it('fills form data from a goal object', () => {
      const { result } = renderHook(() => useFormData())
      act(() => result.current.populateFromGoal(mockGoal))
      expect(result.current.formData.goalName).toBe('Retire Early')
      expect(result.current.formData.goalCreatedIn).toBe('2025-01')
      expect(result.current.formData.retirementAge).toBe('55')
      expect(result.current.formData.inflationRate).toBe('3')
      expect(result.current.formData.safeWithdrawalRate).toBe('4')
      expect(result.current.formData.growth).toBe('7')
    })

    it('appends name suffix when provided', () => {
      const { result } = renderHook(() => useFormData())
      act(() => result.current.populateFromGoal(mockGoal, '(copy)'))
      expect(result.current.formData.goalName).toBe('Retire Early (copy)')
    })

    it('clears expenseMonth and monthlyExpenseValue on populate', () => {
      const { result } = renderHook(() => useFormData())
      // Set some values first
      act(() => {
        result.current.setFormData(prev => ({ ...prev, expenseMonth: '5', monthlyExpenseValue: '999' }))
      })
      act(() => result.current.populateFromGoal(mockGoal))
      expect(result.current.formData.expenseMonth).toBe('')
      expect(result.current.formData.monthlyExpenseValue).toBe('')
    })
  })

  describe('resetForm', () => {
    it('resets form data and clears error', () => {
      const { result } = renderHook(() => useFormData())
      act(() => {
        result.current.populateFromGoal(mockGoal)
        result.current.setError('something went wrong')
      })
      act(() => result.current.resetForm())
      expect(result.current.formData.goalName).toBe('')
      expect(result.current.formData.retirementAge).toBe('')
      expect(result.current.error).toBe('')
    })
  })
})
