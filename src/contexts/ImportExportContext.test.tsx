import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { render, screen, act } from '@testing-library/react'
import { ImportExportProvider, useImportExport } from './ImportExportContext'
import { GoalsProvider } from './GoalsContext'
import { SettingsProvider } from './SettingsContext'
import type { ReactNode } from 'react'

/* ── helpers ─────────────────────────────────────────────────────── */

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GoalsProvider>
      <ImportExportProvider>{children}</ImportExportProvider>
    </GoalsProvider>
  </SettingsProvider>
)

function ImportExportConsumer() {
  const ctx = useImportExport()
  return (
    <div>
      <span data-testid="hasExport">{String(typeof ctx.handleExport === 'function')}</span>
      <span data-testid="hasImport">{String(typeof ctx.handleImport === 'function')}</span>
      <span data-testid="hasReset">{String(typeof ctx.handleFactoryReset === 'function')}</span>
      <button data-testid="export" onClick={ctx.handleExport} />
    </div>
  )
}

/* ── setup ───────────────────────────────────────────────────────── */

beforeEach(() => {
  localStorage.clear()
})

/* ── tests ───────────────────────────────────────────────────────── */

describe('ImportExportContext', () => {
  it('useImportExport throws when used outside ImportExportProvider', () => {
    expect(() => {
      renderHook(() => useImportExport())
    }).toThrow('useImportExport must be used within an <ImportExportProvider>')
  })

  it('provides all three handler functions', () => {
    render(
      <SettingsProvider>
        <GoalsProvider>
          <ImportExportProvider>
            <ImportExportConsumer />
          </ImportExportProvider>
        </GoalsProvider>
      </SettingsProvider>,
    )

    expect(screen.getByTestId('hasExport').textContent).toBe('true')
    expect(screen.getByTestId('hasImport').textContent).toBe('true')
    expect(screen.getByTestId('hasReset').textContent).toBe('true')
  })

  it('handleExport creates a download link', () => {
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    const clickSpy = vi.fn()
    const origCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement')

    Object.defineProperty(window, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
      configurable: true,
    })

    createElementSpy.mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          _href: '',
          download: '',
          click: clickSpy,
          set href(v: string) {
            this._href = v
          },
          get href() {
            return this._href
          },
        } as any
      }
      return origCreateElement(tag)
    })

    render(
      <SettingsProvider>
        <GoalsProvider>
          <ImportExportProvider>
            <ImportExportConsumer />
          </ImportExportProvider>
        </GoalsProvider>
      </SettingsProvider>,
    )

    act(() => {
      screen.getByTestId('export').click()
    })

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)

    createElementSpy.mockRestore()
  })

  it('handleFactoryReset clears localStorage', () => {
    // Mock window.location.reload
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    })

    localStorage.setItem('test-key', 'test-value')

    const { result } = renderHook(() => useImportExport(), { wrapper })

    act(() => {
      result.current.handleFactoryReset()
    })

    expect(localStorage.getItem('test-key')).toBeNull()
  })

  it('provides context via hook', () => {
    const { result } = renderHook(() => useImportExport(), { wrapper })

    expect(typeof result.current.handleExport).toBe('function')
    expect(typeof result.current.handleImport).toBe('function')
    expect(typeof result.current.handleFactoryReset).toBe('function')
  })
})
