import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { SettingsProvider, useSettings } from './SettingsContext'
import { appStorage } from '../utils/appStorage'

/* ── helpers ─────────────────────────────────────────────────────── */

function Consumer() {
  const { darkMode, accentTheme, allowCsvImport } = useSettings()
  return (
    <div>
      <span data-testid="darkMode">{String(darkMode)}</span>
      <span data-testid="accentTheme">{accentTheme}</span>
      <span data-testid="allowCsvImport">{String(allowCsvImport)}</span>
    </div>
  )
}

function ToggleConsumer() {
  const { darkMode, setDarkMode, accentTheme, setAccentTheme, allowCsvImport, setAllowCsvImport } = useSettings()
  return (
    <div>
      <span data-testid="darkMode">{String(darkMode)}</span>
      <span data-testid="accentTheme">{accentTheme}</span>
      <span data-testid="allowCsvImport">{String(allowCsvImport)}</span>
      <button data-testid="toggle-dark" onClick={() => setDarkMode(d => !d)} />
      <button data-testid="set-accent" onClick={() => setAccentTheme('green')} />
      <button data-testid="toggle-csv" onClick={() => setAllowCsvImport(v => !v)} />
    </div>
  )
}

/* ── setup ───────────────────────────────────────────────────────── */

beforeEach(() => {
  localStorage.clear()
  document.body.classList.remove('dark')
})

/* ── tests ───────────────────────────────────────────────────────── */

describe('SettingsContext', () => {
  it('provides default values when localStorage is empty', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )

    expect(screen.getByTestId('darkMode').textContent).toBe('false')
    expect(screen.getByTestId('accentTheme').textContent).toBe('blue')
    expect(screen.getByTestId('allowCsvImport').textContent).toBe('false')
  })

  it('loads initial darkMode from localStorage', () => {
    localStorage.setItem('darkMode', '1')

    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )

    expect(screen.getByTestId('darkMode').textContent).toBe('true')
  })

  it('loads initial accentTheme from localStorage', () => {
    localStorage.setItem('accentTheme', 'purple')

    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )

    expect(screen.getByTestId('accentTheme').textContent).toBe('purple')
  })

  it('falls back to fiTheme key if accentTheme is not set', () => {
    localStorage.setItem('fiTheme', 'orange')

    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )

    expect(screen.getByTestId('accentTheme').textContent).toBe('orange')
  })

  it('loads initial allowCsvImport from localStorage', () => {
    localStorage.setItem('allowCsvImport', '1')

    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )

    expect(screen.getByTestId('allowCsvImport').textContent).toBe('true')
  })

  it('toggle dark mode updates state and persists to localStorage', () => {
    render(
      <SettingsProvider>
        <ToggleConsumer />
      </SettingsProvider>,
    )

    expect(screen.getByTestId('darkMode').textContent).toBe('false')

    act(() => {
      screen.getByTestId('toggle-dark').click()
    })

    expect(screen.getByTestId('darkMode').textContent).toBe('true')
    expect(localStorage.getItem('darkMode')).toBe('1')
    expect(document.body.classList.contains('dark')).toBe(true)
  })

  it('toggle dark mode off removes body class', () => {
    localStorage.setItem('darkMode', '1')

    render(
      <SettingsProvider>
        <ToggleConsumer />
      </SettingsProvider>,
    )

    expect(screen.getByTestId('darkMode').textContent).toBe('true')

    act(() => {
      screen.getByTestId('toggle-dark').click()
    })

    expect(screen.getByTestId('darkMode').textContent).toBe('false')
    expect(localStorage.getItem('darkMode')).toBe('0')
    expect(document.body.classList.contains('dark')).toBe(false)
  })

  it('change accent theme updates state and persists', () => {
    render(
      <SettingsProvider>
        <ToggleConsumer />
      </SettingsProvider>,
    )

    act(() => {
      screen.getByTestId('set-accent').click()
    })

    expect(screen.getByTestId('accentTheme').textContent).toBe('green')
    expect(localStorage.getItem('accentTheme')).toBe('green')
  })

  it('toggle CSV import updates state and persists', () => {
    render(
      <SettingsProvider>
        <ToggleConsumer />
      </SettingsProvider>,
    )

    act(() => {
      screen.getByTestId('toggle-csv').click()
    })

    expect(screen.getByTestId('allowCsvImport').textContent).toBe('true')
    expect(localStorage.getItem('allowCsvImport')).toBe('1')
  })

  it('useSettings throws when used outside SettingsProvider', () => {
    expect(() => {
      renderHook(() => useSettings())
    }).toThrow('useSettings must be used within a <SettingsProvider>')
  })
})

