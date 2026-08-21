import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { SettingsProvider, useSettings } from './SettingsContext'

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
  const fireStorage = (key: string, newValue: string | null) => {
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue }))
    })
  }

  beforeEach(() => {
    localStorage.clear()
    document.body.classList.remove('dark')
  })

  it('turns dark mode on when another tab writes darkMode=1', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('darkMode').textContent).toBe('false')

    fireStorage('darkMode', '1')

    expect(screen.getByTestId('darkMode').textContent).toBe('true')
  })

  it('turns dark mode off when another tab writes darkMode=0', () => {
    localStorage.setItem('darkMode', '1')
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('darkMode').textContent).toBe('true')

    fireStorage('darkMode', '0')

    expect(screen.getByTestId('darkMode').textContent).toBe('false')
  })

  it('leaves dark mode unchanged for a value that is neither 0 nor 1', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )

    fireStorage('darkMode', 'invalid')

    expect(screen.getByTestId('darkMode').textContent).toBe('false')
  })

  it('adopts the accent theme written by another tab', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('accentTheme').textContent).toBe('blue')

    fireStorage('accentTheme', 'purple')

    expect(screen.getByTestId('accentTheme').textContent).toBe('purple')
  })

  it('keeps the current accent theme when the storage event carries no value', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )

    fireStorage('accentTheme', null)

    expect(screen.getByTestId('accentTheme').textContent).toBe('blue')
  })

  it('enables CSV imports when another tab writes allowCsvImport=1', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('allowCsvImport').textContent).toBe('false')

    fireStorage('allowCsvImport', '1')

    expect(screen.getByTestId('allowCsvImport').textContent).toBe('true')
  })

  it('disables CSV imports when another tab writes allowCsvImport=0', () => {
    localStorage.setItem('allowCsvImport', '1')
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('allowCsvImport').textContent).toBe('true')

    fireStorage('allowCsvImport', '0')

    expect(screen.getByTestId('allowCsvImport').textContent).toBe('false')
  })

  it('ignores storage events for unrelated keys', () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )

    fireStorage('some-other-key', '1')

    expect(screen.getByTestId('darkMode').textContent).toBe('false')
    expect(screen.getByTestId('accentTheme').textContent).toBe('blue')
    expect(screen.getByTestId('allowCsvImport').textContent).toBe('false')
  })

  it('stops listening after unmount', () => {
    const { unmount } = render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    )
    unmount()

    expect(() => fireStorage('darkMode', '1')).not.toThrow()
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
