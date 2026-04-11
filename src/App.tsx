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
import { useGwPlans } from './pages/plan/hooks/useGwPlans'
import { useProfile } from './hooks/useProfile'
import ProfileModal from './components/ProfileModal'
import './styles/colorThemes.css'

interface PlanSoloRouteProps { plans: FinancialPlan[]; profileBirthday: string; updatePlan: (id: number, p: FinancialPlan) => void; onDelete: (id: number) => void }
const PlanSoloRoute: FC<PlanSoloRouteProps> = ({ plans, profileBirthday, updatePlan, onDelete }) => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { gwPlans, createGwPlan, updateGwPlan, deleteGwPlan } = useGwPlans()
  const plan = plans.find(p => p.id === Number(id))
  if (!plan) return <Navigate to="/plan" replace />
  return (
    <PlanSoloPage
      plan={plan}
      plans={plans}
      profileBirthday={profileBirthday}
      onBack={() => navigate('/plan')}
      onNavigate={(planId) => navigate(`/plan/${planId}`)}
      onUpdatePlan={updatePlan}
      onDeletePlan={onDelete}
      gwPlans={gwPlans}
      onCreateGwPlan={createGwPlan}
      onUpdateGwPlan={updateGwPlan}
      onDeleteGwPlan={deleteGwPlan}
    />
  )
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
  const [fiTheme, setFiTheme] = useState(() => localStorage.getItem('fiTheme') || 'blue');
  const [gwTheme, setGwTheme] = useState(() => localStorage.getItem('gwTheme') || 'green');
  const [selectedNavPlanIds, setSelectedNavPlanIds] = useState<number[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const { plans, createPlan, updatePlan, deletePlan, importPlans, reorderPlans } = useFinancialPlans();
  const { profile, updateProfile } = useProfile();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const handleOpenProfile = (): void => setProfileModalOpen(true);

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
    setIsMultiSelectMode(false);
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

  useEffect(() => {
    document.body.dataset.fiTheme = fiTheme;
    localStorage.setItem('fiTheme', fiTheme);
  }, [fiTheme]);

  useEffect(() => {
    document.body.dataset.gwTheme = gwTheme;
    localStorage.setItem('gwTheme', gwTheme);
  }, [gwTheme]);

  const handleSelectNavPlan = (planId: number, multi: boolean): void => {
    if (multi || isMultiSelectMode) {
      if (!isMultiSelectMode) setIsMultiSelectMode(true);
      setSelectedNavPlanIds(prev =>
        prev.includes(planId) ? prev.filter(id => id !== planId) : [...prev, planId]
      );
    } else {
      navigate(`/plan/${planId}`);
      if (isMobile) setSidebarOpen(false);
    }
  };

  const handleExitMultiSelect = (): void => {
    setIsMultiSelectMode(false);
    setSelectedNavPlanIds([]);
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
    const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), plans, profile }, null, 2)
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
        if (parsed?.profile && typeof parsed.profile === 'object') {
          updateProfile(parsed.profile)
        }
      } catch {
        alert('Could not import: the file is not a valid finance plans export.')
      }
    }
    reader.readAsText(file)
  };

  const renderPage = (): React.ReactNode => {
    return (
      <Routes>
        <Route path="/" element={<Home profile={profile} onUpdateProfile={updateProfile} />} />
        <Route
          path="/plan"
          element={
            <Plan
              plans={visiblePlans}
              profileBirthday={profile.birthday}
              createPlan={createPlan}
              updatePlan={updatePlan}
              deletePlan={handleDeletePlan}
              onDeleteMultiplePlans={handleDeleteWithUndo}
              reorderPlans={reorderPlans}
              selectedPlanIds={selectedNavPlanIds}
              onSetSelectedPlanIds={setSelectedNavPlanIds}
              onGoToPlan={handleGoToPlan}
            />
          }
        />
        <Route path="/plan/:id" element={<PlanSoloRoute plans={visiblePlans} profileBirthday={profile.birthday} updatePlan={updatePlan} onDelete={handleDeletePlan} />} />
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
          fiTheme={fiTheme}
          onFiThemeChange={setFiTheme}
          gwTheme={gwTheme}
          onGwThemeChange={setGwTheme}
          plans={visiblePlans}
          selectedNavPlanIds={selectedNavPlanIds}
          isMultiSelectMode={isMultiSelectMode}
          onSelectNavPlan={handleSelectNavPlan}
          onExitMultiSelect={handleExitMultiSelect}
          onRenamePlan={renamePlan}
          onDeletePlan={handleSidebarDeletePlan}
          onDeleteMultiple={handleSidebarDeleteMultiple}
          onReorderPlans={reorderPlans}
          onExport={handleExport}
          onImport={handleImport}
          profile={profile}
          onUpdateProfile={updateProfile}
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
      {profileModalOpen && (
        <ProfileModal
          profile={profile}
          onSave={updateProfile}
          onClose={() => setProfileModalOpen(false)}
        />
      )}
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