describe('SettingsContext cross-tab sync', () => {
  let subscribeSpy: ReturnType<typeof vi.spyOn>
  let capturedCallbacks: Map<string, (value: string | null) => void>
  let unsubs: ReturnType<typeof vi.fn>[]

  beforeEach(() => {
    localStorage.clear()
    document.body.classList.remove('dark')
    capturedCallbacks = new Map()
    unsubs = []
    subscribeSpy = vi.spyOn(appStorage, 'subscribe').mockImplementation((key, cb) => {
      capturedCallbacks.set(key, cb)
      const unsub = vi.fn()
      unsubs.push(unsub)
      return unsub
    })
  })

  afterEach(() => {
    subscribeSpy.mockRestore()
  })

  it('subscribes to darkMode, accentTheme, and allowCsvImport on mount', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(subscribeSpy).toHaveBeenCalledWith('darkMode', expect.any(Function))
    expect(subscribeSpy).toHaveBeenCalledWith('accentTheme', expect.any(Function))
    expect(subscribeSpy).toHaveBeenCalledWith('allowCsvImport', expect.any(Function))
  })

  it('updates darkMode when subscriber fires with 1', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('darkMode').textContent).toBe('false')

    act(() => {
      capturedCallbacks.get('darkMode')!('1')
    })

    expect(screen.getByTestId('darkMode').textContent).toBe('true')
  })

  it('updates darkMode to false when subscriber fires with 0', () => {
    localStorage.setItem('darkMode', '1')
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('darkMode').textContent).toBe('true')

    act(() => {
      capturedCallbacks.get('darkMode')!('0')
    })

    expect(screen.getByTestId('darkMode').textContent).toBe('false')
  })

  it('updates accentTheme when subscriber fires with new theme', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('accentTheme').textContent).toBe('blue')

    act(() => {
      capturedCallbacks.get('accentTheme')!('purple')
    })

    expect(screen.getByTestId('accentTheme').textContent).toBe('purple')
  })

  it('updates allowCsvImport when subscriber fires with 1', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('allowCsvImport').textContent).toBe('false')

    act(() => {
      capturedCallbacks.get('allowCsvImport')!('1')
    })

    expect(screen.getByTestId('allowCsvImport').textContent).toBe('true')
  })

  it('unsubscribes all on unmount', () => {
    const { unmount } = render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    unsubs.forEach(fn => expect(fn).not.toHaveBeenCalled())
    unmount()
    unsubs.forEach(fn => expect(fn).toHaveBeenCalled())
  })

  it('sets darkMode to false when subscriber fires with 0', () => {
    localStorage.setItem('darkMode', '1')
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('darkMode').textContent).toBe('true')

    act(() => {
      capturedCallbacks.get('darkMode')!('0')
    })

    expect(screen.getByTestId('darkMode').textContent).toBe('false')
  })

  it('does not update accentTheme when subscriber fires with null', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('accentTheme').textContent).toBe('blue')

    act(() => {
      capturedCallbacks.get('accentTheme')!(null as unknown as string)
    })

    expect(screen.getByTestId('accentTheme').textContent).toBe('blue')
  })

  it('sets allowCsvImport to false when subscriber fires with 0', () => {
    localStorage.setItem('allowCsvImport', '1')
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('allowCsvImport').textContent).toBe('true')

    act(() => {
      capturedCallbacks.get('allowCsvImport')!('0')
    })

    expect(screen.getByTestId('allowCsvImport').textContent).toBe('false')
  })

  it('does not update darkMode when subscriber fires with non-0/1 value', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('darkMode').textContent).toBe('false')

    act(() => {
      capturedCallbacks.get('darkMode')!('invalid')
    })

    // Neither "1" nor "0" — neither branch executes, state unchanged
    expect(screen.getByTestId('darkMode').textContent).toBe('false')
  })
})

describe('SettingsContext accent theme body class', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.classList.remove('dark')
    document.body.className = ''
  })

  it('adds accent class to body when accentTheme is not blue', () => {
    localStorage.setItem('accentTheme', 'green')
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(document.body.classList.contains('accent-green')).toBe(true)
  })

  it('does not add accent class when theme is blue (default)', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(document.body.classList.contains('accent-blue')).toBe(false)
  })

  it('removes previous accent class when theme changes', () => {
    localStorage.setItem('accentTheme', 'purple')
    render(
      <SettingsProvider>
        <ToggleConsumer />
      </SettingsProvider>,
    )
    expect(document.body.classList.contains('accent-purple')).toBe(true)

    act(() => {
      screen.getByTestId('set-accent').click()
    })

    // Now theme is 'green' (from ToggleConsumer handler)
    expect(document.body.classList.contains('accent-green')).toBe(true)
    expect(document.body.classList.contains('accent-purple')).toBe(false)
  })

  it('falls back to matchMedia dark mode when localStorage has no stored value', () => {
    // matchMedia returns true for dark mode
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true })
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock, writable: true })

    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )

    expect(screen.getByTestId('darkMode').textContent).toBe('true')
    expect(document.body.classList.contains('dark')).toBe(true)
  })
})
