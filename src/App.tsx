import { FC, useState, useEffect } from 'react'
import { PageType, FinancialPlan } from './types'
import SidebarNavigation from './components/SidebarNavigation'
import SidebarToggle from './components/SidebarToggle'
import Home from './pages/Home'
import Plan from './pages/plan/Plan'
import PlanSoloPage from './pages/plan/PlanSoloPage'
import UndoToast from './components/UndoToast'
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
  const [selectedNavPlanIds, setSelectedNavPlanIds] = useState<number[]>([]);
  const [soloViewPlanId, setSoloViewPlanId] = useState<number | null>(null);
  const { plans, createPlan, updatePlan, deletePlan } = useFinancialPlans();

  const [pendingDelete, setPendingDelete] = useState<{
    ids: number[]
    savedPlans: FinancialPlan[]
    message: string
    timerId: ReturnType<typeof setTimeout>
  } | null>(null);

  const visiblePlans = pendingDelete
    ? plans.filter(p => !pendingDelete.ids.includes(p.id))
    : plans;

  const handleDeleteWithUndo = (ids: number[]): void => {
    // Commit any existing pending delete before starting a new one
    if (pendingDelete) {
      clearTimeout(pendingDelete.timerId);
      pendingDelete.ids.forEach(id => deletePlan(id));
      setPendingDelete(null);
    }
    const affectedPlans = plans.filter(p => ids.includes(p.id));
    const name = affectedPlans[0]?.planName ?? 'Plan';
    const message = ids.length === 1 ? `"${name}" deleted` : `${ids.length} plans deleted`;
    const timerId = setTimeout(() => {
      ids.forEach(id => deletePlan(id));
      setPendingDelete(null);
    }, 10_000);
    setSelectedNavPlanIds(prev => prev.filter(id => !ids.includes(id)));
    setPendingDelete({ ids, savedPlans: affectedPlans, message, timerId });
  };

  const handleUndoDelete = (): void => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    setPendingDelete(null);
  };

  const handleDeletePlan = (planId: number): void => {
    handleDeleteWithUndo([planId]);
  };

  const handleGoToPlan = (planId: number): void => {
    setSoloViewPlanId(planId);
    setCurrentPage('plan-solo');
  };

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

  const handleSelectNavPlan = (planId: number, multi: boolean): void => {
    setCurrentPage('plan');
    if (multi) {
      setSelectedNavPlanIds(prev =>
        prev.includes(planId) ? prev.filter(id => id !== planId) : [...prev, planId]
      );
    } else {
      setSelectedNavPlanIds([planId]);
      if (isMobile) setSidebarOpen(false);
    }
  };

  const renamePlan = (planId: number, newName: string): void => {
    const plan = plans.find(p => p.id === planId);
    if (plan) updatePlan(planId, { ...plan, planName: newName });
  };

  const handleSidebarDeletePlan = (planId: number): void => {
    handleDeleteWithUndo([planId]);
  };

  const handleSidebarDeleteMultiple = (ids: number[]): void => {
    handleDeleteWithUndo(ids);
  };

  const renderPage = (): React.ReactNode => {
    switch (currentPage) {
      case 'plan':
        return (
          <Plan
            plans={visiblePlans}
            createPlan={createPlan}
            updatePlan={updatePlan}
            deletePlan={handleDeletePlan}
            onDeleteMultiplePlans={handleDeleteWithUndo}
            selectedPlanIds={selectedNavPlanIds}
            onSetSelectedPlanIds={setSelectedNavPlanIds}
            onGoToPlan={handleGoToPlan}
          />
        );
      case 'plan-solo': {
        const soloPlan = plans.find(p => p.id === soloViewPlanId);
        if (!soloPlan) { setCurrentPage('plan'); return null; }
        return <PlanSoloPage plan={soloPlan} onBack={() => setCurrentPage('plan')} />;
      }
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
          plans={visiblePlans}
          selectedNavPlanIds={selectedNavPlanIds}
          onSelectNavPlan={handleSelectNavPlan}
          onRenamePlan={renamePlan}
          onDeletePlan={handleSidebarDeletePlan}
          onDeleteMultiple={handleSidebarDeleteMultiple}
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
      {pendingDelete && (
        <UndoToast
          message={pendingDelete.message}
          onUndo={handleUndoDelete}
          onDismiss={() => {
            clearTimeout(pendingDelete.timerId);
            pendingDelete.ids.forEach(id => deletePlan(id));
            setPendingDelete(null);
          }}
          duration={10000}
        />
      )}
    </div>
  );
}

export default App
