import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  FC,
  ReactNode,
  Dispatch,
  SetStateAction,
} from 'react'
import { isDemoActive, useFileStore } from './FileStoreContext'

export interface LayoutContextValue {
  sidebarOpen: boolean
  setSidebarOpen: Dispatch<SetStateAction<boolean>>
  isMobile: boolean
  /** Viewport at or below 479px, where a collapsed sidebar is fully hidden instead of an icon rail. */
  isNarrow: boolean
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
  const { enterDemo, exitDemo } = useFileStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900)
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth <= 479)
  const [settingsOpenSection, setSettingsOpenSection] = useState<string | undefined>()
  const [searchOpen, setSearchOpen] = useState(false)
  const wasMobileRef = useRef(window.innerWidth <= 900)
  const handleOpenProfile = (): void => setSettingsOpenSection('profile')

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 900
      setIsMobile(mobile)
      setIsNarrow(window.innerWidth <= 479)
      if (wasMobileRef.current && !mobile) setSidebarOpen(true)
      wasMobileRef.current = mobile
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        isDemoActive() ? exitDemo() : enterDemo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enterDemo, exitDemo])

  const value = useMemo<LayoutContextValue>(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      isMobile,
      isNarrow,
      settingsOpenSection,
      setSettingsOpenSection,
      searchOpen,
      setSearchOpen,
      handleOpenProfile,
    }),
    [sidebarOpen, isMobile, isNarrow, settingsOpenSection, searchOpen],
  )

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export default LayoutContext
