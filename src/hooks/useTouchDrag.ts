import { useRef, useCallback, useState } from 'react'

interface UseTouchDragOptions {
  longPressMs?: number
  onDragStart: (idx: number) => void
  onDragMove: (clientX: number, clientY: number) => void
  onDragEnd: () => void
  getSlotFromPoint: (x: number, y: number) => number | null
}

interface TouchHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

interface UseTouchDragResult {
  getTouchHandlers: (idx: number) => TouchHandlers
  isDragging: boolean
  isLongPressing: boolean
  dragIdx: number | null
  touchMoved: boolean
}

export function useTouchDrag(options: UseTouchDragOptions): UseTouchDragResult {
  const {
    longPressMs = 300,
    onDragStart,
    onDragMove,
    onDragEnd,
    getSlotFromPoint,
  } = options

  const [isDragging, setIsDragging] = useState(false)
  const [isLongPressing, setIsLongPressing] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchMovedRef = useRef(false)
  const activeIdx = useRef<number | null>(null)
  const slotElement = useRef<HTMLElement | null>(null)

  const clearTimers = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (feedbackTimer.current !== null) {
      clearTimeout(feedbackTimer.current)
      feedbackTimer.current = null
    }
  }, [])

  const handleTouchStart = useCallback((idx: number, e: React.TouchEvent) => {
    touchMovedRef.current = false
    activeIdx.current = idx
    slotElement.current = e.currentTarget as HTMLElement

    // 150ms feedback timer for long-press visual hint
    feedbackTimer.current = setTimeout(() => {
      setIsLongPressing(true)
    }, 150)

    // 300ms timer to actually start the drag
    longPressTimer.current = setTimeout(() => {
      setIsDragging(true)
      setIsLongPressing(false)
      setDragIdx(idx)
      touchMovedRef.current = true
      if (slotElement.current) {
        slotElement.current.style.touchAction = 'none'
      }
      navigator.vibrate?.(10)
      onDragStart(idx)
    }, longPressMs)
  }, [longPressMs, onDragStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!isDragging) {
      // If the user moves before long-press fires, cancel
      clearTimers()
      setIsLongPressing(false)
      return
    }
    e.preventDefault()
    onDragMove(touch.clientX, touch.clientY)
    getSlotFromPoint(touch.clientX, touch.clientY)
  }, [isDragging, clearTimers, onDragMove, getSlotFromPoint])

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    clearTimers()
    if (slotElement.current) {
      slotElement.current.style.touchAction = ''
    }
    if (isDragging) {
      onDragEnd()
    }
    setIsDragging(false)
    setIsLongPressing(false)
    setDragIdx(null)
    activeIdx.current = null
    slotElement.current = null
  }, [isDragging, clearTimers, onDragEnd])

  const getTouchHandlers = useCallback((idx: number): TouchHandlers => ({
    onTouchStart: (e: React.TouchEvent) => handleTouchStart(idx, e),
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }), [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    getTouchHandlers,
    isDragging,
    isLongPressing,
    dragIdx,
    touchMoved: touchMovedRef.current,
  }
}
