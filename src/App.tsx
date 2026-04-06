import { FC, useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import { PageType, FinancialPlan, GwPlan } from './types'
import SidebarNavigation from './components/SidebarNavigation'
import SidebarToggle from './components/SidebarToggle'
import Home from './pages/Home'
import Plan from './pages/plan/Plan'
import PlanSoloPage from './pages/plan/PlanSoloPage'
import GwUnlockModal from './components/GwUnlockModal'
import UndoToast from './components/UndoToast'
import { useFinancialPlans } from './pages/plan/hooks/useFinancialPlans'
import { useGwPlans } from './pages/plan/hooks/useGwPlans'
import { useProfile } from './hooks/useProfile'
import ProfileModal from './components/ProfileModal'
import { useGitHubSync } from './hooks/useGitHubSync'

interface PlanSoloRouteProps {
  plans: FinancialPlan[]
  profileBirthday: string
  updatePlan: (id: number, p: FinancialPlan) => void
  onDelete: (id: number) => void
  gwPlans: GwPlan[]
  onCreateGwPlan: (plan: Omit<GwPlan, 'id' | 'createdAt'>) => void
  onUpdateGwPlan: (id: number, updates: Partial<Omit<GwPlan, 'id' | 'createdAt' | 'fiPlanId'>>) => void
  onDeleteGwPlan: (id: number) => void
}
const PlanSoloRoute: FC<PlanSoloRouteProps> = ({ plans, profileBirthday, updatePlan, onDelete, gwPlans, onCreateGwPlan, onUpdateGwPlan, onDeleteGwPlan }) => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
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
      onCreateGwPlan={onCreateGwPlan}
      onUpdateGwPlan={onUpdateGwPlan}
      onDeleteGwPlan={onDeleteGwPlan}
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
  const [selectedNavPlanIds, setSelectedNavPlanIds] = useState<number[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const { plans, createPlan, updatePlan, deletePlan, importPlans, reorderPlans } = useFinancialPlans();
  const { gwPlans, createGwPlan, updateGwPlan, deleteGwPlan, deleteGwPlansForFiPlan, importGwPlans } = useGwPlans();
  const { profile, updateProfile } = useProfile();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const {
    config: ghConfig, updateConfig: updateGhConfig, isConfigured: ghIsConfigured,
    syncStatus, lastSyncAt, lastError, hasPendingChanges, history: ghHistory,
    hasStoredToken, tokenUnlocked, usingLegacyToken,
    saveEncryptedToken, migrateLegacyToken, unlockToken, lockToken,
    syncNow, fetchHistory, testConnection, restoreLatest, restoreFromCommit, markRestored, updateData: ghUpdateData,
  } = useGitHubSync();
  const [gwUnlockSeen, setGwUnlockSeen] = useState(
    () => localStorage.getItem('gw-intro-seen') === '1'
  );
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
    deleteGwPlansForFiPlan(planId);
  };

  const handleCopyGwGoals = (sourcePlanId: number, newPlanId: number): void => {
    gwPlans
      .filter(g => g.fiPlanId === sourcePlanId)
      .forEach(g => createGwPlan({ ...g, fiPlanId: newPlanId }))
  };

  const handleGoToPlan = (planId: number): void => {
    navigate(`/plan/${planId}`);
  };

  const handleGoToPlanEdit = (planId: number): void => {
    navigate(`/plan/${planId}?edit=1`);
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

  // Drive auto-sync whenever plans, gwPlans, or profile change
  useEffect(() => {
    ghUpdateData({ version: 2, exportedAt: new Date().toISOString(), plans, gwPlans, profile, gitHubConfig: ghConfig });
  }, [plans, gwPlans, profile, ghConfig]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const json = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), plans, profile, gwPlans }, null, 2)
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
        if (Array.isArray(parsed?.gwPlans)) {
          importGwPlans(parsed.gwPlans as GwPlan[])
        }
      } catch {
        alert('Could not import: the file is not a valid finance plans export.')
      }
    }
    reader.readAsText(file)
  };

  const applyRestoredSnapshot = async (data: unknown): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const parsed = data as { version?: number; plans?: unknown; profile?: unknown; gwPlans?: unknown; gitHubConfig?: unknown }
        
        // Handle both formats: direct array or wrapped object
        const incomingPlans = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.plans) ? parsed.plans : [])
        
        if (!Array.isArray(incomingPlans) || incomingPlans.length === 0) {
          throw new Error('No valid plans data in backup')
        }

        // Import all data into React state
        importPlans(incomingPlans as FinancialPlan[])
        
        let restoreProfile: Partial<typeof profile> = profile
        if (parsed?.profile && typeof parsed.profile === 'object') {
          restoreProfile = parsed.profile as Partial<typeof profile>
          updateProfile(restoreProfile)
        }
        
        let restoreGwPlans: GwPlan[] = []
        if (Array.isArray(parsed?.gwPlans)) {
          restoreGwPlans = parsed.gwPlans as GwPlan[]
          importGwPlans(restoreGwPlans)
        }

        // Restore GitHub config if present (merge with existing token settings)
        let restoredGhConfig = ghConfig
        if (parsed?.gitHubConfig && typeof parsed.gitHubConfig === 'object') {
          const cfg = parsed.gitHubConfig as Record<string, unknown>
          restoredGhConfig = {
            owner: (cfg.owner as string) || '',
            repo: (cfg.repo as string) || '',
            filePath: (cfg.filePath as string) || 'finance-plans.json',
            autoSync: (cfg.autoSync as boolean) || false,
            // Preserve existing token/encryption settings (not restored from backup)
            encryptedToken: ghConfig.encryptedToken,
            tokenSalt: ghConfig.tokenSalt,
            tokenIv: ghConfig.tokenIv,
            legacyToken: ghConfig.legacyToken,
          }
          updateGhConfig(restoredGhConfig)
        }
        
        setSelectedNavPlanIds([])
        setIsMultiSelectMode(false)
        
        // Wait a moment for React state updates to batch, then force localStorage writes
        setTimeout(() => {
          // Explicitly write all data to localStorage to ensure persistence
          // (React's useEffect hooks may not have run yet)
          localStorage.setItem('financial-plans', JSON.stringify(incomingPlans))
          localStorage.setItem('gw-plans', JSON.stringify(restoreGwPlans))
          localStorage.setItem('user-profile', JSON.stringify(restoreProfile || profile))
          
          // For GitHub sync config, preserve the encrypted token fields
          localStorage.setItem('github-sync-config', JSON.stringify(restoredGhConfig))
          
          // Preserve the GW intro seen flag so it doesn't reappear
          localStorage.setItem('gw-intro-seen', '1')
          setGwUnlockSeen(true)
          
          // Mark the restore as complete
          markRestored()
          
          // Give localStorage time to write before resolving
          // (don't show alert - modal will display restoreResult message)
          setTimeout(() => {
            resolve()
          }, 100)
        }, 300)
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error'
        console.error('Restore error:', errorMsg, e)
        // Error will be displayed by restoreResult in the modal
        resolve()
      }
    })
  }

  const handleFactoryReset = (): void => {
    // Clear all app data
    localStorage.clear()
    // Reload the page to reset the app state
    window.location.reload()
  }

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
              onOpenProfile={handleOpenProfile}
              createPlan={createPlan}
              updatePlan={updatePlan}
              deletePlan={handleDeletePlan}
              onDeleteMultiplePlans={handleDeleteWithUndo}
              reorderPlans={reorderPlans}
              selectedPlanIds={selectedNavPlanIds}
              onSetSelectedPlanIds={setSelectedNavPlanIds}
              onGoToPlan={handleGoToPlan}
              onGoToPlanEdit={handleGoToPlanEdit}
              onCopyGwGoals={handleCopyGwGoals}
              gwPlans={gwPlans}
              onCreateGwPlan={createGwPlan}
            />
          }
        />
        <Route path="/plan/:id" element={
          <PlanSoloRoute
            plans={visiblePlans}
            profileBirthday={profile.birthday}
            updatePlan={updatePlan}
            onDelete={handleDeletePlan}
            gwPlans={gwPlans}
            onCreateGwPlan={createGwPlan}
            onUpdateGwPlan={updateGwPlan}
            onDeleteGwPlan={deleteGwPlan}
          />
        } />
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
          hasPendingGitHubChanges={hasPendingChanges}
          ghConfig={ghConfig}
          ghIsConfigured={ghIsConfigured}
          ghSyncStatus={syncStatus}
          ghLastSyncAt={lastSyncAt}
          ghLastError={lastError}
          ghHistory={ghHistory}
          ghHasStoredToken={hasStoredToken}
          ghTokenUnlocked={tokenUnlocked}
          ghUsingLegacyToken={usingLegacyToken}
          onGhUpdateConfig={updateGhConfig}
          onGhSaveEncryptedToken={saveEncryptedToken}
          onGhMigrateLegacyToken={migrateLegacyToken}
          onGhUnlockToken={unlockToken}
          onGhLockToken={lockToken}
          onGhSyncNow={syncNow}
          onGhFetchHistory={fetchHistory}
          onGhTestConnection={testConnection}
          onGhRestoreLatest={restoreLatest}
          onGhRestoreFromCommit={restoreFromCommit}
          ghDataToSync={{ version: 2, exportedAt: new Date().toISOString(), plans, profile, gwPlans }}
          onGhApplyRestore={applyRestoredSnapshot}
          onFactoryReset={handleFactoryReset}
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
      {!gwUnlockSeen && visiblePlans.some(p => p.fiGoal > 0) && (
        <GwUnlockModal
          onDismiss={() => {
            localStorage.setItem('gw-intro-seen', '1');
            setGwUnlockSeen(true);
          }}
        />
      )}
    </div>
  );
}

export default App
