import { FC, useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import { PageType, FinancialGoal, GwGoal } from './types'
import SidebarNavigation from './components/SidebarNavigation'
import SidebarToggle from './components/SidebarToggle'
import Home from './pages/Home'
import Goal from './pages/goal/Goal'
import GoalSoloPage from './pages/goal/GoalSoloPage'
import UndoToast from './components/UndoToast'
import { useFinancialGoals } from './pages/goal/hooks/useFinancialGoals'
import { useGwGoals } from './pages/goal/hooks/useGwGoals'
import { useProfile } from './hooks/useProfile'
import ProfileModal from './components/ProfileModal'
import './styles/colorThemes.css'

interface GoalSoloRouteProps { goals: FinancialGoal[]; profileBirthday: string; updateGoal: (id: number, p: FinancialGoal) => void; onDelete: (id: number) => void; gwGoals: GwGoal[]; createGwGoal: (p: Omit<GwGoal, 'id' | 'createdAt'>) => void; updateGwGoal: (id: number, u: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void; deleteGwGoal: (id: number) => void }
const GoalSoloRoute: FC<GoalSoloRouteProps> = ({ goals, profileBirthday, updateGoal, onDelete, gwGoals, createGwGoal, updateGwGoal, deleteGwGoal }) => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const goal = goals.find(p => p.id === Number(id))
  if (!goal) return <Navigate to="/goal" replace />
  return (
    <GoalSoloPage
      goal={goal}
      goals={goals}
      profileBirthday={profileBirthday}
      onBack={() => navigate('/goal')}
      onNavigate={(goalId) => navigate(`/goal/${goalId}`)}
      onUpdateGoal={updateGoal}
      onDeleteGoal={onDelete}
      gwGoals={gwGoals}
      onCreateGwGoal={createGwGoal}
      onUpdateGwGoal={updateGwGoal}
      onDeleteGwGoal={deleteGwGoal}
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
  const [homeTheme, setHomeTheme] = useState(() => localStorage.getItem('homeTheme') || 'blue');
  const [selectedNavGoalIds, setSelectedNavGoalIds] = useState<number[]>([]);
  const [selectedHomeGoalIds, setSelectedHomeGoalIds] = useState<number[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const { goals, createGoal, updateGoal, deleteGoal, importGoals, reorderGoals } = useFinancialGoals();
  const { gwGoals, createGwGoal, updateGwGoal, deleteGwGoal } = useGwGoals();
  const { profile, updateProfile } = useProfile();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const handleOpenProfile = (): void => setProfileModalOpen(true);

  // Derive currentPage from URL for sidebar nav compat
  const currentPage: PageType = location.pathname.startsWith('/goal/')
    ? 'goal-solo'
    : location.pathname === '/goal'
    ? 'goal'
    : 'home'

  const setCurrentPage = (page: PageType): void => {
    if (page === 'home') navigate('/')
    else if (page === 'goal') navigate('/goal')
  }

  const [pendingDelete, setPendingDelete] = useState<{
    ids: number[]
    savedGoals: FinancialGoal[]
    message: string
    timerId: ReturnType<typeof setTimeout>
  } | null>(null);

  const visibleGoals = pendingDelete
    ? goals.filter(p => !pendingDelete.ids.includes(p.id))
    : goals;

  const handleDeleteWithUndo = (ids: number[]): void => {
    // Commit any existing pending delete before starting a new one
    if (pendingDelete) {
      clearTimeout(pendingDelete.timerId);
      pendingDelete.ids.forEach(id => deleteGoal(id));
      setPendingDelete(null);
    }
    const affectedGoals = goals.filter(p => ids.includes(p.id));
    const name = affectedGoals[0]?.goalName ?? 'Goal';
    const message = ids.length === 1 ? `"${name}" deleted` : `${ids.length} goals deleted`;
    const timerId = setTimeout(() => {
      ids.forEach(id => deleteGoal(id));
      setPendingDelete(null);
    }, 10_000);
    setSelectedNavGoalIds(prev => prev.filter(id => !ids.includes(id)));
    setSelectedHomeGoalIds(prev => prev.filter(id => !ids.includes(id)));
    setIsMultiSelectMode(false);
    setPendingDelete({ ids, savedGoals: affectedGoals, message, timerId });
  };

  const handleUndoDelete = (): void => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    setPendingDelete(null);
  };

  const handleDeleteGoal = (goalId: number): void => {
    handleDeleteWithUndo([goalId]);
  };

  const handleGoToGoal = (goalId: number): void => {
    setSelectedNavGoalIds([goalId]);
    navigate(`/goal/${goalId}`);
  };

  const handleGoToGoalEdit = (goalId: number): void => {
    setSelectedNavGoalIds([goalId]);
    navigate(`/goal/${goalId}?edit=1`);
  };

  const handleGoToGoalAddGw = (goalId: number): void => {
    setSelectedNavGoalIds([goalId]);
    navigate(`/goal/${goalId}?gw=1`);
  };

  const handleCopyGwGoals = (sourcePlanId: number, newPlanId: number): void => {
    gwGoals
      .filter(g => g.fiGoalId === sourcePlanId)
      .forEach(g => createGwGoal({ fiGoalId: newPlanId, label: g.label, disburseAge: g.disburseAge, disburseAmount: g.disburseAmount, growthRate: g.growthRate, currentSavings: 0 }))
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

  useEffect(() => {
    document.body.dataset.homeTheme = homeTheme;
    localStorage.setItem('homeTheme', homeTheme);
  }, [homeTheme]);

  // Sync nav pane selection with solo page URL (handles prev/next navigation)
  useEffect(() => {
    const match = location.pathname.match(/^\/goal\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      setSelectedNavGoalIds([id]);
    } else {
      setSelectedNavGoalIds([]);
    }
  }, [location.pathname]);

  const handleSelectNavGoal = (goalId: number, multi: boolean): void => {
    if (multi || isMultiSelectMode) {
      if (!isMultiSelectMode) setIsMultiSelectMode(true);
      setSelectedNavGoalIds(prev =>
        prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]
      );
    } else {
      setSelectedNavGoalIds([goalId]);
      navigate(`/goal/${goalId}`);
      if (isMobile) setSidebarOpen(false);
    }
  };

  const handleExitMultiSelect = (): void => {
    setIsMultiSelectMode(false);
    setSelectedNavGoalIds([]);
  };

  const renameGoal = (goalId: number, newName: string): void => {
    const goal = goals.find(p => p.id === goalId);
    if (goal) updateGoal(goalId, { ...goal, goalName: newName });
  };

  const handleSidebarDeleteGoal = (goalId: number): void => {
    handleDeleteWithUndo([goalId]);
  };

  const handleSidebarDeleteMultiple = (ids: number[]): void => {
    handleDeleteWithUndo(ids);
  };

  const handleExport = (): void => {
    const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), goals, profile }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-goals-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  };

  const handleImport = (file: File): void => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        const incoming = Array.isArray(parsed) ? parsed : (parsed?.goals || parsed?.plans)
        if (!Array.isArray(incoming)) throw new Error('Invalid format')
        importGoals(incoming)
        setSelectedNavGoalIds([])
        setSelectedHomeGoalIds([])
        if (parsed?.profile && typeof parsed.profile === 'object') {
          updateProfile(parsed.profile)
        }
      } catch {
        alert('Could not import: the file is not a valid finance goals export.')
      }
    }
    reader.readAsText(file)
  };

  const renderPage = (): React.ReactNode => {
    return (
      <Routes>
        <Route path="/" element={<Home profile={profile} onUpdateProfile={updateProfile} />} />
        <Route
          path="/goal"
          element={
            <Goal
              goals={visibleGoals}
              profileBirthday={profile.birthday}
              onOpenProfile={handleOpenProfile}
              createGoal={createGoal}
              updateGoal={updateGoal}
              deleteGoal={handleDeleteGoal}
              onDeleteMultipleGoals={handleDeleteWithUndo}
              reorderGoals={reorderGoals}
              selectedGoalIds={selectedHomeGoalIds}
              onSetSelectedGoalIds={setSelectedHomeGoalIds}
              onGoToGoal={handleGoToGoal}
              onGoToGoalEdit={handleGoToGoalEdit}
              onGoToGoalAddGw={handleGoToGoalAddGw}
              onCopyGwGoals={handleCopyGwGoals}
              gwGoals={gwGoals}
              onCreateGwGoal={createGwGoal}
            />
          }
        />
        <Route path="/goal/:id" element={<GoalSoloRoute goals={visibleGoals} profileBirthday={profile.birthday} updateGoal={updateGoal} onDelete={handleDeleteGoal} gwGoals={gwGoals} createGwGoal={createGwGoal} updateGwGoal={updateGwGoal} deleteGwGoal={deleteGwGoal} />} />
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
          homeTheme={homeTheme}
          onHomeThemeChange={setHomeTheme}
          goals={visibleGoals}
          selectedNavGoalIds={selectedNavGoalIds}
          isMultiSelectMode={isMultiSelectMode}
          onSelectNavGoal={handleSelectNavGoal}
          onExitMultiSelect={handleExitMultiSelect}
          onRenameGoal={renameGoal}
          onDeleteGoal={handleSidebarDeleteGoal}
          onDeleteMultiple={handleSidebarDeleteMultiple}
          onReorderGoals={reorderGoals}
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
            pendingDelete.ids.forEach(id => deleteGoal(id));
            setPendingDelete(null);
          }}
          duration={10000}
        />
      )}
    </div>
  );
}

export default App
