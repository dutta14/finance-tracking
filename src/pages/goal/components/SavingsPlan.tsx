import { FC, useMemo, useState } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import { Account, BalanceEntry, formatCurrency } from '../../data/types'

interface SavingsPlanProps {
  goal: FinancialGoal
  gwGoals: GwGoal[]
  profileBirthday: string
}

interface PlanResult {
  startMonth: string
  startBalance: number
  target: number
  monthsRemaining: number
  growthRate: number
  monthlySaving: number
}

const getBalanceData = (): { accounts: Account[]; balances: BalanceEntry[]; months: string[] } => {
  try {
    const accounts: Account[] = JSON.parse(localStorage.getItem('data-accounts') || '[]')
    const balances: BalanceEntry[] = JSON.parse(localStorage.getItem('data-balances') || '[]')
    const months = [...new Set(balances.map(b => b.month))].sort()
    return { accounts, balances, months }
  } catch {
    return { accounts: [], balances: [], months: [] }
  }
}

const getTotalForMonth = (accounts: Account[], balances: BalanceEntry[], month: string, goalType: 'fi' | 'gw'): number => {
  const balMap = new Map<number, number>()
  for (const b of balances) if (b.month === month) balMap.set(b.accountId, b.balance)
  return accounts
    .filter(a => a.goalType === goalType)
    .reduce((sum, a) => sum + (balMap.get(a.id) ?? 0), 0)
}

const getRetirementMonth = (birthday: string, retirementAge: number): string => {
  const [by, bm] = birthday.split('-').map(Number)
  const retYear = by + retirementAge
  const mm = String(bm).padStart(2, '0')
  return `${retYear}-${mm}`
}

