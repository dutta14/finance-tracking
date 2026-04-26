import { createContext, useContext, useCallback, useMemo, FC, ReactNode } from 'react'
import { GwGoal } from '../types'
import { useGoals } from './GoalsContext'
import { useSettings } from './SettingsContext'
import { loadBudgetStore, saveBudgetStore } from '../pages/budget/utils/budgetStorage'

export interface ImportExportContextValue {
  handleExport: () => void
  handleImport: (file: File) => void
  handleFactoryReset: () => void
}

const ImportExportContext = createContext<ImportExportContextValue | null>(null)

export const useImportExport = (): ImportExportContextValue => {
  const ctx = useContext(ImportExportContext)
  if (!ctx) {
    throw new Error(
      'useImportExport must be used within an <ImportExportProvider>. Wrap a parent component in <ImportExportProvider> before calling useImportExport().',
    )
  }
  return ctx
}

export const ImportExportProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { goals, gwGoals, profile, importGoals, importGwGoals, updateProfile } = useGoals()
  const { darkMode, setDarkMode, accentTheme, setAccentTheme, allowCsvImport, setAllowCsvImport } = useSettings()

  const handleExport = useCallback((): void => {
    const dataSnapshot = (() => {
      try {
        return {
          accounts: JSON.parse(localStorage.getItem('data-accounts') || '[]'),
          balances: JSON.parse(localStorage.getItem('data-balances') || '[]'),
        }
      } catch {
        return { accounts: [], balances: [] }
      }
    })()
    const budgetStore = loadBudgetStore()
    const json = JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        goals,
        gwGoals,
        profile,
        settings: {
          accentTheme,
          darkMode,
          allowCsvImport,
          goalViewMode: localStorage.getItem('goal-view-mode') || '',
          homeCardOrder: localStorage.getItem('home-card-order') || '',
        },
        dataAccounts: dataSnapshot.accounts,
        dataBalances: dataSnapshot.balances,
        budgetCsvs: budgetStore.csvs,
        budgetConfig: { years: budgetStore.years, categoryGroups: budgetStore.categoryGroups },
        fiSimulations: JSON.parse(localStorage.getItem('fi-simulations') || '[]'),
        sgtOverrides: JSON.parse(localStorage.getItem('sgt-overrides') || '{}'),
        allocationCustomRatios: JSON.parse(localStorage.getItem('allocation-custom-ratios') || '[]'),
        taxStore: JSON.parse(localStorage.getItem('tax-store') || '{}'),
        taxTemplates: JSON.parse(localStorage.getItem('tax-templates') || '[]'),
      },
      null,
      2,
    )
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-goals-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [goals, gwGoals, profile, accentTheme, darkMode, allowCsvImport])

  const handleImport = useCallback(
    (file: File): void => {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const parsed = JSON.parse(e.target?.result as string)
          const incoming = Array.isArray(parsed) ? parsed : parsed?.goals || parsed?.plans
          if (!Array.isArray(incoming)) throw new Error('Invalid format')
          importGoals(incoming)
          if (parsed?.profile && typeof parsed.profile === 'object') updateProfile(parsed.profile)
          if (Array.isArray(parsed?.gwGoals || parsed?.gwPlans))
            importGwGoals((parsed.gwGoals || parsed.gwPlans) as GwGoal[])
          if (parsed?.settings && typeof parsed.settings === 'object') {
            const s = parsed.settings as Record<string, string>
            if (s.accentTheme) setAccentTheme(s.accentTheme)
            else if (s.fiTheme) setAccentTheme(s.fiTheme)
            if (s.darkMode !== undefined) setDarkMode(!!s.darkMode)
            if (s.allowCsvImport !== undefined) setAllowCsvImport(!!s.allowCsvImport)
            if (s.goalViewMode) localStorage.setItem('goal-view-mode', s.goalViewMode as string)
          }
          if (Array.isArray(parsed?.dataAccounts))
            localStorage.setItem('data-accounts', JSON.stringify(parsed.dataAccounts))
          if (Array.isArray(parsed?.dataBalances))
            localStorage.setItem('data-balances', JSON.stringify(parsed.dataBalances))
          if (parsed?.budgetCsvs && typeof parsed.budgetCsvs === 'object') {
            const store = loadBudgetStore()
            store.csvs = parsed.budgetCsvs as typeof store.csvs
            saveBudgetStore(store)
          }
          if (parsed?.budgetConfig && typeof parsed.budgetConfig === 'object')
            localStorage.setItem('budget-config', JSON.stringify(parsed.budgetConfig))
          if (Array.isArray(parsed?.fiSimulations))
            localStorage.setItem('fi-simulations', JSON.stringify(parsed.fiSimulations))
          if (parsed?.sgtOverrides && typeof parsed.sgtOverrides === 'object')
            localStorage.setItem('sgt-overrides', JSON.stringify(parsed.sgtOverrides))
          if (Array.isArray(parsed?.allocationCustomRatios))
            localStorage.setItem('allocation-custom-ratios', JSON.stringify(parsed.allocationCustomRatios))
          if (parsed?.taxStore && typeof parsed.taxStore === 'object')
            localStorage.setItem('tax-store', JSON.stringify(parsed.taxStore))
          if (Array.isArray(parsed?.taxTemplates))
            localStorage.setItem('tax-templates', JSON.stringify(parsed.taxTemplates))
          if (parsed?.settings?.homeCardOrder)
            localStorage.setItem('home-card-order', parsed.settings.homeCardOrder as string)
          window.dispatchEvent(new Event('data-changed'))
          setTimeout(() => window.location.reload(), 200)
        } catch {
          alert('Could not import: the file is not a valid finance goals export.')
        }
      }
      reader.readAsText(file)
    },
    [importGoals, importGwGoals, updateProfile, setAccentTheme, setDarkMode, setAllowCsvImport],
  )

  const handleFactoryReset = useCallback((): void => {
    localStorage.clear()
    window.location.reload()
  }, [])

  const value = useMemo<ImportExportContextValue>(
    () => ({
      handleExport,
      handleImport,
      handleFactoryReset,
    }),
    [handleExport, handleImport, handleFactoryReset],
  )

  return <ImportExportContext.Provider value={value}>{children}</ImportExportContext.Provider>
}

export default ImportExportContext
