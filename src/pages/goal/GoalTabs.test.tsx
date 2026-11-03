import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Goal from './Goal'
import PlanningTabs from '../../components/PlanningTabs'

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
  it('renders a nav element with aria-label "Planning sections"', () => {
    renderGoal()
    const nav = screen.getByRole('navigation', { name: 'Planning sections' })
    expect(nav).toBeInTheDocument()
  })

  it('renders a "Goals" tab inside the nav', () => {
    renderGoal()
    expect(screen.getByRole('link', { name: 'Goals' })).toBeInTheDocument()
  })

  it('the "Goals" tab links to /goal/plans', () => {
    renderGoal()
    const link = screen.getByRole('link', { name: 'Goals' })
    expect(link).toHaveAttribute('href', '/goal/plans')
  })

  it('renders a "Taxes" tab that links to /taxes', () => {
    renderGoal()
    expect(screen.getByRole('link', { name: 'Taxes' })).toHaveAttribute('href', '/taxes')
  })

  it('renders a "FIRE Calculator" tab inside the nav', () => {
    renderGoal()
    expect(screen.getByRole('link', { name: 'FIRE Calculator' })).toBeInTheDocument()
  })

  it('the "FIRE Calculator" tab links to /goal/calculator', () => {
    renderGoal()
    const link = screen.getByRole('link', { name: 'FIRE Calculator' })
    expect(link).toHaveAttribute('href', '/goal/calculator')
  })
})

describe('PlanningTabs focus handling', () => {
  it('focuses the active tab when arriving from another Planning tab', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/taxes', state: { focusPlanningTab: true } }]}>
        <Routes>
          <Route path="/taxes" element={<PlanningTabs />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('link', { name: 'Taxes' })).toHaveFocus())
  })

  it('does not steal focus on a plain visit', () => {
    render(
      <MemoryRouter initialEntries={['/taxes']}>
        <Routes>
          <Route path="/taxes" element={<PlanningTabs />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(document.body).toHaveFocus()
  })
})

/* ─── Active state ─── */

describe('Goal tab active state', () => {
  it('sets aria-current="page" on the active Goals tab', () => {
    renderGoal('/goal')
    const link = screen.getByRole('link', { name: 'Goals' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('sets aria-current="page" on the FIRE Calculator tab when active', () => {
    renderGoal('/goal/calculator')
    const link = screen.getByRole('link', { name: 'FIRE Calculator' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark "Goals" as active when on /goal/calculator', () => {
    renderGoal('/goal/calculator')
    const link = screen.getByRole('link', { name: 'Goals' })
    expect(link).not.toHaveAttribute('aria-current')
  })

  it('does not mark "FIRE Calculator" as active when on /goal', () => {
    renderGoal('/goal')
    const link = screen.getByRole('link', { name: 'FIRE Calculator' })
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
