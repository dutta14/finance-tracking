import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditingState } from './useEditingState'

describe('useEditingState', () => {
  it('starts with empty selection and no editing', () => {
    const { result } = renderHook(() => useEditingState())
    expect(result.current.selectedGoalIds).toEqual([])
    expect(result.current.editingGoalId).toBeNull()
  })

  describe('toggleGoalSelection (single mode)', () => {
    it('selects a goal on first click', () => {
      const { result } = renderHook(() => useEditingState())
      act(() => result.current.toggleGoalSelection(1))
      expect(result.current.selectedGoalIds).toEqual([1])
    })

    it('deselects a goal when clicking the same one again', () => {
      const { result } = renderHook(() => useEditingState())
      act(() => result.current.toggleGoalSelection(1))
      act(() => result.current.toggleGoalSelection(1))
      expect(result.current.selectedGoalIds).toEqual([])
    })

    it('replaces selection when clicking a different goal', () => {
      const { result } = renderHook(() => useEditingState())
      act(() => result.current.toggleGoalSelection(1))
      act(() => result.current.toggleGoalSelection(2))
      expect(result.current.selectedGoalIds).toEqual([2])
    })
  })

  describe('toggleGoalSelection (multi mode)', () => {
    it('adds goals to selection', () => {
      const { result } = renderHook(() => useEditingState())
      act(() => result.current.toggleGoalSelection(1, true))
      act(() => result.current.toggleGoalSelection(2, true))
      expect(result.current.selectedGoalIds).toEqual([1, 2])
    })

    it('removes a goal from multi-selection when toggled again', () => {
      const { result } = renderHook(() => useEditingState())
      act(() => result.current.toggleGoalSelection(1, true))
      act(() => result.current.toggleGoalSelection(2, true))
      act(() => result.current.toggleGoalSelection(1, true))
      expect(result.current.selectedGoalIds).toEqual([2])
    })
  })

  describe('editing', () => {
    it('sets editingGoalId on startEditing', () => {
      const { result } = renderHook(() => useEditingState())
      act(() => result.current.startEditing(5))
      expect(result.current.editingGoalId).toBe(5)
    })

    it('clears editingGoalId on stopEditing', () => {
      const { result } = renderHook(() => useEditingState())
      act(() => result.current.startEditing(5))
      act(() => result.current.stopEditing())
      expect(result.current.editingGoalId).toBeNull()
    })
  })

  describe('resetState', () => {
    it('clears both selection and editing', () => {
      const { result } = renderHook(() => useEditingState())
      act(() => {
        result.current.toggleGoalSelection(1, true)
        result.current.toggleGoalSelection(2, true)
        result.current.startEditing(3)
      })
      act(() => result.current.resetState())
      expect(result.current.selectedGoalIds).toEqual([])
      expect(result.current.editingGoalId).toBeNull()
    })
  })
})
