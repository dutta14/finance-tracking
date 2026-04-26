import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SidebarNavigation from './SidebarNavigation'
import { SettingsProvider } from '../contexts/SettingsContext'
import { GoalsProvider } from '../contexts/GoalsContext'
import { GitHubSyncProvider } from '../contexts/GitHubSyncContext'
import { BudgetSyncProvider } from '../contexts/BudgetSyncContext'
import { TaxSyncProvider } from '../contexts/TaxSyncContext'
import { ImportExportProvider } from '../contexts/ImportExportContext'
import { LayoutProvider } from '../contexts/LayoutContext'

const noop = () => {}

const defaultProps = {
  currentPage: 'home' as const,
  setCurrentPage: noop as any,
}

const renderSidebar = (overrides = {}) =>
  render(
    <MemoryRouter>
      <SettingsProvider>
        <GoalsProvider>
          <GitHubSyncProvider>
            <BudgetSyncProvider>
              <TaxSyncProvider>
                <LayoutProvider>
                  <ImportExportProvider>
                    <SidebarNavigation {...defaultProps} {...overrides} />
                  </ImportExportProvider>
                </LayoutProvider>
              </TaxSyncProvider>
            </BudgetSyncProvider>
          </GitHubSyncProvider>
        </GoalsProvider>
      </SettingsProvider>
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

  describe('Goals is a plain sidebar link (no accordion)', () => {
    it('renders Goals as a plain button with sidebar-link class', () => {
      renderSidebar()

      const goalsBtn = screen.getByRole('button', { name: 'Goals' })
      expect(goalsBtn).toHaveClass('sidebar-link')
      expect(goalsBtn.tagName).toBe('BUTTON')
    })

    it('does not render a chevron or aria-expanded on the Goals button', () => {
      renderSidebar()

      const goalsBtn = screen.getByRole('button', { name: 'Goals' })
      expect(goalsBtn).not.toHaveAttribute('aria-expanded')
      expect(goalsBtn.querySelector('.sidebar-chevron')).toBeNull()
    })

    it('calls setCurrentPage("goal") when Goals is clicked', async () => {
      const setCurrentPage = vi.fn()
      const user = userEvent.setup()
      renderSidebar({ setCurrentPage })

      await user.click(screen.getByRole('button', { name: 'Goals' }))

      expect(setCurrentPage).toHaveBeenCalledTimes(1)
      expect(setCurrentPage).toHaveBeenCalledWith('goal')
    })

    it('applies active styling and aria-current when currentPage is "goal"', () => {
      renderSidebar({ currentPage: 'goal' })

      const goalsBtn = screen.getByRole('button', { name: 'Goals' })
      expect(goalsBtn).toHaveClass('sidebar-link', 'active')
      expect(goalsBtn).toHaveAttribute('aria-current', 'page')
    })

    it('does not apply active styling when currentPage is not "goal"', () => {
      renderSidebar({ currentPage: 'home' })

      const goalsBtn = screen.getByRole('button', { name: 'Goals' })
      expect(goalsBtn).not.toHaveClass('active')
      expect(goalsBtn).not.toHaveAttribute('aria-current')
    })
  })

  /* ── Bug 2 regression: combinedSyncNow dep-array correctness ──── */

  describe('sync integration renders correctly (regression)', () => {
    it('renders without errors when consuming all sync contexts including budget and tax', () => {
      expect(() => renderSidebar()).not.toThrow()
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    })

    it('Settings button is functional and opens the settings dialog containing sync controls', async () => {
      const user = userEvent.setup()
      renderSidebar()

      const settingsBtn = screen.getByRole('button', { name: 'Settings' })
      expect(settingsBtn).toBeInTheDocument()

      await user.click(settingsBtn)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('exposes all expected nav links after mounting with full provider tree', () => {
      renderSidebar()

      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Goals')).toBeInTheDocument()
      expect(screen.getByText('Net Worth')).toBeInTheDocument()
      expect(screen.getByText('Budget')).toBeInTheDocument()
      expect(screen.getByText('Taxes')).toBeInTheDocument()
    })
  })

  describe('no accordion submenu or multi-select UI', () => {
    it('does not render any submenu list', () => {
      renderSidebar()

      expect(screen.queryByRole('list', { name: /goals/i })).not.toBeInTheDocument()
      expect(document.querySelector('.sidebar-submenu')).toBeNull()
    })

    it('does not render overflow menu buttons', () => {
      renderSidebar()

      expect(document.querySelector('.sidebar-overflow-btn')).toBeNull()
      expect(document.querySelector('.sidebar-overflow-menu')).toBeNull()
      expect(document.querySelector('.sidebar-menu-overlay')).toBeNull()
    })

    it('does not render multi-select bar or checkboxes', () => {
      renderSidebar()

      expect(document.querySelector('.sidebar-multiselect-bar')).toBeNull()
      expect(document.querySelector('.sidebar-checkbox')).toBeNull()
    })

    it('does not render sub-item elements or rename inputs', () => {
      renderSidebar()

      expect(document.querySelector('.sidebar-subitem')).toBeNull()
      expect(document.querySelector('.sidebar-sublink')).toBeNull()
      expect(document.querySelector('.sidebar-rename-input')).toBeNull()
    })

    it('does not render any draggable elements', () => {
      renderSidebar()

      const draggables = document.querySelectorAll('[draggable="true"]')
      expect(draggables).toHaveLength(0)
    })
  })
})
