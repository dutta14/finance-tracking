import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SidebarNavigation from './SidebarNavigation'

const noop = () => {}

const defaultProps = {
  currentPage: 'home' as const,
  setCurrentPage: noop as any,
  expanded: true,
  setExpanded: noop,
  darkMode: false,
  setDarkMode: noop,
  goals: [],
  selectedNavGoalIds: [] as number[],
  isMultiSelectMode: false,
  onSelectNavGoal: noop as any,
  onExitMultiSelect: noop,
  onRenameGoal: noop as any,
  onDeleteGoal: noop as any,
  onDeleteMultiple: noop as any,
  onReorderGoals: noop as any,
  onExport: noop,
  onImport: noop as any,
  profile: { name: '', avatarUrl: '', birthday: '' },
  onUpdateProfile: noop as any,
}

const renderSidebar = (overrides = {}) =>
  render(
    <MemoryRouter>
      <SidebarNavigation {...defaultProps} {...overrides} />
    </MemoryRouter>,
  )

describe('SidebarNavigation', () => {
  it('renders expected nav links (no Tools)', () => {
    renderSidebar()

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Goals')).toBeInTheDocument()
    expect(screen.getByText('Net Worth')).toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
    expect(screen.getByText('Taxes')).toBeInTheDocument()
    expect(screen.getByText('Drive')).toBeInTheDocument()

    expect(screen.queryByText('Tools')).not.toBeInTheDocument()
  })

  it('does not render a Tools nav button', () => {
    renderSidebar()

    const buttons = screen.getAllByRole('button')
    const labels = buttons.map(b => b.textContent?.trim())
    expect(labels).not.toContain('Tools')
  })
})
