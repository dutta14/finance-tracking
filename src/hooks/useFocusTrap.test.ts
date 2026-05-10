import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useFocusTrap } from './useFocusTrap'

function createContainer(...elements: HTMLElement[]) {
  const container = document.createElement('div')
  elements.forEach(el => container.appendChild(el))
  document.body.appendChild(container)
  return container
}

function createButton(label: string) {
  const btn = document.createElement('button')
  btn.textContent = label
  return btn
}

function fireTab(shiftKey = false) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true }))
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('useFocusTrap', () => {
  it('focuses first focusable element when isOpen transitions to true', () => {
    const btn1 = createButton('First')
    const btn2 = createButton('Second')
    const container = createContainer(btn1, btn2)

    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      useFocusTrap(ref, true)
    })

    expect(document.activeElement).toBe(btn1)
  })

  it('focuses the container when there are zero focusable elements', () => {
    const container = createContainer()
    document.body.appendChild(container)

    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      useFocusTrap(ref, true)
    })

    expect(document.activeElement).toBe(container)
    expect(container.getAttribute('tabindex')).toBe('-1')
  })

  it('wraps Tab from last element to first', () => {
    const btn1 = createButton('First')
    const btn2 = createButton('Last')
    const container = createContainer(btn1, btn2)

    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      useFocusTrap(ref, true)
    })

    btn2.focus()
    expect(document.activeElement).toBe(btn2)

    fireTab(false)
    expect(document.activeElement).toBe(btn1)
  })

  it('wraps Shift+Tab from first element to last', () => {
    const btn1 = createButton('First')
    const btn2 = createButton('Last')
    const container = createContainer(btn1, btn2)

    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      useFocusTrap(ref, true)
    })

    expect(document.activeElement).toBe(btn1)
    fireTab(true)
    expect(document.activeElement).toBe(btn2)
  })

  it('does nothing when isOpen is false', () => {
    const btn1 = createButton('First')
    const container = createContainer(btn1)

    const triggerBtn = createButton('Trigger')
    document.body.appendChild(triggerBtn)
    triggerBtn.focus()

    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      useFocusTrap(ref, false)
    })

    expect(document.activeElement).toBe(triggerBtn)
  })

  it('restores focus when isOpen transitions to false', () => {
    const btn1 = createButton('First')
    const container = createContainer(btn1)

    const triggerBtn = createButton('Trigger')
    document.body.appendChild(triggerBtn)
    triggerBtn.focus()

    const { rerender } = renderHook(
      ({ isOpen }) => {
        const ref = useRef<HTMLElement>(container)
        useFocusTrap(ref, isOpen)
      },
      { initialProps: { isOpen: true } },
    )

    expect(document.activeElement).toBe(btn1)

    rerender({ isOpen: false })
    expect(document.activeElement).toBe(triggerBtn)
  })

  it('ignores non-Tab keydown events', () => {
    const btn1 = createButton('First')
    const btn2 = createButton('Last')
    const container = createContainer(btn1, btn2)

    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      useFocusTrap(ref, true)
    })

    expect(document.activeElement).toBe(btn1)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.activeElement).toBe(btn1)
  })

  it('prevents default on Tab when zero focusable elements and trap is active', () => {
    const container = createContainer()

    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      useFocusTrap(ref, true)
    })

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})