const monthsBetween = (from: string, to: string): number => {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

const calcMonthlySaving = (pv: number, fv: number, annualRate: number, nMonths: number): number => {
  if (nMonths <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return Math.max(0, (fv - pv) / nMonths)
  const factor = Math.pow(1 + r, nMonths)
  const needed = fv - pv * factor
  if (needed <= 0) return 0
  return needed * r / (factor - 1)
}

const getGwTarget = (goal: FinancialGoal, gwGoals: GwGoal[], profileBirthday: string): number => {
  const goalGws = gwGoals.filter(g => g.fiGoalId === goal.id)
  if (goalGws.length === 0) return 0
  const [by, bm] = profileBirthday.split('-').map(Number)
  const created = new Date(goal.goalCreatedIn)
  return goalGws.reduce((sum, gw) => {
    const disburseYear = by + gw.disburseAge
    const months = Math.max(0, (disburseYear - created.getFullYear()) * 12 + (bm - (created.getMonth() + 1)))
    const disbTarget = gw.disburseAmount * Math.pow(1 + goal.inflationRate / 100 / 12, months)
    const mRetToDisb = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
    const pv = mRetToDisb > 0 ? disbTarget / Math.pow(1 + gw.growthRate / 100 / 12, mRetToDisb) : disbTarget
    return sum + pv
  }, 0)
}

const formatMonth = (ym: string) => {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[parseInt(m, 10) - 1]} ${y}`
}

interface PlanBlockProps {
  label: string
  target: number
  initialResult: PlanResult | null
  currentResult: PlanResult | null
  growthRate: number
  onGrowthChange: (v: number) => void
}

const PlanBlock: FC<PlanBlockProps> = ({ label, target, initialResult, currentResult, growthRate, onGrowthChange }) => {
  if (!initialResult && !currentResult) return null

  const init = initialResult
  const curr = currentResult
  const diff = (init && curr) ? curr.monthlySaving - init.monthlySaving : 0
  const diffPct = (init && curr && init.monthlySaving > 0) ? (diff / init.monthlySaving) * 100 : 0
  const diffCls = diff > 0 ? 'splan-delta up' : diff < 0 ? 'splan-delta down' : 'splan-delta flat'

  return (
    <div className="splan-block">
      <div className="splan-block-header">
        <h4 className="splan-section-label">{label}</h4>
        <div className="splan-field splan-field--narrow">
          <label>Growth %</label>
          <input
            type="number"
            step="0.1"
            value={growthRate}
            onChange={e => onGrowthChange(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="splan-row">
        <span>Target</span>
        <span className="splan-val">{formatCurrency(target)}</span>
      </div>

      {init && curr && (
        <>
          <div className="splan-compare-header">
            <span />
            <span className="splan-col-label">{formatMonth(init.startMonth)}</span>
            <span className="splan-col-label">{formatMonth(curr.startMonth)}</span>
          </div>
          <div className="splan-compare-row">
            <span>Balance</span>
            <span className="splan-val">{formatCurrency(init.startBalance)}</span>
            <span className="splan-val">{formatCurrency(curr.startBalance)}</span>
          </div>
          <div className="splan-compare-row">
            <span>Gap</span>
            <span className="splan-val">{formatCurrency(Math.max(0, target - init.startBalance))}</span>
            <span className="splan-val">{formatCurrency(Math.max(0, target - curr.startBalance))}</span>
          </div>
          <div className="splan-compare-row">
            <span>Months Left</span>
            <span className="splan-val">{init.monthsRemaining}</span>
            <span className="splan-val">{curr.monthsRemaining}</span>
          </div>
          <div className="splan-compare-row splan-compare-row--highlight">
            <span>Monthly Save</span>
            <span className="splan-val">{formatCurrency(init.monthlySaving)}</span>
            <span className="splan-val">{formatCurrency(curr.monthlySaving)}</span>
          </div>

          <div className="splan-delta-bar">
            <span className={diffCls}>
              {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'}{' '}
              {formatCurrency(Math.abs(diff))}/mo
              {diffPct !== 0 && ` (${diff > 0 ? '+' : ''}${diffPct.toFixed(0)}%)`}
            </span>
            <span className="splan-delta-note">
              {diff > 0 ? 'Need to save more now' : diff < 0 ? 'On track — need less now' : 'No change'}
            </span>
          </div>
        </>
      )}

      {init && !curr && (
        <div className="splan-results">
          <div className="splan-row"><span>Balance ({formatMonth(init.startMonth)})</span><span className="splan-val">{formatCurrency(init.startBalance)}</span></div>
          <div className="splan-row"><span>Gap</span><span className="splan-val">{formatCurrency(Math.max(0, target - init.startBalance))}</span></div>
          <div className="splan-row"><span>Months Left</span><span className="splan-val">{init.monthsRemaining}</span></div>
          <div className="splan-row splan-row--highlight"><span>Monthly Save</span><span className="splan-val">{formatCurrency(init.monthlySaving)}</span></div>
        </div>
      )}
    </div>
  )
}

const SavingsPlan: FC<SavingsPlanProps> = ({ goal, gwGoals, profileBirthday }) => {
  const { accounts, balances, months } = useMemo(getBalanceData, [])

  const retirementMonth = useMemo(
    () => getRetirementMonth(goal.birthday || profileBirthday, goal.retirementAge),
    [goal.birthday, profileBirthday, goal.retirementAge]
  )

  const fiTarget = goal.fiGoal
  const gwTarget = useMemo(() => getGwTarget(goal, gwGoals, profileBirthday), [goal, gwGoals, profileBirthday])

  const initialMonth = months[0] || ''
  const currentMonth = months[months.length - 1] || ''
  const [fiGrowth, setFiGrowth] = useState(8)
  const [gwGrowth, setGwGrowth] = useState(8)

  const calcPlan = (goalType: 'fi' | 'gw', startMonth: string, growthRate: number, target: number): PlanResult | null => {
    if (!startMonth || months.length === 0 || target <= 0) return null
    const bal = getTotalForMonth(accounts, balances, startMonth, goalType)
    const n = monthsBetween(startMonth, retirementMonth)
    const monthly = calcMonthlySaving(bal, target, growthRate, n)
    return { startMonth, startBalance: bal, target, monthsRemaining: Math.max(0, n), growthRate, monthlySaving: monthly }
  }

  const fiInitialResult = useMemo(() => calcPlan('fi', initialMonth, fiGrowth, fiTarget), [initialMonth, fiGrowth, fiTarget, accounts, balances, months, retirementMonth])
  const fiCurrentResult = useMemo(() => months.length > 1 ? calcPlan('fi', currentMonth, fiGrowth, fiTarget) : null, [currentMonth, fiGrowth, fiTarget, accounts, balances, months, retirementMonth])
  const gwInitialResult = useMemo(() => calcPlan('gw', initialMonth, gwGrowth, gwTarget), [initialMonth, gwGrowth, gwTarget, accounts, balances, months, retirementMonth])
  const gwCurrentResult = useMemo(() => months.length > 1 ? calcPlan('gw', currentMonth, gwGrowth, gwTarget) : null, [currentMonth, gwGrowth, gwTarget, accounts, balances, months, retirementMonth])

  if (months.length === 0) {
    return (
      <div className="splan">
        <h3 className="splan-title">Savings Plan</h3>
        <p className="splan-empty">Add balance data to generate a savings plan.</p>
      </div>
    )
  }

  const hasGw = gwTarget > 0

  return (
    <div className="splan">
      <h3 className="splan-title">Savings Plan</h3>

      {fiTarget > 0 && (
        <PlanBlock
          label="FI"
          target={fiTarget}
          initialResult={fiInitialResult}
          currentResult={fiCurrentResult}
          growthRate={fiGrowth}
          onGrowthChange={setFiGrowth}
        />
      )}

      {hasGw && (
        <PlanBlock
          label="GW"
          target={gwTarget}
          initialResult={gwInitialResult}
          currentResult={gwCurrentResult}
          growthRate={gwGrowth}
          onGrowthChange={setGwGrowth}
        />
      )}
    </div>
  )
}

export default SavingsPlan
