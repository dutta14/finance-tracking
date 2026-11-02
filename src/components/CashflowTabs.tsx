import { FC, useEffect, useRef } from 'react'
import '../styles/SectionTabs.css'

export type CashflowTab = 'cashflow' | 'spreadsheet' | 'groups' | 'transactions'

const TABS: ReadonlyArray<{ id: CashflowTab; label: string }> = [
  { id: 'cashflow', label: 'Overview' },
  { id: 'spreadsheet', label: 'Spreadsheet' },
  { id: 'groups', label: 'Groups' },
  { id: 'transactions', label: 'Transactions' },
]

interface CashflowTabsProps {
  active: CashflowTab
  onSelect: (tab: CashflowTab) => void
  /** Moves focus to the active tab on mount, so a cross-page tab switch doesn't drop keyboard focus. */
  focusActiveOnMount?: boolean
}

export const CASHFLOW_TAB_FOCUS_STATE = { focusCashflowTab: true } as const

export const shouldFocusCashflowTab = (state: unknown): boolean =>
  !!state && typeof state === 'object' && (state as { focusCashflowTab?: boolean }).focusCashflowTab === true

const CashflowTabs: FC<CashflowTabsProps> = ({ active, onSelect, focusActiveOnMount = false }) => {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (focusActiveOnMount) activeRef.current?.focus()
  }, [focusActiveOnMount])

  return (
    <div className="tab-bar section-tabs">
      {TABS.map(tab => (
        <button
          key={tab.id}
          ref={active === tab.id ? activeRef : undefined}
          className={`tab-btn${active === tab.id ? ' active' : ''}`}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default CashflowTabs
