import { createContext, useContext, useState, useEffect, useMemo, FC, ReactNode, Dispatch, SetStateAction } from 'react'
import { isDemoActive, enterDemoMode, exitDemoMode } from '../pages/settings/demoMode'

export interface LayoutContextValue {
  sidebarOpen: boolean
  setSidebarOpen: Dispatch<SetStateAction<boolean>>
  isMobile: boolean
  settingsOpenSection: string | undefined
  setSettingsOpenSection: Dispatch<SetStateAction<string | undefined>>
  searchOpen: boolean
  setSearchOpen: Dispatch<SetStateAction<boolean>>
  handleOpenProfile: () => void
}

const LayoutContext = createContext<LayoutContextValue | null>(null)

export const useLayout = (): LayoutContextValue => {
  const ctx = useContext(LayoutContext)
  if (!ctx) {
    throw new Error(
      'useLayout must be used within a <LayoutProvider>. Wrap a parent component in <LayoutProvider> before calling useLayout().',
    )
  }
  return ctx
}

export const LayoutProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900)
  const [settingsOpenSection, setSettingsOpenSection] = useState<string | undefined>()
  const [searchOpen, setSearchOpen] = useState(false)
  const handleOpenProfile = (): void => setSettingsOpenSection('profile')

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 900
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'd') {
        e.preventDefault()
        isDemoActive() ? exitDemoMode() : enterDemoMode()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const value = useMemo<LayoutContextValue>(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      isMobile,
      settingsOpenSection,
      setSettingsOpenSection,
      searchOpen,
      setSearchOpen,
      handleOpenProfile,
    }),
    [sidebarOpen, isMobile, settingsOpenSection, searchOpen],
  )

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export default LayoutContext
