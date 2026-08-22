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
const Transactions = lazy(() => import('./pages/transactions/Transactions'))
const Drive = lazy(() => import('./pages/drive/Drive'))
const Taxes = lazy(() => import('./pages/taxes/Taxes'))
const Guide = lazy(() => import('./pages/guide/Guide'))
import { DataProvider } from './contexts/DataContext'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { FileStoreProvider, useFileStore, isDemoActive } from './contexts/FileStoreContext'
import { GoalsProvider, useGoals } from './contexts/GoalsContext'
import { LayoutProvider, useLayout } from './contexts/LayoutContext'
import { FlagProvider } from './flags/FlagContext'
import ErrorBoundary from './components/ErrorBoundary'
import FolderPicker from './components/FolderPicker'
import UndoToast from './components/UndoToast'
import SearchModal from './components/SearchModal'
import { useSearchIndexData } from './search/useSearchIndexData'
import './styles/ErrorBoundary.css'
import './styles/colorThemes.css'
import './styles/modern-design.css'
import './styles/utilities.css'
import { ModernDesignToggle } from './flags/ModernDesignToggle'
import { composeProviders } from './utils/composeProviders'

/*
 * Provider dependency order (outermost → innermost):
 *
 * FileStoreProvider – owns the connected data folder; everything that reads
 *   or writes user data depends on it.
 *
 * Tier 1 – independent (no context dependencies):
 *   SettingsProvider, LayoutProvider
 *
 * (FileStoreGate blocks Tier 2 until a folder is connected)
 *
 * Tier 2 – need a ready FileStore:
 *   GoalsProvider (uses useProfile hook, not a context)
 *   DataProvider
 *   FlagProvider
 */
const OuterProviders = composeProviders(SettingsProvider, LayoutProvider)

const InnerProviders = composeProviders(GoalsProvider, DataProvider, FlagProvider)

const AppShell: FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { setDarkMode } = useSettings()
  const { pendingDelete, handleUndoDelete, dismissPendingDelete } = useGoals()
  const { enterDemo, exitDemo } = useFileStore()
  const { sidebarOpen, setSidebarOpen, isMobile, searchOpen, setSearchOpen, setSettingsOpenSection } = useLayout()
  const searchIndexData = useSearchIndexData(searchOpen)
  const currentPage: PageType =
    location.pathname === '/goal' || location.pathname.startsWith('/goal/')
      ? 'goal'
      : location.pathname.startsWith('/net-worth')
        ? 'net-worth'
        : location.pathname.startsWith('/budget')
          ? 'budget'
          : location.pathname.startsWith('/transactions')
            ? 'transactions'
            : location.pathname.startsWith('/drive')
              ? 'drive'
              : location.pathname === '/taxes'
                ? 'taxes'
                : location.pathname === '/guide'
                  ? 'guide'
                  : 'home'
  const setCurrentPage = (page: PageType): void => {
    navigate(
      {
        home: '/',
        goal: '/goal',
        'net-worth': '/net-worth',
        budget: '/budget',
        transactions: '/transactions',
        drive: '/drive',
        taxes: '/taxes',
        guide: '/guide',
      }[page] || '/',
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
        case 'open-settings-folder':
          setSettingsOpenSection('folder')
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
          isDemoActive() ? exitDemo() : enterDemo()
          break
      }
    },
    [navigate, setDarkMode, setSettingsOpenSection, enterDemo, exitDemo],
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
            <button onClick={exitDemo}>Exit Demo</button>
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
              path="/budget/*"
              element={
                <ErrorBoundary variant="card" resetKey={location.pathname}>
                  <Budget />
                </ErrorBoundary>
              }
            />
            <Route path="/tools" element={<Navigate to="/budget" replace />} />
            <Route
              path="/transactions/*"
              element={
                <ErrorBoundary variant="card" resetKey={location.pathname}>
                  <Transactions />
                </ErrorBoundary>
              }
            />
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
            <Route
              path="/guide"
              element={
                <ErrorBoundary variant="card" resetKey={location.pathname}>
                  <Guide />
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
        indexData={searchIndexData}
      />
    </div>
  )
}
const FileStoreGate: FC = () => {
  const { isReady } = useFileStore()

  if (!isReady) return <FolderPicker />

  return (
    <InnerProviders>
      <AppShell />
    </InnerProviders>
  )
}

const App: FC = () => (
  <ErrorBoundary variant="page">
    <FileStoreProvider>
      <OuterProviders>
        <FileStoreGate />
      </OuterProviders>
    </FileStoreProvider>
  </ErrorBoundary>
)
export default App
