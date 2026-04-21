import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Data from './Data'

const defaultProfile = {
  name: '',
  currency: 'USD' as const,
  locale: 'en-US',
  dateFormat: 'MMM YYYY',
}

function renderData(initialRoute = '/net-worth') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Data profile={defaultProfile} />
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
})
