import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTouchDrag } from './useTouchDrag'
import { makeTouchEvent, mockNavigatorVibrate } from '../test/mockHelpers'

const makeOptions = (overrides = {}) => ({
  onDragStart: vi.fn(),
  onDragMove: vi.fn(),
  onDragEnd: vi.fn(),
  getSlotFromPoint: vi.fn().mockReturnValue(null),
  ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers()
  mockNavigatorVibrate()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTouchDrag', () => {
  it('returns isDragging=false initially', () => {
    const { result } = renderHook(() => useTouchDrag(makeOptions()))

    expect(result.current.isDragging).toBe(false)
    expect(result.current.isLongPressing).toBe(false)
    expect(result.current.dragIdx).toBeNull()
  })

  it('sets isLongPressing=true after 150ms feedback timer', () => {
    const { result } = renderHook(() => useTouchDrag(makeOptions()))

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchStart(makeTouchEvent(100, 100))
    })

    expect(result.current.isLongPressing).toBe(false)

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.isLongPressing).toBe(true)
    expect(result.current.isDragging).toBe(false)
  })

  it('sets isDragging=true after longPressMs threshold', () => {
    const onDragStart = vi.fn()
    const { result } = renderHook(() => useTouchDrag(makeOptions({ onDragStart })))

    act(() => {
      const handlers = result.current.getTouchHandlers(2)
      handlers.onTouchStart(makeTouchEvent(100, 100))
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isDragging).toBe(true)
    expect(result.current.isLongPressing).toBe(false)
    expect(result.current.dragIdx).toBe(2)
    expect(onDragStart).toHaveBeenCalledWith(2)
  })

  it('triggers haptic feedback when drag starts', () => {
    const { result } = renderHook(() => useTouchDrag(makeOptions()))

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchStart(makeTouchEvent(100, 100))
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(navigator.vibrate).toHaveBeenCalledWith(10)
  })

  it('cancels if touchEnd fires before threshold', () => {
    const onDragStart = vi.fn()
    const onDragEnd = vi.fn()
    const { result } = renderHook(() => useTouchDrag(makeOptions({ onDragStart, onDragEnd })))

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchStart(makeTouchEvent(100, 100))
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchEnd(makeTouchEvent(100, 100))
    })

    expect(result.current.isDragging).toBe(false)
    expect(onDragStart).not.toHaveBeenCalled()
    expect(onDragEnd).not.toHaveBeenCalled()
  })

  it('cancels if touch moves before threshold', () => {
    const onDragStart = vi.fn()
    const { result } = renderHook(() => useTouchDrag(makeOptions({ onDragStart })))

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchStart(makeTouchEvent(100, 100))
    })

    act(() => {
      vi.advanceTimersByTime(50)
    })

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchMove(makeTouchEvent(120, 120))
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isDragging).toBe(false)
    expect(onDragStart).not.toHaveBeenCalled()
  })

  it('calls onDragEnd on touchEnd during active drag', () => {
    const onDragEnd = vi.fn()
    const { result } = renderHook(() => useTouchDrag(makeOptions({ onDragEnd })))

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchStart(makeTouchEvent(100, 100))
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isDragging).toBe(true)

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchEnd(makeTouchEvent(100, 200))
    })

    expect(onDragEnd).toHaveBeenCalled()
    expect(result.current.isDragging).toBe(false)
    expect(result.current.dragIdx).toBeNull()
  })

  it('calls onDragMove and getSlotFromPoint during active drag', () => {
    const onDragMove = vi.fn()
    const getSlotFromPoint = vi.fn().mockReturnValue(3)
    const { result } = renderHook(() => useTouchDrag(makeOptions({ onDragMove, getSlotFromPoint })))

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchStart(makeTouchEvent(100, 100))
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const moveEvent = makeTouchEvent(150, 200)
    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchMove(moveEvent)
    })

    expect(moveEvent.preventDefault).toHaveBeenCalled()
    expect(onDragMove).toHaveBeenCalledWith(150, 200)
    expect(getSlotFromPoint).toHaveBeenCalledWith(150, 200)
  })

  it('supports custom longPressMs', () => {
    const onDragStart = vi.fn()
    const { result } = renderHook(() => useTouchDrag(makeOptions({ onDragStart, longPressMs: 500 })))

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchStart(makeTouchEvent(100, 100))
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isDragging).toBe(false)

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current.isDragging).toBe(true)
    expect(onDragStart).toHaveBeenCalled()
  })

  it('timers continue after unmount (no explicit cleanup)', () => {
    const onDragStart = vi.fn()
    const { result, unmount } = renderHook(() => useTouchDrag(makeOptions({ onDragStart })))

    act(() => {
      const handlers = result.current.getTouchHandlers(0)
      handlers.onTouchStart(makeTouchEvent(100, 100))
    })

    unmount()

    // The hook does not clear timers on unmount, so the callback fires.
    // React suppresses the state update, but onDragStart is still called.
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onDragStart).toHaveBeenCalledWith(0)
  })

  it('resets all state on touchEnd after drag', () => {
    const { result } = renderHook(() => useTouchDrag(makeOptions()))

    act(() => {
      const handlers = result.current.getTouchHandlers(1)
      handlers.onTouchStart(makeTouchEvent(50, 50))
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isDragging).toBe(true)
    expect(result.current.dragIdx).toBe(1)

    act(() => {
      const handlers = result.current.getTouchHandlers(1)
      handlers.onTouchEnd(makeTouchEvent(50, 50))
    })

    expect(result.current.isDragging).toBe(false)
    expect(result.current.isLongPressing).toBe(false)
    expect(result.current.dragIdx).toBeNull()
  })
})
