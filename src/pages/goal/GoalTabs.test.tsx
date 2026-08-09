import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
      <Routes>
        <Route path="/goal/*" element={<Goal />} />
      </Routes>
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

  it('renders a "FIRE Plans" tab inside the nav', () => {
    renderGoal()
    expect(screen.getByRole('link', { name: 'FIRE Plans' })).toBeInTheDocument()
  })

  it('the "FIRE Plans" tab links to /goal/plans', () => {
    renderGoal()
    const link = screen.getByRole('link', { name: 'FIRE Plans' })
    expect(link).toHaveAttribute('href', '/goal/plans')
  })

  it('renders a "FI Calculator" tab inside the nav', () => {
    renderGoal()
    expect(screen.getByRole('link', { name: 'FI Calculator' })).toBeInTheDocument()
  })

  it('the "FI Calculator" tab links to /goal/calculator', () => {
    renderGoal()
    const link = screen.getByRole('link', { name: 'FI Calculator' })
    expect(link).toHaveAttribute('href', '/goal/calculator')
  })
})

/* ─── Active state ─── */

describe('Goal tab active state', () => {
  it('sets aria-current="page" on the active FIRE Plans tab', () => {
    renderGoal('/goal')
    const link = screen.getByRole('link', { name: 'FIRE Plans' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('sets aria-current="page" on the FI Calculator tab when active', () => {
    renderGoal('/goal/calculator')
    const link = screen.getByRole('link', { name: 'FI Calculator' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark "FIRE Plans" as active when on /goal/calculator', () => {
    renderGoal('/goal/calculator')
    const link = screen.getByRole('link', { name: 'FIRE Plans' })
    expect(link).not.toHaveAttribute('aria-current')
  })

  it('does not mark "FI Calculator" as active when on /goal', () => {
    renderGoal('/goal')
    const link = screen.getByRole('link', { name: 'FI Calculator' })
    expect(link).not.toHaveAttribute('aria-current')
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
