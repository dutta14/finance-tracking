import { FC, useMemo, useState, useRef, useCallback, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Profile } from '../../hooks/useProfile'
import { FinancialGoal, GwGoal } from '../../types'
import { Account, BalanceEntry } from '../data/types'
import NetWorthSummary from './NetWorthSummary'
import MiniCharts from './MiniCharts'
import GoalsPeek from './GoalsPeek'
import AllocationBreakdown from './AllocationBreakdown'
import WelcomeGuide from './WelcomeGuide'
import '../../styles/Home.css'

interface HomeProps {
  profile: Profile
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
}

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

const Home: FC<HomeProps> = ({ profile, goals, gwGoals }) => {
  const navigate = useNavigate()
  const [order, setOrder] = useState(loadOrder)
  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const accounts = useMemo<Account[]>(() => {
    try {
      const stored = localStorage.getItem('data-accounts')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  }, [])

  const balances = useMemo<BalanceEntry[]>(() => {
    try {
      const stored = localStorage.getItem('data-balances')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  }, [])

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
      return next
    })
    dragIdx.current = null
    setDragOver(null)
  }, [])

  const handleDragEnd = useCallback(() => {
    dragIdx.current = null
    setDragOver(null)
  }, [])

  const isCompletelyEmpty = balances.length === 0 && goals.length === 0

  if (isCompletelyEmpty) {
    return <WelcomeGuide greeting={greeting} />
  }

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
      onNavigate={() => navigate('/allocation')}
    />,
  ]

  return (
    <div className="home-page">
      <div className="home-greeting">
        <h1>{greeting}</h1>
      </div>
      <div className="home-grid">
        {order.map((cardIdx, pos) => (
          <div
            key={cardIdx}
            className={`home-grid-slot${dragOver === pos ? ' home-grid-slot--over' : ''}`}
            draggable
            onDragStart={() => handleDragStart(pos)}
            onDragOver={e => handleDragOver(e, pos)}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(pos)}
            onDragEnd={handleDragEnd}
          >
            {cards[cardIdx]}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Home
