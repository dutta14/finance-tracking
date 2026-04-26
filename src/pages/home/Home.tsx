import { FC, useMemo, useState, useRef, useCallback, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoals } from '../../contexts/GoalsContext'
import { useData } from '../../contexts/DataContext'
import { useTouchDrag } from '../../hooks/useTouchDrag'
import NetWorthSummary from './NetWorthSummary'
import MiniCharts from './MiniCharts'
import GoalsPeek from './GoalsPeek'
import AllocationBreakdown from './AllocationBreakdown'
import SetupProgress from './SetupProgress'
import { loadBudgetStore } from '../budget/utils/budgetStorage'
import '../../styles/Home.css'

const STORAGE_KEY = 'home-card-order'
const DEFAULT_ORDER = [0, 1, 2, 3]

function loadOrder(): number[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length === 4) return parsed
    }
  } catch {}
  return DEFAULT_ORDER
}

const CARD_NAMES = ['Net Worth', 'Charts', 'Goals', 'Allocation']

const Home: FC = () => {
  const navigate = useNavigate()
  const { visibleGoals: goals, gwGoals, profile } = useGoals()
  const [order, setOrder] = useState(loadOrder)
  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)

  const { accounts, balances } = useData()

  const hasBudgetData = useMemo(() => {
    const store = loadBudgetStore()
    return Object.keys(store.csvs).length > 0
  }, [])

  const allComplete = accounts.length > 0 && balances.length > 0 && goals.length > 0 && hasBudgetData
  const [setupDismissed, setSetupDismissed] = useState(() => localStorage.getItem('onboarding-dismissed') === '1')

  const allMonths = useMemo(() =>
    [...new Set(balances.map(b => b.month))].sort((a, b) => b.localeCompare(a)),
    [balances]
  )

  const balanceMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of balances) map.set(`${b.accountId}:${b.month}`, b.balance)
    return map
  }, [balances])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    const name = profile.name ? `, ${profile.name}` : ''
    if (hour < 12) return `Good morning${name}`
    if (hour < 17) return `Good afternoon${name}`
    return `Good evening${name}`
  }, [profile.name])

  /* ── Desktop HTML5 drag ── */
  const handleDragStart = useCallback((idx: number) => {
    dragIdx.current = idx
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(idx)
  }, [])

  const handleDrop = useCallback((idx: number) => {
    const from = dragIdx.current
    if (from === null || from === idx) { setDragOver(null); return }
    setOrder(prev => {
      const next = [...prev]
      const [removed] = next.splice(from, 1)
      next.splice(idx, 0, removed)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setAnnouncement(`${CARD_NAMES[removed]} moved to position ${idx + 1}`)
      return next
    })
    dragIdx.current = null
    setDragOver(null)
  }, [])

  const handleDragEnd = useCallback(() => {
    dragIdx.current = null
    setDragOver(null)
  }, [])

  /* ── Touch drag via hook ── */
  const touchFromIdx = useRef<number | null>(null)

  const getSlotFromPoint = useCallback((x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    const slot = (el as HTMLElement).closest?.('.home-grid-slot') as HTMLElement | null
    if (!slot || !gridRef.current) return null
    const slots = Array.from(gridRef.current.querySelectorAll('.home-grid-slot'))
    const idx = slots.indexOf(slot)
    return idx >= 0 ? idx : null
  }, [])

  const touchDrag = useTouchDrag({
    longPressMs: 300,
    onDragStart: (idx) => { touchFromIdx.current = idx },
    onDragMove: (_cx, _cy) => { /* visual updates handled via getSlotFromPoint */ },
    onDragEnd: () => {
      const from = touchFromIdx.current
      if (from !== null && dragOver !== null && from !== dragOver) {
        setOrder(prev => {
          const next = [...prev]
          const [removed] = next.splice(from, 1)
          next.splice(dragOver, 0, removed)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
          setAnnouncement(`${CARD_NAMES[removed]} moved to position ${dragOver + 1}`)
          return next
        })
      }
      touchFromIdx.current = null
      setDragOver(null)
    },
    getSlotFromPoint: (x, y) => {
      const idx = getSlotFromPoint(x, y)
      if (idx !== null) setDragOver(idx)
      return idx
    },
  })

  /* ── Mobile move buttons ── */
  const moveCard = useCallback((pos: number, direction: -1 | 1) => {
    const target = pos + direction
    if (target < 0 || target > 3) return
    setOrder(prev => {
      const next = [...prev]
      const [removed] = next.splice(pos, 1)
      next.splice(target, 0, removed)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setAnnouncement(`${CARD_NAMES[removed]} moved to position ${target + 1}`)
      return next
    })
  }, [])

  const cards: ReactNode[] = [
    <NetWorthSummary
      key="nw"
      accounts={accounts}
      balances={balances}
      allMonths={allMonths}
      onNavigate={() => navigate('/net-worth')}
    />,
    <MiniCharts
      key="charts"
      accounts={accounts}
      balances={balances}
      balanceMap={balanceMap}
      allMonths={allMonths}
      onNavigate={() => navigate('/net-worth')}
    />,
    <GoalsPeek
      key="goals"
      goals={goals}
      gwGoals={gwGoals}
      onNavigate={() => navigate('/goal')}
    />,
    <AllocationBreakdown
      key="alloc"
      accounts={accounts}
      balances={balances}
      onNavigate={() => navigate('/net-worth/allocation')}
    />,
  ]

  return (
    <div className="home-page">
      <div className="home-greeting">
        <h1>{greeting}</h1>
        {setupDismissed && !allComplete && (
          <button className="setup-guide-link" onClick={() => { localStorage.removeItem('onboarding-dismissed'); setSetupDismissed(false) }}>
            Setup guide
          </button>
        )}
      </div>
      {!setupDismissed && (
        <SetupProgress
          accounts={accounts}
          balances={balances}
          goals={goals}
          hasBudgetData={hasBudgetData}
          onDismiss={() => { localStorage.setItem('onboarding-dismissed', '1'); setSetupDismissed(true) }}
        />
      )}
      <div className="home-grid" ref={gridRef}>
        {order.map((cardIdx, pos) => {
          const touchHandlers = touchDrag.getTouchHandlers(pos)
          let slotClass = 'home-grid-slot'
          if (dragOver === pos) slotClass += ' home-grid-slot--over'
          if (touchDrag.isDragging && touchDrag.dragIdx === pos) slotClass += ' home-grid-slot--touch-dragging'
          if (touchDrag.isLongPressing && touchDrag.dragIdx === pos) slotClass += ' home-grid-slot--long-press'
          return (
            <div
              key={cardIdx}
              className={slotClass}
              draggable
              onDragStart={() => handleDragStart(pos)}
              onDragOver={e => handleDragOver(e, pos)}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(pos)}
              onDragEnd={handleDragEnd}
              onTouchStart={touchHandlers.onTouchStart}
              onTouchMove={touchHandlers.onTouchMove}
              onTouchEnd={touchHandlers.onTouchEnd}
            >
              <div className="reorder-touch-controls">
                <button
                  className="reorder-move-btn"
                  disabled={pos === 0}
                  onClick={() => moveCard(pos, -1)}
                  aria-label={`Move ${CARD_NAMES[cardIdx]} up`}
                >↑</button>
                <button
                  className="reorder-move-btn"
                  disabled={pos === order.length - 1}
                  onClick={() => moveCard(pos, 1)}
                  aria-label={`Move ${CARD_NAMES[cardIdx]} down`}
                >↓</button>
              </div>
              {cards[cardIdx]}
            </div>
          )
        })}
      </div>
      <div aria-live="polite" className="sr-only">{announcement}</div>
    </div>
  )
}

export default Home
