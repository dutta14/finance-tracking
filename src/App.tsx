import { FC, useState, useEffect } from 'react'
import { PageType } from './types'
import SidebarNavigation from './components/SidebarNavigation'
import SidebarToggle from './components/SidebarToggle'
import Home from './pages/Home'
import Plan from './pages/plan/Plan'
import { useFinancialPlans } from './pages/plan/hooks/useFinancialPlans'

const App: FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored === '1') return true;
    if (stored === '0') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [selectedNavPlanId, setSelectedNavPlanId] = useState<number | null>(null);
  const { plans, createPlan, updatePlan, deletePlan } = useFinancialPlans();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode ? '1' : '0');
  }, [darkMode]);

  const handleSelectNavPlan = (planId: number): void => {
    setCurrentPage('plan');
    setSelectedNavPlanId(planId);
    if (isMobile) setSidebarOpen(false);
  };

  const renamePlan = (planId: number, newName: string): void => {
    const plan = plans.find(p => p.id === planId);
    if (plan) updatePlan(planId, { ...plan, planName: newName });
  };

  const handleSidebarDeletePlan = (planId: number): void => {
    deletePlan(planId);
    if (selectedNavPlanId === planId) setSelectedNavPlanId(null);
  };

  const renderPage = (): React.ReactNode => {
    switch (currentPage) {
      case 'plan':
        return (
          <Plan
            plans={plans}
            createPlan={createPlan}
            updatePlan={updatePlan}
            deletePlan={deletePlan}
            selectedNavPlanId={selectedNavPlanId}
            onClearNavPlanId={() => setSelectedNavPlanId(null)}
          />
        );
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
          setCurrentPage={(page) => { setCurrentPage(page); if (isMobile) setSidebarOpen(false); }}
          expanded={sidebarOpen}
          setExpanded={setSidebarOpen}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          plans={plans}
          selectedNavPlanId={selectedNavPlanId}
          onSelectNavPlan={handleSelectNavPlan}
          onRenamePlan={renamePlan}
          onDeletePlan={handleSidebarDeletePlan}
        />
      )}
      {/* Backdrop for mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.4)' }}
        />
      )}
      <main
        className="main-content"
        style={{ flex: 1, marginLeft: (!isMobile && sidebarOpen) ? 220 : 0, padding: 0, minHeight: '100vh', transition: 'margin-left 0.2s' }}
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
