import { FC } from 'react'
import { NavigationProps } from '../types'
import { useGoals } from '../contexts/GoalsContext'
import { useSettings } from '../contexts/SettingsContext'
import { useLayout } from '../contexts/LayoutContext'
import SidebarToggle from './SidebarToggle'
import { SettingsMenu } from '../pages/settings'
import type { SettingsSection } from '../pages/settings/types'
import '../styles/SidebarNavigation.css'

const SidebarNavigation: FC<NavigationProps> = ({ currentPage, setCurrentPage }) => {
  const { darkMode, setDarkMode, allowCsvImport, setAllowCsvImport } = useSettings()
  const { profile, updateProfile } = useGoals()
  const { sidebarOpen, setSidebarOpen, settingsOpenSection, setSettingsOpenSection, setSearchOpen } = useLayout()

  return (
    <nav className={`sidebar${sidebarOpen ? '' : ' collapsed'}`} aria-label="Main navigation">
      <div className="sidebar-top-row">
        <SidebarToggle expanded={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
        {sidebarOpen && <div className="sidebar-logo">Finance Tracker</div>}
      </div>
      {sidebarOpen && (
        <>
          <ul className="sidebar-menu">
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'home' ? ' active' : ''}`}
                onClick={() => setCurrentPage('home')}
                aria-current={currentPage === 'home' ? 'page' : undefined}
              >
                Home
              </button>
            </li>
            <li className="sidebar-item">
              <button className="sidebar-link" onClick={() => setSearchOpen(true)}>
                Search
              </button>
            </li>
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'goal' ? ' active' : ''}`}
                onClick={() => setCurrentPage('goal')}
                aria-current={currentPage === 'goal' ? 'page' : undefined}
              >
                Goals
              </button>
            </li>
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'net-worth' ? ' active' : ''}`}
                onClick={() => setCurrentPage('net-worth')}
                aria-current={currentPage === 'net-worth' ? 'page' : undefined}
              >
                Net Worth
              </button>
            </li>
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'budget' ? ' active' : ''}`}
                onClick={() => setCurrentPage('budget')}
                aria-current={currentPage === 'budget' ? 'page' : undefined}
              >
                Budget
              </button>
            </li>
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'transactions' ? ' active' : ''}`}
                onClick={() => setCurrentPage('transactions')}
                aria-current={currentPage === 'transactions' ? 'page' : undefined}
              >
                Transactions
              </button>
            </li>
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'taxes' ? ' active' : ''}`}
                onClick={() => setCurrentPage('taxes')}
                aria-current={currentPage === 'taxes' ? 'page' : undefined}
              >
                Taxes
              </button>
            </li>
          </ul>
        </>
      )}
      {sidebarOpen && (
        <ul className="sidebar-menu sidebar-footer-menu" role="group" aria-label="Utilities">
          <li className="sidebar-item">
            <button
              className={`sidebar-link${currentPage === 'drive' ? ' active' : ''}`}
              onClick={() => setCurrentPage('drive')}
              aria-current={currentPage === 'drive' ? 'page' : undefined}
            >
              Drive
            </button>
          </li>
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
            />
          </li>
          <li className="sidebar-item">
            <button
              className={`sidebar-link${currentPage === 'guide' ? ' active' : ''}`}
              onClick={() => setCurrentPage('guide')}
              aria-current={currentPage === 'guide' ? 'page' : undefined}
            >
              User Guide
            </button>
          </li>
        </ul>
      )}
    </nav>
  )
}

export default SidebarNavigation
