import { createContext, useContext, useState, useEffect, useMemo, FC, ReactNode, Dispatch, SetStateAction } from 'react'

export interface SettingsContextValue {
  darkMode: boolean
  setDarkMode: Dispatch<SetStateAction<boolean>>
  accentTheme: string
  setAccentTheme: Dispatch<SetStateAction<string>>
  allowCsvImport: boolean
  setAllowCsvImport: Dispatch<SetStateAction<boolean>>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error(
      'useSettings must be used within a <SettingsProvider>. Wrap a parent component in <SettingsProvider> before calling useSettings().',
    )
  }
  return ctx
}

export const SettingsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('darkMode')
    if (stored === '1') return true
    if (stored === '0') return false
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  const [accentTheme, setAccentTheme] = useState(() => {
    if (typeof window === 'undefined') return 'blue'
    return localStorage.getItem('accentTheme') || localStorage.getItem('fiTheme') || 'blue'
  })

  const [allowCsvImport, setAllowCsvImport] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('allowCsvImport') === '1'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (darkMode) document.body.classList.add('dark')
    else document.body.classList.remove('dark')
    localStorage.setItem('darkMode', darkMode ? '1' : '0')
  }, [darkMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('accentTheme', accentTheme)
  }, [accentTheme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('allowCsvImport', allowCsvImport ? '1' : '0')
  }, [allowCsvImport])

  const value = useMemo<SettingsContextValue>(
    () => ({
      darkMode,
      setDarkMode,
      accentTheme,
      setAccentTheme,
      allowCsvImport,
      setAllowCsvImport,
    }),
    [darkMode, accentTheme, allowCsvImport],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export default SettingsContext
