import { useSettings } from '../contexts/SettingsContext'

export function useDarkMode(): boolean {
  return useSettings().darkMode
}
