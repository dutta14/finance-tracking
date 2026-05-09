import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SettingsProvider } from '../contexts/SettingsContext'
import { EncryptionProvider } from '../contexts/EncryptionContext'
import { LayoutProvider } from '../contexts/LayoutContext'
import { GoalsProvider } from '../contexts/GoalsContext'
import { DataProvider } from '../contexts/DataContext'
import { GitHubSyncProvider } from '../contexts/GitHubSyncContext'
import { FlagProvider } from '../flags/FlagContext'
import { BudgetSyncProvider } from '../contexts/BudgetSyncContext'
import { TaxSyncProvider } from '../contexts/TaxSyncContext'
import { ImportExportProvider } from '../contexts/ImportExportContext'
import { composeProviders } from '../utils/composeProviders'

/**
 * All app providers composed in dependency order, wrapped in MemoryRouter
 * for test use. Mirrors the provider stack in App.tsx.
 */
const AllProviders = composeProviders(
  MemoryRouter,
  SettingsProvider,
  EncryptionProvider,
  LayoutProvider,
  GoalsProvider,
  DataProvider,
  GitHubSyncProvider,
  FlagProvider,
  BudgetSyncProvider,
  TaxSyncProvider,
  ImportExportProvider,
)

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options })
}
