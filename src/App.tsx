import { FC, useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import { PageType, FinancialGoal, GwGoal } from './types'
import SidebarNavigation from './components/SidebarNavigation'
import SidebarToggle from './components/SidebarToggle'
import Home from './pages/home/Home'
import Goal from './pages/goal/Goal'
import GoalSoloPage from './pages/goal/GoalSoloPage'
import Data from './pages/data/Data'
import Budget from './pages/budget/Budget'
import Tools from './pages/tools/Tools'
import Drive from './pages/drive/Drive'
import Allocation from './pages/allocation/Allocation'
import Taxes from './pages/taxes/Taxes'
import { loadBudgetStore, getBudgetConfigData, saveBudgetStore } from './pages/budget/utils/budgetStorage'
import { syncAllBudgetCSVs, uploadBudgetConfig, downloadAllBudgetCSVs, downloadBudgetConfig } from './pages/budget/utils/budgetGitHubSync'
import { syncAllTaxFiles } from './pages/taxes/taxGitHubSync'
import type { Account, BalanceEntry } from './pages/data/types'
import UndoToast from './components/UndoToast'
import { isDemoActive, exitDemoMode } from './pages/settings/demoMode'
import { useFinancialGoals } from './pages/goal/hooks/useFinancialGoals'
import { useGwGoals } from './pages/goal/hooks/useGwGoals'
import { useProfile } from './hooks/useProfile'
import { useGitHubSync } from './hooks/useGitHubSync'
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
  const [accentTheme, setAccentTheme] = useState(() => localStorage.getItem('accentTheme') || localStorage.getItem('fiTheme') || 'blue');
  const [allowCsvImport, setAllowCsvImport] = useState(() => localStorage.getItem('allowCsvImport') === '1');
  const [selectedNavGoalIds, setSelectedNavGoalIds] = useState<number[]>([]);
  const [selectedHomeGoalIds, setSelectedHomeGoalIds] = useState<number[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const { goals, createGoal, updateGoal, deleteGoal, importGoals, reorderGoals } = useFinancialGoals();
  const { gwGoals, createGwGoal, updateGwGoal, deleteGwGoal, importGwGoals } = useGwGoals();
  const { profile, updateProfile } = useProfile();
  const {
    config: ghConfig, updateConfig: updateGhConfig, isConfigured: ghIsConfigured,
    syncStatus, lastSyncAt, lastError, hasPendingChanges: hasPendingGhChanges, history: ghHistory,
    hasStoredToken, tokenUnlocked, usingLegacyToken, activeToken: ghActiveToken,
    saveEncryptedToken, migrateLegacyToken, unlockToken, lockToken,
    syncNow, fetchHistory, testConnection, restoreLatest, restoreFromCommit, markRestored, updateData: ghUpdateData,
    updateDataFile: ghUpdateDataFile, syncDataNow: ghSyncDataNow, restoreDataLatest,
    syncToolsNow: ghSyncToolsNow, restoreToolsLatest,
    syncAllocationNow: ghSyncAllocationNow, restoreAllocationLatest,
    syncTaxesNow: ghSyncTaxesNow, restoreTaxesLatest,
  } = useGitHubSync();
  const [settingsOpenSection, setSettingsOpenSection] = useState<string | undefined>();
  const handleOpenProfile = (): void => setSettingsOpenSection('profile');

  // Derive currentPage from URL for sidebar nav compat
  const currentPage: PageType = location.pathname.startsWith('/goal/')
    ? 'goal-solo'
    : location.pathname === '/goal'
    ? 'goal'
    : location.pathname === '/data'
    ? 'data'
    : location.pathname === '/budget'
    ? 'budget'
    : location.pathname === '/tools'
    ? 'tools'
    : location.pathname.startsWith('/drive')
    ? 'drive'
    : location.pathname === '/allocation'
    ? 'allocation'
    : location.pathname === '/taxes'
    ? 'taxes'
    : 'home'

  const setCurrentPage = (page: PageType): void => {
    if (page === 'home') navigate('/')
    else if (page === 'goal') navigate('/goal')
    else if (page === 'data') navigate('/data')
    else if (page === 'budget') navigate('/budget')
    else if (page === 'tools') navigate('/tools')
    else if (page === 'drive') navigate('/drive')
    else if (page === 'allocation') navigate('/allocation')
    else if (page === 'taxes') navigate('/taxes')
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
    document.body.dataset.accentTheme = accentTheme;
    localStorage.setItem('accentTheme', accentTheme);
  }, [accentTheme]);

  useEffect(() => {
    localStorage.setItem('allowCsvImport', allowCsvImport ? '1' : '0');
  }, [allowCsvImport]);

  // Drive auto-sync whenever goals, gwGoals, profile, or themes change
  useEffect(() => {
    ghUpdateData({ version: 2, exportedAt: new Date().toISOString(), goals, gwGoals, profile, settings: { accentTheme, darkMode, allowCsvImport } });
  }, [goals, gwGoals, profile, accentTheme, darkMode, allowCsvImport]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync taxes when tax-store changes
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        const taxStore = JSON.parse(localStorage.getItem('tax-store') || '{}')
        const taxesPayload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          taxStore,
          taxTemplates: JSON.parse(localStorage.getItem('tax-templates') || '[]'),
        }
        await ghSyncTaxesNow(taxesPayload)
        // Also sync individual tax document files
        if (ghIsConfigured && ghActiveToken) {
          await syncAllTaxFiles(ghConfig, ghActiveToken, taxStore).catch(e => console.error('Tax file auto-sync error:', e))
        }
      }, 60_000)
    }
    window.addEventListener('tax-store-changed', handler)
    return () => {
      window.removeEventListener('tax-store-changed', handler)
      if (timer) clearTimeout(timer)
    }
  }, [ghSyncTaxesNow, ghIsConfigured, ghActiveToken, ghConfig])

  // Callback when Data page accounts/balances change → sync data file
  const handleDataChange = (accounts: Account[], balances: BalanceEntry[]): void => {
    ghUpdateDataFile({ version: 1, exportedAt: new Date().toISOString(), accounts, balances });
  };

  const getDataSnapshot = (): { accounts: Account[]; balances: BalanceEntry[] } => {
    try {
      const accounts = JSON.parse(localStorage.getItem('data-accounts') || '[]')
      const balances = JSON.parse(localStorage.getItem('data-balances') || '[]')
      return { accounts, balances }
    } catch { return { accounts: [], balances: [] } }
  };

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

  const handleSyncNow = async (data: object, message?: string): Promise<void> => {
    await syncNow(data, message)
    const dataSnapshot = getDataSnapshot()
    await ghSyncDataNow({ version: 1, exportedAt: new Date().toISOString(), accounts: dataSnapshot.accounts, balances: dataSnapshot.balances }, message ? `Data: ${message}` : undefined)
    // Sync tools data (FI simulations + SGT overrides)
    const toolsPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      fiSimulations: JSON.parse(localStorage.getItem('fi-simulations') || '[]'),
      sgtOverrides: JSON.parse(localStorage.getItem('sgt-overrides') || '{}'),
    }
    await ghSyncToolsNow(toolsPayload, message ? `Tools: ${message}` : undefined)
    // Sync allocation data
    const allocationPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      allocationCustomRatios: JSON.parse(localStorage.getItem('allocation-custom-ratios') || '[]'),
    }
    await ghSyncAllocationNow(allocationPayload, message ? `Allocation: ${message}` : undefined)
    // Small delay to avoid GitHub API 409 conflicts from rapid sequential commits
    await new Promise(r => setTimeout(r, 500))
    // Sync taxes data
    const taxesPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      taxStore: JSON.parse(localStorage.getItem('tax-store') || '{}'),
      taxTemplates: JSON.parse(localStorage.getItem('tax-templates') || '[]'),
    }
    await ghSyncTaxesNow(taxesPayload, message ? `Taxes: ${message}` : undefined)
    // Sync tax document files (PDFs etc.) as individual files
    if (ghIsConfigured && ghActiveToken) {
      const taxStore = JSON.parse(localStorage.getItem('tax-store') || '{}')
      await syncAllTaxFiles(ghConfig, ghActiveToken, taxStore).catch(e => console.error('Tax file sync error:', e))
    }
    // Sync budget data (CSVs + config)
    if (ghIsConfigured && ghActiveToken) {
      const budgetStore = loadBudgetStore()
      await uploadBudgetConfig(ghConfig, ghActiveToken, getBudgetConfigData(budgetStore)).catch(() => {})
      await syncAllBudgetCSVs(ghConfig, ghActiveToken, budgetStore.csvs).catch(() => {})
    }
  };

  const handleExport = (): void => {
    const dataSnapshot = getDataSnapshot()
    const goalViewMode = localStorage.getItem('goal-view-mode') || ''
    const homeCardOrder = localStorage.getItem('home-card-order') || ''
    const budgetStore = loadBudgetStore()
    const budgetConfig = getBudgetConfigData(budgetStore)
    const json = JSON.stringify({
      version: 2, exportedAt: new Date().toISOString(), goals, gwGoals, profile,
      settings: { accentTheme, darkMode, allowCsvImport, goalViewMode, homeCardOrder },
      dataAccounts: dataSnapshot.accounts, dataBalances: dataSnapshot.balances,
      budgetCsvs: budgetStore.csvs, budgetConfig,
      fiSimulations: JSON.parse(localStorage.getItem('fi-simulations') || '[]'),
      sgtOverrides: JSON.parse(localStorage.getItem('sgt-overrides') || '{}'),
      allocationCustomRatios: JSON.parse(localStorage.getItem('allocation-custom-ratios') || '[]'),
      taxStore: JSON.parse(localStorage.getItem('tax-store') || '{}'),
      taxTemplates: JSON.parse(localStorage.getItem('tax-templates') || '[]'),
    }, null, 2)
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
        if (Array.isArray(parsed?.gwGoals || parsed?.gwPlans)) {
          importGwGoals((parsed.gwGoals || parsed.gwPlans) as GwGoal[])
        }
        if (parsed?.settings && typeof parsed.settings === 'object') {
          const s = parsed.settings as Record<string, string>
          if (s.accentTheme) setAccentTheme(s.accentTheme)
          else if (s.fiTheme) setAccentTheme(s.fiTheme)
          if (s.darkMode !== undefined) setDarkMode(!!s.darkMode)
          if (s.allowCsvImport !== undefined) setAllowCsvImport(!!s.allowCsvImport)
          if (s.goalViewMode) localStorage.setItem('goal-view-mode', s.goalViewMode as string)
        }
        if (Array.isArray(parsed?.dataAccounts)) {
          localStorage.setItem('data-accounts', JSON.stringify(parsed.dataAccounts))
        }
        if (Array.isArray(parsed?.dataBalances)) {
          localStorage.setItem('data-balances', JSON.stringify(parsed.dataBalances))
        }
        if (parsed?.budgetCsvs && typeof parsed.budgetCsvs === 'object') {
          const store = loadBudgetStore()
          store.csvs = parsed.budgetCsvs as typeof store.csvs
          saveBudgetStore(store)
        }
        if (parsed?.budgetConfig && typeof parsed.budgetConfig === 'object') {
          localStorage.setItem('budget-config', JSON.stringify(parsed.budgetConfig))
        }
        if (Array.isArray(parsed?.fiSimulations)) {
          localStorage.setItem('fi-simulations', JSON.stringify(parsed.fiSimulations))
        }
        if (parsed?.sgtOverrides && typeof parsed.sgtOverrides === 'object') {
          localStorage.setItem('sgt-overrides', JSON.stringify(parsed.sgtOverrides))
        }
        if (Array.isArray(parsed?.allocationCustomRatios)) {
          localStorage.setItem('allocation-custom-ratios', JSON.stringify(parsed.allocationCustomRatios))
        }
        if (parsed?.taxStore && typeof parsed.taxStore === 'object') {
          localStorage.setItem('tax-store', JSON.stringify(parsed.taxStore))
        }
        if (Array.isArray(parsed?.taxTemplates)) {
          localStorage.setItem('tax-templates', JSON.stringify(parsed.taxTemplates))
        }
        if (parsed?.settings?.homeCardOrder) {
          localStorage.setItem('home-card-order', parsed.settings.homeCardOrder as string)
        }
      } catch {
        alert('Could not import: the file is not a valid finance goals export.')
      }
    }
    reader.readAsText(file)
  };

  const applyRestoredSnapshot = async (data: unknown): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const parsed = data as { version?: number; goals?: unknown; plans?: unknown; profile?: unknown; gwGoals?: unknown; gwPlans?: unknown; settings?: unknown; gitHubConfig?: unknown }
        const incomingGoals = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.goals) ? parsed.goals : Array.isArray(parsed?.plans) ? parsed.plans : [])
        if (!Array.isArray(incomingGoals) || incomingGoals.length === 0) {
          throw new Error('No valid goals data in backup')
        }
        importGoals(incomingGoals as FinancialGoal[])
        let restoreProfile: Partial<typeof profile> = profile
        if (parsed?.profile && typeof parsed.profile === 'object') {
          restoreProfile = parsed.profile as Partial<typeof profile>
          updateProfile(restoreProfile)
        }
        let restoreGwGoals: GwGoal[] = []
        if (Array.isArray(parsed?.gwGoals || parsed?.gwPlans)) {
          restoreGwGoals = ((parsed.gwGoals || parsed.gwPlans) as GwGoal[])
          importGwGoals(restoreGwGoals)
        }
        if (parsed?.settings && typeof parsed.settings === 'object') {
          const s = parsed.settings as Record<string, unknown>
          if (s.accentTheme) setAccentTheme(s.accentTheme as string)
          else if (s.fiTheme) setAccentTheme(s.fiTheme as string)
          if (s.darkMode !== undefined) setDarkMode(!!s.darkMode)
          if (s.allowCsvImport !== undefined) setAllowCsvImport(!!s.allowCsvImport)
          if (s.goalViewMode) localStorage.setItem('goal-view-mode', s.goalViewMode as string)
          if (s.homeCardOrder) localStorage.setItem('home-card-order', s.homeCardOrder as string)
        }
        let restoredGhConfig = ghConfig
        if (parsed?.gitHubConfig && typeof parsed.gitHubConfig === 'object') {
          const cfg = parsed.gitHubConfig as Record<string, unknown>
          restoredGhConfig = {
            owner: (cfg.owner as string) || '',
            repo: (cfg.repo as string) || '',
            filePath: (cfg.filePath as string) || 'finance-goals.json',
            autoSync: (cfg.autoSync as boolean) || false,
            encryptedToken: ghConfig.encryptedToken,
            tokenSalt: ghConfig.tokenSalt,
            tokenIv: ghConfig.tokenIv,
            legacyToken: ghConfig.legacyToken,
          }
          updateGhConfig(restoredGhConfig)
        }
        setSelectedNavGoalIds([])
        setSelectedHomeGoalIds([])
        setIsMultiSelectMode(false)
        setTimeout(() => {
          localStorage.setItem('financialGoals', JSON.stringify(incomingGoals))
          localStorage.setItem('gw-goals', JSON.stringify(restoreGwGoals))
          localStorage.setItem('user-profile', JSON.stringify(restoreProfile || profile))
          localStorage.setItem('github-sync-config', JSON.stringify(restoredGhConfig))
          // Also restore data file from GitHub
          restoreDataLatest().then(dataResult => {
            if (dataResult.ok && dataResult.data) {
              const d = dataResult.data as { accounts?: unknown; balances?: unknown }
              if (Array.isArray(d.accounts)) localStorage.setItem('data-accounts', JSON.stringify(d.accounts))
              if (Array.isArray(d.balances)) localStorage.setItem('data-balances', JSON.stringify(d.balances))
            }
          }).then(() => {
            // Also restore budget from GitHub
            return (async () => {
              if (ghIsConfigured && ghActiveToken) {
                const [csvResult, configResult] = await Promise.all([
                  downloadAllBudgetCSVs(ghConfig, ghActiveToken).catch(() => ({ ok: false as const })),
                  downloadBudgetConfig(ghConfig, ghActiveToken).catch(() => ({ ok: false as const })),
                ])
                const budgetStore = loadBudgetStore()
                if (csvResult.ok && 'csvs' in csvResult && csvResult.csvs) {
                  Object.entries(csvResult.csvs).forEach(([monthKey, csv]) => {
                    budgetStore.csvs[monthKey] = { month: monthKey, csv, uploadedAt: new Date().toISOString() }
                  })
                }
                if (configResult.ok && 'data' in configResult && configResult.data) {
                  budgetStore.years = configResult.data.years || budgetStore.years
                  budgetStore.categoryGroups = configResult.data.categoryGroups || budgetStore.categoryGroups
                }
                saveBudgetStore(budgetStore)
              }
            })()
          }).then(() => {
            // Also restore tools data from GitHub
            return restoreToolsLatest().then(toolsResult => {
              if (toolsResult.ok && toolsResult.data) {
                const t = toolsResult.data as { fiSimulations?: unknown; sgtOverrides?: unknown }
                if (Array.isArray(t.fiSimulations)) localStorage.setItem('fi-simulations', JSON.stringify(t.fiSimulations))
                if (t.sgtOverrides && typeof t.sgtOverrides === 'object') localStorage.setItem('sgt-overrides', JSON.stringify(t.sgtOverrides))
              }
            })
          }).then(() => {
            // Also restore allocation data from GitHub
            return restoreAllocationLatest().then(allocResult => {
              if (allocResult.ok && allocResult.data) {
                const a = allocResult.data as { allocationCustomRatios?: unknown }
                if (Array.isArray(a.allocationCustomRatios)) localStorage.setItem('allocation-custom-ratios', JSON.stringify(a.allocationCustomRatios))
              }
            })
          }).then(() => {
            // Also restore taxes data from GitHub
            return restoreTaxesLatest().then(taxResult => {
              if (taxResult.ok && taxResult.data) {
                const t = taxResult.data as { taxStore?: unknown; taxTemplates?: unknown }
                if (t.taxStore && typeof t.taxStore === 'object') localStorage.setItem('tax-store', JSON.stringify(t.taxStore))
                if (Array.isArray(t.taxTemplates)) localStorage.setItem('tax-templates', JSON.stringify(t.taxTemplates))
              }
            })
          }).then(() => {
            // Reload so all React components pick up the restored localStorage data
            setTimeout(() => { resolve(); window.location.reload() }, 100)
          }).catch(() => {
            markRestored()
            setTimeout(() => { resolve(); window.location.reload() }, 100)
          })
        }, 300)
      } catch (e) {
        console.error('Restore error:', e instanceof Error ? e.message : e)
        resolve()
      }
    })
  };

  const handleFactoryReset = (): void => {
    localStorage.clear()
    window.location.reload()
  };

  const renderPage = (): React.ReactNode => {
    return (
      <Routes>
        <Route path="/" element={<Home profile={profile} goals={visibleGoals} gwGoals={gwGoals} onGoToGoal={handleGoToGoal} />} />
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
        <Route path="/data" element={<Data profile={profile} allowCsvImport={allowCsvImport} onDataChange={handleDataChange} />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/drive/*" element={<Drive />} />
        <Route path="/allocation" element={<Allocation />} />
        <Route path="/taxes" element={<Taxes />} />
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
          fiTheme={accentTheme}
          onFiThemeChange={setAccentTheme}
          gwTheme={accentTheme}
          onGwThemeChange={setAccentTheme}
          homeTheme={accentTheme}
          onHomeThemeChange={setAccentTheme}
          goals={visibleGoals}
          selectedNavGoalIds={selectedNavGoalIds}
          isMultiSelectMode={isMultiSelectMode}
          onSelectNavGoal={handleSelectNavGoal}
          onExitMultiSelect={handleExitMultiSelect}
          onRenameGoal={renameGoal}
          onDeleteGoal={handleSidebarDeleteGoal}
          onDeleteMultiple={handleSidebarDeleteMultiple}
          onReorderGoals={reorderGoals}
          onExport={handleExport}
          onImport={handleImport}
          profile={profile}
          onUpdateProfile={updateProfile}
          hasPendingGitHubChanges={hasPendingGhChanges}
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
          onGhSyncNow={handleSyncNow}
          onGhFetchHistory={fetchHistory}
          onGhTestConnection={testConnection}
          onGhRestoreLatest={restoreLatest}
          onGhRestoreFromCommit={restoreFromCommit}
          ghDataToSync={{ version: 2, exportedAt: new Date().toISOString(), goals, gwGoals, profile, settings: { accentTheme, darkMode, allowCsvImport, goalViewMode: localStorage.getItem('goal-view-mode') || '', homeCardOrder: localStorage.getItem('home-card-order') || '' } }}
          onGhApplyRestore={applyRestoredSnapshot}
          onFactoryReset={handleFactoryReset}
          allowCsvImport={allowCsvImport}
          onToggleAllowCsvImport={() => setAllowCsvImport(v => !v)}
          settingsOpenToSection={settingsOpenSection}
          onSettingsExternalClose={() => setSettingsOpenSection(undefined)}
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
        className={`main-content${!sidebarOpen ? ' sidebar-closed' : ''}`}
        style={{ flex: 1, marginLeft: (!isMobile && sidebarOpen) ? 220 : 0, padding: 0, minHeight: '100vh', transition: 'margin-left 0.2s' }}
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
        {renderPage()}
      </main>
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
