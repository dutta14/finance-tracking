import { FC, lazy, Suspense, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { PageType } from './types'
import SidebarNavigation from './components/SidebarNavigation'
import SidebarToggle from './components/SidebarToggle'
import SkipLink from './components/SkipLink'

const Home = lazy(() => import('./pages/home/Home'))
const Goal = lazy(() => import('./pages/goal/Goal'))
const Data = lazy(() => import('./pages/data/Data'))
const Budget = lazy(() => import('./pages/budget/Budget'))
const Drive = lazy(() => import('./pages/drive/Drive'))
const Taxes = lazy(() => import('./pages/taxes/Taxes'))
import { DataProvider } from './contexts/DataContext'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { EncryptionProvider, useEncryption } from './contexts/EncryptionContext'
import { GitHubSyncProvider } from './contexts/GitHubSyncContext'
import { BudgetSyncProvider } from './contexts/BudgetSyncContext'
import { TaxSyncProvider } from './contexts/TaxSyncContext'
import { GoalsProvider, useGoals } from './contexts/GoalsContext'
import { ImportExportProvider, useImportExport } from './contexts/ImportExportContext'
import { LayoutProvider, useLayout } from './contexts/LayoutContext'
import { FlagProvider } from './flags/FlagContext'
import ErrorBoundary from './components/ErrorBoundary'
import UnlockScreen from './components/UnlockScreen'
import UndoToast from './components/UndoToast'
import SearchModal from './components/SearchModal'
import { isDemoActive, enterDemoMode, exitDemoMode } from './pages/settings/demoMode'
import './styles/ErrorBoundary.css'
import './styles/colorThemes.css'
import './styles/modern-design.css'
import './styles/utilities.css'
import { ModernDesignToggle } from './flags/ModernDesignToggle'
import { composeProviders } from './utils/composeProviders'

/*
 * Provider dependency order (outermost → innermost):
 *
 * Tier 1 – independent (no context dependencies):
 *   SettingsProvider, EncryptionProvider, LayoutProvider
 *
 * (AppGate checks EncryptionProvider.isLocked before rendering Tier 2+)
 *
 * Tier 2 – independent within the authenticated tree:
 *   GoalsProvider (uses useProfile hook, not a context)
 *   DataProvider
 *
 * Tier 3 – depends on Tier 1 + 2 contexts:
 *   GitHubSyncProvider  → useGoals, useSettings
 *   FlagProvider         → useGitHubSyncContext
 *   BudgetSyncProvider   → useGitHubSyncContext
 *   TaxSyncProvider      → useGitHubSyncContext, useEncryption
 *   ImportExportProvider → useGoals, useSettings
 */
const OuterProviders = composeProviders(SettingsProvider, EncryptionProvider, LayoutProvider)

const InnerProviders = composeProviders(
  GoalsProvider,
  DataProvider,
  GitHubSyncProvider,
  FlagProvider,
  BudgetSyncProvider,
  TaxSyncProvider,
  ImportExportProvider,
)

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
    <div className="app-layout">
      <SkipLink />
      <ModernDesignToggle />
      {sidebarOpen && (
        <SidebarNavigation
          currentPage={currentPage}
          setCurrentPage={page => {
            setCurrentPage(page)
            if (isMobile) setSidebarOpen(false)
          }}
        />
      )}
      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="sidebar-overlay" />}
      <main
        id="main-content"
        tabIndex={-1}
        className={`main-content${!sidebarOpen ? ' sidebar-closed' : ''}${!isMobile && sidebarOpen ? ' sidebar-open' : ''}`}
      >
        {!sidebarOpen && (
          <div className="sidebar-toggle-wrapper">
            <SidebarToggle expanded={false} onToggle={() => setSidebarOpen(true)} />
          </div>
        )}
        {isDemoActive() && (
          <div className="demo-banner">
            <span>Demo Mode — showing sample data</span>
            <button onClick={exitDemoMode}>Exit Demo</button>
          </div>
        )}
        <Suspense
          fallback={
            <div role="status" aria-label="Loading page" className="loading-fallback">
              Loading…
            </div>
          }
        >
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
        </Suspense>
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
const AppGate: FC = () => {
  const { isLocked } = useEncryption()

  if (isLocked) return <UnlockScreen />

  return (
    <InnerProviders>
      <AppShell />
    </InnerProviders>
  )
}

const App: FC = () => (
  <ErrorBoundary variant="page">
    <OuterProviders>
      <AppGate />
    </OuterProviders>
  </ErrorBoundary>
)
export default App
