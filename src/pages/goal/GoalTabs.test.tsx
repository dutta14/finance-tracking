import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Goal from './Goal'

vi.mock('../../contexts/GoalsContext', () => ({
  useGoals: () => ({
    visibleGoals: [],
    gwGoals: [],
    profile: { birthday: '' },
    createGoal: () => {},
    updateGoal: () => {},
    handleDeleteGoal: () => {},
    handleDeleteWithUndo: () => {},
    reorderGoals: () => {},
    handleCopyGwGoals: () => {},
    createGwGoal: () => {},
    updateGwGoal: () => {},
    deleteGwGoal: () => {},
  }),
}))

vi.mock('../../contexts/LayoutContext', () => ({
  useLayout: () => ({
    handleOpenProfile: () => {},
  }),
}))

function renderGoal(initialRoute = '/goal') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Goal />
    </MemoryRouter>,
  )
}

/* ─── Tab bar rendering ─── */

describe('Goal tab bar', () => {
  it('renders a nav element with aria-label "Goals sections"', () => {
    renderGoal()
    const nav = screen.getByRole('navigation', { name: 'Goals sections' })
    expect(nav).toBeInTheDocument()
  })

  it('renders a "Plans" tab inside the nav', () => {
    renderGoal()
    const nav = screen.getByRole('navigation', { name: 'Goals sections' })
    const links = nav.querySelectorAll('a')
    const plansLink = Array.from(links).find(a => a.textContent === 'Plans')
    expect(plansLink).toBeInTheDocument()
  })

  it('the "Plans" tab links to /goal', () => {
    renderGoal()
    const link = screen.getByRole('link', { name: 'Plans' })
    expect(link).toHaveAttribute('href', '/goal')
  })

  it('renders a "Calculator" tab inside the nav', () => {
    renderGoal()
    const nav = screen.getByRole('navigation', { name: 'Goals sections' })
    const links = nav.querySelectorAll('a')
    const calcLink = Array.from(links).find(a => a.textContent === 'Calculator')
    expect(calcLink).toBeInTheDocument()
  })

  it('the "Calculator" tab links to /goal/calculator', () => {
    renderGoal()
    const link = screen.getByRole('link', { name: 'Calculator' })
    expect(link).toHaveAttribute('href', '/goal/calculator')
  })
})

/* ─── Active state ─── */

describe('Goal tab active state', () => {
  it('marks "Plans" as active when on /goal', () => {
    renderGoal('/goal')
    const link = screen.getByRole('link', { name: 'Plans' })
    expect(link.className).toContain('active')
  })

  it('sets aria-current="page" on the active Plans tab', () => {
    renderGoal('/goal')
    const link = screen.getByRole('link', { name: 'Plans' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('marks "Calculator" as active when on /goal/calculator', () => {
    renderGoal('/goal/calculator')
    const link = screen.getByRole('link', { name: 'Calculator' })
    expect(link.className).toContain('active')
  })

  it('sets aria-current="page" on the Calculator tab when active', () => {
    renderGoal('/goal/calculator')
    const link = screen.getByRole('link', { name: 'Calculator' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark "Plans" as active when on /goal/calculator', () => {
    renderGoal('/goal/calculator')
    const link = screen.getByRole('link', { name: 'Plans' })
    expect(link.className).not.toContain('active')
  })

  it('does not mark "Calculator" as active when on /goal', () => {
    renderGoal('/goal')
    const link = screen.getByRole('link', { name: 'Calculator' })
    expect(link.className).not.toContain('active')
  })
})

/* ─── Tab bar structure ─── */

describe('Goal tab bar structure', () => {
  it('tab bar has the goal-tab-bar class', () => {
    renderGoal()
    const nav = screen.getByRole('navigation', { name: 'Goals sections' })
    expect(nav.className).toContain('goal-tab-bar')
  })

  it('Plans tab link has the goal-tab class', () => {
    renderGoal()
    const link = screen.getByRole('link', { name: 'Plans' })
    expect(link.className).toContain('goal-tab')
  })

  it('Calculator tab link has the goal-tab class', () => {
    renderGoal()
    const link = screen.getByRole('link', { name: 'Calculator' })
    expect(link.className).toContain('goal-tab')
  })
})

/* ─── Header actions visibility ─── */

describe('Goal header actions per tab', () => {
  it('shows the "New Goal" button on /goal', () => {
    renderGoal('/goal')
    const btn = screen.getByRole('button', { name: /new goal/i })
    expect(btn).toBeInTheDocument()
  })

  it('does not show the "New Goal" button on /goal/calculator', () => {
    renderGoal('/goal/calculator')
    const btn = screen.queryByRole('button', { name: /new goal/i })
    expect(btn).not.toBeInTheDocument()
  })
})
