import { FC, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import '../styles/SectionTabs.css'

const FOCUS_STATE = { focusPlanningTab: true } as const

interface PlanningTabsProps {
  /** Keeps the Goals tab active on goal detail routes, which sit under /goal/plans/:id. */
  goalsActive?: boolean
}

const PlanningTabs: FC<PlanningTabsProps> = ({ goalsActive = false }) => {
  const navRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const focusOnMount = (location.state as { focusPlanningTab?: boolean } | null)?.focusPlanningTab === true

  // Switching between Goals and Taxes remounts the page, which would drop keyboard focus.
  useEffect(() => {
    if (focusOnMount) navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus()
  }, [focusOnMount])

  const tabClass =
    (forceActive = false) =>
    ({ isActive }: { isActive: boolean }) =>
      `tab-btn${isActive || forceActive ? ' active' : ''}`

  return (
    <nav ref={navRef} className="tab-bar section-tabs" aria-label="Planning sections">
      <NavLink to="/goal/plans" state={FOCUS_STATE} className={tabClass(goalsActive)}>
        Goals
      </NavLink>
      <NavLink to="/goal/leverage" state={FOCUS_STATE} className={tabClass()}>
        Leverage
      </NavLink>
      <NavLink to="/goal/paydown" state={FOCUS_STATE} className={tabClass()}>
        Pay Down
      </NavLink>
      <NavLink to="/goal/calculator" state={FOCUS_STATE} className={tabClass()}>
        FIRE Calculator
      </NavLink>
      <NavLink to="/taxes" state={FOCUS_STATE} className={tabClass()}>
        Taxes
      </NavLink>
    </nav>
  )
}

export default PlanningTabs
