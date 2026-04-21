import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  it('renders expected nav links and footer icons (no Tools)', () => {
    renderSidebar()

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Goals')).toBeInTheDocument()
    expect(screen.getByText('Net Worth')).toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
    expect(screen.getByText('Taxes')).toBeInTheDocument()

    // Drive and Settings are now icon buttons in the footer
    expect(screen.getByRole('button', { name: 'Drive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()

    expect(screen.queryByText('Tools')).not.toBeInTheDocument()
  })

  it('does not render a Tools nav button', () => {
    renderSidebar()

    const buttons = screen.getAllByRole('button')
    const labels = buttons.map(b => b.textContent?.trim())
    expect(labels).not.toContain('Tools')
  })

  it('does not render Drive as a text link in the primary nav list', () => {
    renderSidebar()

    const navList = screen.getByRole('list')
    const navButtons = within(navList).getAllByRole('button')
    const navLabels = navButtons.map(b => b.textContent?.trim())
    expect(navLabels).not.toContain('Drive')
  })

  it('calls setCurrentPage with "drive" when the Drive icon button is clicked', async () => {
    const setCurrentPage = vi.fn()
    const user = userEvent.setup()
    renderSidebar({ setCurrentPage })

    await user.click(screen.getByRole('button', { name: 'Drive' }))

    expect(setCurrentPage).toHaveBeenCalledTimes(1)
    expect(setCurrentPage).toHaveBeenCalledWith('drive')
  })

  it('opens the settings modal when the Settings icon button is clicked', async () => {
    const user = userEvent.setup()
    renderSidebar()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Settings' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('applies active styling and aria-current to Drive button when currentPage is "drive"', () => {
    renderSidebar({ currentPage: 'drive' })

    const driveBtn = screen.getByRole('button', { name: 'Drive' })
    expect(driveBtn).toHaveClass('sidebar-footer-btn--active')
    expect(driveBtn).toHaveAttribute('aria-current', 'page')
  })

  it('does not apply active styling to Drive button when currentPage is not "drive"', () => {
    renderSidebar({ currentPage: 'home' })

    const driveBtn = screen.getByRole('button', { name: 'Drive' })
    expect(driveBtn).not.toHaveClass('sidebar-footer-btn--active')
    expect(driveBtn).not.toHaveAttribute('aria-current')
  })

  it('renders the footer group with correct ARIA attributes', () => {
    renderSidebar()

    const group = screen.getByRole('group', { name: 'Utilities' })
    expect(group).toBeInTheDocument()
    expect(group).toHaveClass('sidebar-footer')

    const buttons = within(group).getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toHaveAttribute('aria-label', 'Drive')
    expect(buttons[1]).toHaveAttribute('aria-label', 'Settings')
  })
})
