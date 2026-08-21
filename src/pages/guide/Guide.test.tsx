import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SettingsProvider } from '../../contexts/SettingsContext'
import Guide from './Guide'

class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(private readonly callback: IntersectionObserverCallback) {
    void this.callback
  }
}

describe('Guide', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  it('renders the guide headline and in-app navigation', () => {
    render(
      <MemoryRouter initialEntries={['/guide']}>
        <SettingsProvider>
          <Guide />
        </SettingsProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /your money, in your browser/i })).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: /on this page/i }).length).toBeGreaterThan(0)
  })

  it('filters toc items from the guide search box', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/guide']}>
        <SettingsProvider>
          <Guide />
        </SettingsProvider>
      </MemoryRouter>,
    )

    await user.type(screen.getByRole('searchbox', { name: /search this guide/i }), 'taxes')

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /taxes/i }).length).toBeGreaterThan(0)
      expect(screen.queryByRole('link', { name: /^Drive$/i })).not.toBeInTheDocument()
    })
  })
})
