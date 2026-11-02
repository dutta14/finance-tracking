import { FC, ReactNode } from 'react'
import { NavigationProps, PageType } from '../types'
import { useGoals } from '../contexts/GoalsContext'
import { useSettings } from '../contexts/SettingsContext'
import { useLayout } from '../contexts/LayoutContext'
import SidebarToggle from './SidebarToggle'
import {
  HomeIcon,
  SearchIcon,
  GoalsIcon,
  NetWorthIcon,
  BudgetIcon,
  TransactionsIcon,
  TaxesIcon,
  DriveIcon,
  GuideIcon,
} from './SidebarIcons'
import { SettingsMenu } from '../pages/settings'
import type { SettingsSection } from '../pages/settings/types'
import '../styles/SidebarNavigation.css'

interface NavItemProps {
  page: PageType
  label: string
  icon: ReactNode
  collapsed: boolean
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

const NavItem: FC<NavItemProps> = ({ page, label, icon, collapsed, currentPage, setCurrentPage }) => (
  <li className="sidebar-item">
    <button
      className={`sidebar-link${currentPage === page ? ' active' : ''}`}
      onClick={() => setCurrentPage(page)}
      aria-current={currentPage === page ? 'page' : undefined}
      title={collapsed ? label : undefined}
    >
      {icon}
      <span className="sidebar-label">{label}</span>
    </button>
  </li>
)

const SidebarNavigation: FC<NavigationProps> = ({ currentPage, setCurrentPage }) => {
  const { darkMode, setDarkMode, allowCsvImport, setAllowCsvImport } = useSettings()
  const { profile, updateProfile } = useGoals()
  const { sidebarOpen, setSidebarOpen, settingsOpenSection, setSettingsOpenSection, setSearchOpen } = useLayout()
  const collapsed = !sidebarOpen
  const itemProps = { collapsed, currentPage, setCurrentPage }

  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Main navigation">
      <div className="sidebar-top-row">
        <div className="sidebar-logo">Worth</div>
        <div className="sidebar-header-actions">
          {sidebarOpen && (
            <button
              className="sidebar-search-btn"
              aria-label="Search"
              title="Search"
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon />
            </button>
          )}
          <SidebarToggle expanded={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        </div>
      </div>
      <ul className="sidebar-menu">
        <NavItem page="home" label="Home" icon={<HomeIcon />} {...itemProps} />
        <NavItem page="goal" label="Goals" icon={<GoalsIcon />} {...itemProps} />
        <NavItem page="net-worth" label="Net Worth" icon={<NetWorthIcon />} {...itemProps} />
        <NavItem page="budget" label="Budget" icon={<BudgetIcon />} {...itemProps} />
        <NavItem page="transactions" label="Transactions" icon={<TransactionsIcon />} {...itemProps} />
        <NavItem page="taxes" label="Taxes" icon={<TaxesIcon />} {...itemProps} />
      </ul>
      <ul className="sidebar-menu sidebar-footer-menu" role="group" aria-label="Utilities">
        <NavItem page="drive" label="Drive" icon={<DriveIcon />} {...itemProps} />
        <li className="sidebar-item">
          <SettingsMenu
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            profile={profile}
            onUpdateProfile={updateProfile}
            allowCsvImport={allowCsvImport}
            onToggleAllowCsvImport={() => setAllowCsvImport(v => !v)}
            externalOpen={!!settingsOpenSection}
            externalSection={settingsOpenSection as SettingsSection | undefined}
            onExternalClose={() => setSettingsOpenSection(undefined)}
            iconOnly={collapsed}
          />
        </li>
        <NavItem page="guide" label="User Guide" icon={<GuideIcon />} {...itemProps} />
      </ul>
    </nav>
  )
}

export default SidebarNavigation
