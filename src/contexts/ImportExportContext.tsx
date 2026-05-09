import { createContext, useContext, useCallback, useMemo, FC, ReactNode } from 'react'
import { useGoals } from './GoalsContext'
import { useSettings } from './SettingsContext'
import { loadBudgetStore, saveBudgetStore } from '../pages/budget/utils/budgetStorage'
import { appStorage } from '../utils/appStorage'
import { validateImportPayload } from '../utils/importValidator'
import { getStorageItem, setStorageItem } from '../utils/storage'

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
    const dataSnapshot = {
      accounts: appStorage.getJSON('data-accounts', []),
      balances: appStorage.getJSON('data-balances', []),
    }
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
          goalViewMode: getStorageItem('goal-view-mode', ''),
          homeCardOrder: JSON.stringify(getStorageItem('home-card-order', [0, 1, 2, 3])),
        },
        dataAccounts: dataSnapshot.accounts,
        dataBalances: dataSnapshot.balances,
        budgetCsvs: budgetStore.csvs,
        budgetConfig: { years: budgetStore.years, categoryGroups: budgetStore.categoryGroups },
        fiSimulations: appStorage.getJSON('fi-simulations', []),
        sgtOverrides: appStorage.getJSON('sgt-overrides', {}),
        allocationCustomRatios: appStorage.getJSON('allocation-custom-ratios', []),
        taxStore: appStorage.getJSON('tax-store', {}),
        taxTemplates: appStorage.getJSON('tax-templates', []),
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
          const rawText = e.target?.result as string
          const parsed = JSON.parse(rawText)
          const result = validateImportPayload(parsed, rawText.length)

          if (!result.valid || !result.sanitized) {
            alert(`Import failed:\n${result.errors.join('\n')}`)
            return
          }

          if (result.warnings.length > 0) {
            console.warn('[import] Warnings:', result.warnings)
          }

          const data = result.sanitized

          importGoals(data.goals)
          if (data.profile) updateProfile(data.profile)
          if (data.gwGoals) importGwGoals(data.gwGoals)

          if (data.settings) {
            if (data.settings.accentTheme) setAccentTheme(data.settings.accentTheme)
            if (data.settings.darkMode !== undefined) setDarkMode(!!data.settings.darkMode)
            if (data.settings.allowCsvImport !== undefined) setAllowCsvImport(!!data.settings.allowCsvImport)
            if (data.settings.goalViewMode) setStorageItem('goal-view-mode', data.settings.goalViewMode)
            if (data.settings.homeCardOrder) {
              try {
                const order = JSON.parse(data.settings.homeCardOrder) as number[]
                setStorageItem('home-card-order', order)
              } catch {
                console.warn('[restore] Invalid homeCardOrder format, skipping')
              }
            }
          }

          if (data.dataAccounts) appStorage.setJSON('data-accounts', data.dataAccounts)
          if (data.dataBalances) appStorage.setJSON('data-balances', data.dataBalances)

          if (data.budgetCsvs) {
            const store = loadBudgetStore()
            store.csvs = data.budgetCsvs as typeof store.csvs
            saveBudgetStore(store)
          }
          if (data.budgetConfig) appStorage.setJSON('budget-config', data.budgetConfig)
          if (data.fiSimulations) appStorage.setJSON('fi-simulations', data.fiSimulations)
          if (data.sgtOverrides) appStorage.setJSON('sgt-overrides', data.sgtOverrides)
          if (data.allocationCustomRatios) appStorage.setJSON('allocation-custom-ratios', data.allocationCustomRatios)
          if (data.taxStore) appStorage.setJSON('tax-store', data.taxStore)
          if (data.taxTemplates) appStorage.setJSON('tax-templates', data.taxTemplates)

          window.dispatchEvent(new Event('data-changed'))
          setTimeout(() => window.location.reload(), 200)
        } catch {
          alert('Could not import: the file is not valid JSON.')
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
