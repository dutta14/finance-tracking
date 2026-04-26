import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Data from './Data'

vi.mock('../../contexts/GoalsContext', () => ({
  useGoals: () => ({
    profile: { name: '', currency: 'USD', locale: 'en-US', dateFormat: 'MMM YYYY' },
  }),
}))

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    allowCsvImport: false,
  }),
}))

vi.mock('../../contexts/GitHubSyncContext', () => ({
  useGitHubSyncContext: () => ({
    handleDataChange: () => {},
  }),
}))

vi.mock('../../contexts/DataContext', () => ({
  useData: () => ({
    accounts: [],
    balances: [],
    setAccounts: () => {},
    setBalances: () => {},
  }),
}))

function renderData(initialRoute = '/net-worth') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Data />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

/* ─── Tab bar rendering ─── */

describe('Net Worth tab bar', () => {
  it('renders a nav element with aria-label "Net Worth sections"', () => {
    renderData()
    const nav = screen.getByRole('navigation', { name: 'Net Worth sections' })
    expect(nav).toBeInTheDocument()
  })

  it('renders an "Accounts" tab inside the nav', () => {
    renderData()
    const nav = screen.getByRole('navigation', { name: 'Net Worth sections' })
    const accountsLink = nav.querySelector('a')
    expect(accountsLink).toBeInTheDocument()
    expect(accountsLink).toHaveTextContent('Accounts')
  })

  it('the "Accounts" tab links to /net-worth', () => {
    renderData()
    const link = screen.getByRole('link', { name: 'Accounts' })
    expect(link).toHaveAttribute('href', '/net-worth')
  })

  it('renders an "Allocation" tab inside the nav', () => {
    renderData()
    const nav = screen.getByRole('navigation', { name: 'Net Worth sections' })
    const links = nav.querySelectorAll('a')
    const allocationLink = Array.from(links).find(a => a.textContent === 'Allocation')
    expect(allocationLink).toBeInTheDocument()
  })

  it('the "Allocation" tab links to /net-worth/allocation', () => {
    renderData()
    const link = screen.getByRole('link', { name: 'Allocation' })
    expect(link).toHaveAttribute('href', '/net-worth/allocation')
  })

  it('renders a "Growth" tab inside the nav', () => {
    renderData()
    const nav = screen.getByRole('navigation', { name: 'Net Worth sections' })
    const links = nav.querySelectorAll('a')
    const growthLink = Array.from(links).find(a => a.textContent === 'Growth')
    expect(growthLink).toBeInTheDocument()
  })

  it('the "Growth" tab links to /net-worth/growth', () => {
    renderData()
    const link = screen.getByRole('link', { name: 'Growth' })
    expect(link).toHaveAttribute('href', '/net-worth/growth')
  })
})

/* ─── Active state ─── */

describe('Net Worth tab active state', () => {
  it('marks "Accounts" as active when on /net-worth', () => {
    renderData('/net-worth')
    const link = screen.getByRole('link', { name: 'Accounts' })
    expect(link.className).toContain('active')
  })

  it('sets aria-current="page" on the active tab', () => {
    renderData('/net-worth')
    const link = screen.getByRole('link', { name: 'Accounts' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark "Accounts" as active when on /net-worth/allocation', () => {
    renderData('/net-worth/allocation')
    const link = screen.getByRole('link', { name: 'Accounts' })
    expect(link.className).not.toContain('active')
  })

  it('marks "Allocation" as active when on /net-worth/allocation', () => {
    renderData('/net-worth/allocation')
    const link = screen.getByRole('link', { name: 'Allocation' })
    expect(link.className).toContain('active')
  })

  it('sets aria-current="page" on the Allocation tab when active', () => {
    renderData('/net-worth/allocation')
    const link = screen.getByRole('link', { name: 'Allocation' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark "Allocation" as active when on /net-worth', () => {
    renderData('/net-worth')
    const link = screen.getByRole('link', { name: 'Allocation' })
    expect(link.className).not.toContain('active')
  })

  it('marks "Growth" as active when on /net-worth/growth', () => {
    renderData('/net-worth/growth')
    const link = screen.getByRole('link', { name: 'Growth' })
    expect(link.className).toContain('active')
  })

  it('sets aria-current="page" on the Growth tab when active', () => {
    renderData('/net-worth/growth')
    const link = screen.getByRole('link', { name: 'Growth' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark "Growth" as active when on /net-worth', () => {
    renderData('/net-worth')
    const link = screen.getByRole('link', { name: 'Growth' })
    expect(link.className).not.toContain('active')
  })
})

/* ─── Tab bar structure ─── */

describe('Net Worth tab bar structure', () => {
  it('tab bar has the nw-tab-bar class', () => {
    renderData()
    const nav = screen.getByRole('navigation', { name: 'Net Worth sections' })
    expect(nav.className).toContain('nw-tab-bar')
  })

  it('tab link has the nw-tab class', () => {
    renderData()
    const link = screen.getByRole('link', { name: 'Accounts' })
    expect(link.className).toContain('nw-tab')
  })

  it('Allocation tab link has the nw-tab class', () => {
    renderData()
    const link = screen.getByRole('link', { name: 'Allocation' })
    expect(link.className).toContain('nw-tab')
  })

  it('Growth tab link has the nw-tab class', () => {
    renderData()
    const link = screen.getByRole('link', { name: 'Growth' })
    expect(link.className).toContain('nw-tab')
  })
})
