import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SettingsProvider } from '../contexts/SettingsContext'
import { FileStoreProvider } from '../contexts/FileStoreContext'
import { LayoutProvider } from '../contexts/LayoutContext'
import { GoalsProvider } from '../contexts/GoalsContext'
import { DataProvider } from '../contexts/DataContext'
import { FlagProvider } from '../flags/FlagContext'
import { composeProviders } from '../utils/composeProviders'

/**
 * All app providers composed in dependency order, wrapped in MemoryRouter
 * for test use. Mirrors the provider stack in App.tsx.
 */
const AllProviders = composeProviders(
  MemoryRouter,
  FileStoreProvider,
  SettingsProvider,
  LayoutProvider,
  GoalsProvider,
  DataProvider,
  FlagProvider,
)

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options })
}
