import { FC, useState } from 'react'
import { PageType } from './types'
import SidebarNavigation from './components/SidebarNavigation'
import SidebarToggle from './components/SidebarToggle'
import Home from './pages/Home'
import Plan from './pages/plan/Plan'

const App: FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderPage = (): React.ReactNode => {
    switch (currentPage) {
      case 'plan':
        return <Plan />;
      case 'home':
      default:
        return <Home />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {sidebarOpen && (
        <SidebarNavigation
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          expanded={sidebarOpen}
          setExpanded={setSidebarOpen}
        />
      )}
      <main
        className="main-content"
        style={{ flex: 1, marginLeft: sidebarOpen ? 220 : 0, padding: 0, minHeight: '100vh', transition: 'margin-left 0.2s' }}
      >
        {!sidebarOpen && (
          <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 300 }}>
            <SidebarToggle expanded={false} onToggle={() => setSidebarOpen(true)} />
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
}

export default App
