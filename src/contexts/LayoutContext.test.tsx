import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { LayoutProvider, useLayout } from './LayoutContext'
import type { ReactNode } from 'react'

/* ── helpers ─────────────────────────────────────────────────────── */

const wrapper = ({ children }: { children: ReactNode }) => <LayoutProvider>{children}</LayoutProvider>

function LayoutConsumer() {
  const ctx = useLayout()
  return (
    <div>
      <span data-testid="sidebarOpen">{String(ctx.sidebarOpen)}</span>
      <span data-testid="isMobile">{String(ctx.isMobile)}</span>
      <span data-testid="searchOpen">{String(ctx.searchOpen)}</span>
      <span data-testid="settingsSection">{ctx.settingsOpenSection ?? 'none'}</span>
      <button data-testid="toggle-sidebar" onClick={() => ctx.setSidebarOpen(v => !v)} />
      <button data-testid="open-search" onClick={() => ctx.setSearchOpen(true)} />
      <button data-testid="close-search" onClick={() => ctx.setSearchOpen(false)} />
      <button data-testid="open-profile" onClick={ctx.handleOpenProfile} />
    </div>
  )
}

/* ── setup ───────────────────────────────────────────────────────── */

let origInnerWidth: number

beforeEach(() => {
  origInnerWidth = window.innerWidth
  Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true })
})

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: origInnerWidth, writable: true, configurable: true })
})

/* ── tests ───────────────────────────────────────────────────────── */

describe('LayoutContext', () => {
  it('useLayout throws when used outside LayoutProvider', () => {
    expect(() => {
      renderHook(() => useLayout())
    }).toThrow('useLayout must be used within a <LayoutProvider>')
  })

  it('provides default layout state', () => {
    render(
      <LayoutProvider>
        <LayoutConsumer />
      </LayoutProvider>,
    )

    expect(screen.getByTestId('sidebarOpen').textContent).toBe('true')
    expect(screen.getByTestId('isMobile').textContent).toBe('false')
    expect(screen.getByTestId('searchOpen').textContent).toBe('false')
    expect(screen.getByTestId('settingsSection').textContent).toBe('none')
  })

  it('toggles sidebar state', () => {
    render(
      <LayoutProvider>
        <LayoutConsumer />
      </LayoutProvider>,
    )

    expect(screen.getByTestId('sidebarOpen').textContent).toBe('true')

    act(() => {
      screen.getByTestId('toggle-sidebar').click()
    })

    expect(screen.getByTestId('sidebarOpen').textContent).toBe('false')
  })

  it('detects mobile on resize', () => {
    render(
      <LayoutProvider>
        <LayoutConsumer />
      </LayoutProvider>,
    )

    expect(screen.getByTestId('isMobile').textContent).toBe('false')

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true, configurable: true })
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.getByTestId('isMobile').textContent).toBe('true')
  })

  it('re-opens sidebar when resizing back to desktop', () => {
    render(
      <LayoutProvider>
        <LayoutConsumer />
      </LayoutProvider>,
    )

    // Close sidebar first
    act(() => {
      screen.getByTestId('toggle-sidebar').click()
    })
    expect(screen.getByTestId('sidebarOpen').textContent).toBe('false')

    // Go mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true, configurable: true })
      window.dispatchEvent(new Event('resize'))
    })

    // Back to desktop
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true })
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.getByTestId('sidebarOpen').textContent).toBe('true')
  })

  it('toggles search via Cmd+K keyboard shortcut', () => {
    render(
      <LayoutProvider>
        <LayoutConsumer />
      </LayoutProvider>,
    )

    expect(screen.getByTestId('searchOpen').textContent).toBe('false')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    })

    expect(screen.getByTestId('searchOpen').textContent).toBe('true')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    })

    expect(screen.getByTestId('searchOpen').textContent).toBe('false')
  })

  it('handleOpenProfile sets settings section to profile', () => {
    render(
      <LayoutProvider>
        <LayoutConsumer />
      </LayoutProvider>,
    )

    act(() => {
      screen.getByTestId('open-profile').click()
    })

    expect(screen.getByTestId('settingsSection').textContent).toBe('profile')
  })

  it('provides context value via hook', () => {
    const { result } = renderHook(() => useLayout(), { wrapper })

    expect(result.current.sidebarOpen).toBe(true)
    expect(result.current.isMobile).toBe(false)
    expect(result.current.searchOpen).toBe(false)
    expect(result.current.settingsOpenSection).toBeUndefined()
    expect(typeof result.current.setSidebarOpen).toBe('function')
    expect(typeof result.current.handleOpenProfile).toBe('function')
  })
})
