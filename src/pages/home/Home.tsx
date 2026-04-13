import { FC, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Profile } from '../../hooks/useProfile'
import { FinancialGoal, GwGoal } from '../../types'
import { Account, BalanceEntry } from '../data/types'
import NetWorthSummary from './NetWorthSummary'
import MiniCharts from './MiniCharts'
import GoalsPeek from './GoalsPeek'
import AllocationBreakdown from './AllocationBreakdown'
import '../../styles/Home.css'

interface HomeProps {
  profile: Profile
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
  onGoToGoal: (goalId: number) => void
}

const Home: FC<HomeProps> = ({ profile, goals, gwGoals, onGoToGoal }) => {
  const navigate = useNavigate()

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

  return (
    <div className="home-page">
      <div className="home-greeting">
        <h1>{greeting}</h1>
      </div>
      <div className="home-grid">
        <NetWorthSummary
          accounts={accounts}
          balances={balances}
          allMonths={allMonths}
          onNavigate={() => navigate('/data')}
        />
        <MiniCharts
          accounts={accounts}
          balances={balances}
          balanceMap={balanceMap}
          allMonths={allMonths}
          onNavigate={() => navigate('/data')}
        />
        <GoalsPeek
          goals={goals}
          gwGoals={gwGoals}
          onNavigate={() => navigate('/goal')}
          onGoToGoal={onGoToGoal}
        />
        <AllocationBreakdown
          accounts={accounts}
          balances={balances}
        />
      </div>
    </div>
  )
}

export default Home
