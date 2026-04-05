import { FC, useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import { PageType, FinancialPlan } from './types'
import SidebarNavigation from './components/SidebarNavigation'
import SidebarToggle from './components/SidebarToggle'
import Home from './pages/Home'
import Plan from './pages/plan/Plan'
import PlanSoloPage from './pages/plan/PlanSoloPage'
import UndoToast from './components/UndoToast'
import { useFinancialPlans } from './pages/plan/hooks/useFinancialPlans'

interface PlanSoloRouteProps { plans: FinancialPlan[] }
const PlanSoloRoute: FC<PlanSoloRouteProps> = ({ plans }) => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const plan = plans.find(p => p.id === Number(id))
  if (!plan) return <Navigate to="/plan" replace />
  return <PlanSoloPage plan={plan} onBack={() => navigate('/plan')} />
}

const App: FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored === '1') return true;
    if (stored === '0') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [selectedNavPlanIds, setSelectedNavPlanIds] = useState<number[]>([]);
  const { plans, createPlan, updatePlan, deletePlan, importPlans } = useFinancialPlans();

  // Derive currentPage from URL for sidebar nav compat
  const currentPage: PageType = location.pathname.startsWith('/plan/')
    ? 'plan-solo'
    : location.pathname === '/plan'
    ? 'plan'
    : 'home'

  const setCurrentPage = (page: PageType): void => {
    if (page === 'home') navigate('/')
    else if (page === 'plan') navigate('/plan')
  }

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
    navigate(`/plan/${planId}`);
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
    navigate('/plan');
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

  const handleExport = (): void => {
    const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), plans }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-plans-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  };

  const handleImport = (file: File): void => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        const incoming = Array.isArray(parsed) ? parsed : parsed?.plans
        if (!Array.isArray(incoming)) throw new Error('Invalid format')
        importPlans(incoming)
        setSelectedNavPlanIds([])
      } catch {
        alert('Could not import: the file is not a valid finance plans export.')
      }
    }
    reader.readAsText(file)
  };

  const renderPage = (): React.ReactNode => {
    return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/plan"
          element={
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
          }
        />
        <Route path="/plan/:id" element={<PlanSoloRoute plans={visiblePlans} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
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
          onExport={handleExport}
          onImport={handleImport}
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
