import { FC, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { PageType } from './types'
import SidebarNavigation from './components/SidebarNavigation'
import SidebarToggle from './components/SidebarToggle'
import Home from './pages/home/Home'
import Goal from './pages/goal/Goal'
import Data from './pages/data/Data'
import Budget from './pages/budget/Budget'
import Drive from './pages/drive/Drive'
import Taxes from './pages/taxes/Taxes'
import { DataProvider } from './contexts/DataContext'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { GitHubSyncProvider } from './contexts/GitHubSyncContext'
import { BudgetSyncProvider } from './contexts/BudgetSyncContext'
import { TaxSyncProvider } from './contexts/TaxSyncContext'
import { GoalsProvider, useGoals } from './contexts/GoalsContext'
import { ImportExportProvider, useImportExport } from './contexts/ImportExportContext'
import { LayoutProvider, useLayout } from './contexts/LayoutContext'
import ErrorBoundary from './components/ErrorBoundary'
import UndoToast from './components/UndoToast'
import SearchModal from './components/SearchModal'
import { isDemoActive, enterDemoMode, exitDemoMode } from './pages/settings/demoMode'
import './styles/ErrorBoundary.css'
import './styles/colorThemes.css'

const AppShell: FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { setDarkMode } = useSettings()
  const { pendingDelete, handleUndoDelete, dismissPendingDelete } = useGoals()
  const { handleExport } = useImportExport()
  const { sidebarOpen, setSidebarOpen, isMobile, searchOpen, setSearchOpen, setSettingsOpenSection } = useLayout()
  const currentPage: PageType =
    location.pathname === '/goal' || location.pathname.startsWith('/goal/')
      ? 'goal'
      : location.pathname.startsWith('/net-worth')
        ? 'net-worth'
        : location.pathname === '/budget'
          ? 'budget'
          : location.pathname.startsWith('/drive')
            ? 'drive'
            : location.pathname === '/taxes'
              ? 'taxes'
              : 'home'
  const setCurrentPage = (page: PageType): void => {
    navigate(
      { home: '/', goal: '/goal', 'net-worth': '/net-worth', budget: '/budget', drive: '/drive', taxes: '/taxes' }[
        page
      ] || '/',
    )
  }
  const handleSearchAction = useCallback(
    (actionId: string) => {
      switch (actionId) {
        case 'toggle-dark-mode':
          setDarkMode(d => !d)
          break
        case 'open-settings':
        case 'open-settings-advanced':
          setSettingsOpenSection('advanced')
          break
        case 'open-profile':
        case 'open-settings-profile':
          setSettingsOpenSection('profile')
          break
        case 'open-settings-github':
          setSettingsOpenSection('github')
          break
        case 'open-settings-appearance':
          setSettingsOpenSection('appearance')
          break
        case 'open-settings-labs':
          setSettingsOpenSection('labs')
          break
        case 'new-goal':
          navigate('/goal')
          break
        case 'toggle-demo':
          isDemoActive() ? exitDemoMode() : enterDemoMode()
          break
        case 'export-data':
          handleExport()
          break
      }
    },
    [navigate, setDarkMode, setSettingsOpenSection, handleExport],
  )
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {sidebarOpen && (
        <SidebarNavigation
          currentPage={currentPage}
          setCurrentPage={page => {
            setCurrentPage(page)
            if (isMobile) setSidebarOpen(false)
          }}
        />
      )}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.4)' }}
        />
      )}
      <main
        className={`main-content${!sidebarOpen ? ' sidebar-closed' : ''}`}
        style={{
          flex: 1,
          marginLeft: !isMobile && sidebarOpen ? 220 : 0,
          padding: 0,
          minHeight: '100vh',
          transition: 'margin-left 0.2s',
        }}
      >
        {!sidebarOpen && (
          <div style={{ position: 'fixed', top: '1.25rem', left: '0.75rem', zIndex: 300 }}>
            <SidebarToggle expanded={false} onToggle={() => setSidebarOpen(true)} />
          </div>
        )}
        {isDemoActive() && (
          <div className="demo-banner">
            <span>Demo Mode — showing sample data</span>
            <button onClick={exitDemoMode}>Exit Demo</button>
          </div>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <ErrorBoundary variant="card" resetKey={location.pathname}>
                <Home />
              </ErrorBoundary>
            }
          />
          <Route
            path="/goal/*"
            element={
              <ErrorBoundary variant="card" resetKey={location.pathname}>
                <Goal />
              </ErrorBoundary>
            }
          />
          <Route
            path="/net-worth/*"
            element={
              <ErrorBoundary variant="card" resetKey={location.pathname}>
                <Data />
              </ErrorBoundary>
            }
          />
          <Route path="/data" element={<Navigate to="/net-worth" replace />} />
          <Route
            path="/budget"
            element={
              <ErrorBoundary variant="card" resetKey={location.pathname}>
                <Budget />
              </ErrorBoundary>
            }
          />
          <Route path="/tools" element={<Navigate to="/budget" replace />} />
          <Route
            path="/drive/*"
            element={
              <ErrorBoundary variant="card" resetKey={location.pathname}>
                <Drive />
              </ErrorBoundary>
            }
          />
          <Route path="/allocation" element={<Navigate to="/net-worth/allocation" replace />} />
          <Route
            path="/taxes"
            element={
              <ErrorBoundary variant="card" resetKey={location.pathname}>
                <Taxes />
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {pendingDelete && (
        <UndoToast
          message={pendingDelete.message}
          onUndo={handleUndoDelete}
          onDismiss={dismissPendingDelete}
          duration={10000}
        />
      )}
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={path => navigate(path)}
        onAction={handleSearchAction}
      />
    </div>
  )
}
const App: FC = () => (
  <ErrorBoundary variant="page">
    <SettingsProvider>
      <GoalsProvider>
        <GitHubSyncProvider>
          <BudgetSyncProvider>
            <TaxSyncProvider>
              <DataProvider>
                <LayoutProvider>
                  <ImportExportProvider>
                    <AppShell />
                  </ImportExportProvider>
                </LayoutProvider>
              </DataProvider>
            </TaxSyncProvider>
          </BudgetSyncProvider>
        </GitHubSyncProvider>
      </GoalsProvider>
    </SettingsProvider>
  </ErrorBoundary>
)
export default App
