import { FC, useMemo, useState, useCallback } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import { useData } from '../../../contexts/DataContext'
import { formatCurrency } from '../../data/types'
import TermAbbr from '../../../components/TermAbbr'
import { getTotalForMonth, getRetirementMonth, monthsBetween, calcMonthlySaving, getGwTarget } from '../utils/goalMath'
import { getFiTarget } from '../utils/goalCalculations'

interface SavingsPlanProps {
  goal: FinancialGoal
  gwGoals: GwGoal[]
  profileBirthday: string
  growthRate?: number
  postGrowthRate?: number
  ageBoundary?: number
  showYearly?: boolean
  onTogglePeriod?: () => void
}

interface PlanResult {
  startMonth: string
  startBalance: number
  target: number
  monthsRemaining: number
  growthRate: number
  monthlySaving: number
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
  const diff = init && curr ? curr.monthlySaving - init.monthlySaving : 0
  const diffPct = init && curr && init.monthlySaving > 0 ? (diff / init.monthlySaving) * 100 : 0
  const diffCls = diff > 0 ? 'splan-delta up' : diff < 0 ? 'splan-delta down' : 'splan-delta flat'

  return (
    <div className="splan-block">
      <div className="splan-block-header">
        <h4 className="splan-section-label">
          {label === 'FI' || label === 'GW' ? <TermAbbr term={label as 'FI' | 'GW'} /> : label}
        </h4>
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
              {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'} {formatCurrency(Math.abs(diff))}/mo
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
          <div className="splan-row">
            <span>Balance ({formatMonth(init.startMonth)})</span>
            <span className="splan-val">{formatCurrency(init.startBalance)}</span>
          </div>
          <div className="splan-row">
            <span>Gap</span>
            <span className="splan-val">{formatCurrency(Math.max(0, target - init.startBalance))}</span>
          </div>
          <div className="splan-row">
            <span>Months Left</span>
            <span className="splan-val">{init.monthsRemaining}</span>
          </div>
          <div className="splan-row splan-row--highlight">
            <span>Monthly Save</span>
            <span className="splan-val">{formatCurrency(init.monthlySaving)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

const SavingsPlan: FC<SavingsPlanProps> = ({ goal, gwGoals, profileBirthday }) => {
  const { accounts, balances, allMonths: months } = useData()

  const retirementMonth = useMemo(
    () => getRetirementMonth(goal.birthday || profileBirthday, goal.retirementAge),
    [goal.birthday, profileBirthday, goal.retirementAge],
  )

  const gwTarget = useMemo(() => getGwTarget(goal, gwGoals, profileBirthday), [goal, gwGoals, profileBirthday])

  const initialMonth = months[0] || ''
  const currentMonth = months[months.length - 1] || ''
  const [fiGrowth, setFiGrowth] = useState(8)
  const [gwGrowth, setGwGrowth] = useState(8)

  const fiTarget = useMemo(() => getFiTarget(goal, profileBirthday, fiGrowth), [goal, profileBirthday, fiGrowth])

  const calcPlan = useCallback(
    (goalType: 'fi' | 'gw', startMonth: string, growthRate: number, target: number): PlanResult | null => {
      if (!startMonth || months.length === 0 || target <= 0) return null
      const bal = getTotalForMonth(accounts, balances, startMonth, goalType)
      const n = monthsBetween(startMonth, retirementMonth)
      const monthly = calcMonthlySaving(bal, target, growthRate, n)
      return {
        startMonth,
        startBalance: bal,
        target,
        monthsRemaining: Math.max(0, n),
        growthRate,
        monthlySaving: monthly,
      }
    },
    [accounts, balances, months, retirementMonth],
  )

  const fiInitialResult = useMemo(
    () => calcPlan('fi', initialMonth, fiGrowth, fiTarget),
    [calcPlan, initialMonth, fiGrowth, fiTarget],
  )
  const fiCurrentResult = useMemo(
    () => (months.length > 1 ? calcPlan('fi', currentMonth, fiGrowth, fiTarget) : null),
    [calcPlan, currentMonth, fiGrowth, fiTarget, months],
  )
  const gwInitialResult = useMemo(
    () => calcPlan('gw', initialMonth, gwGrowth, gwTarget),
    [calcPlan, initialMonth, gwGrowth, gwTarget],
  )
  const gwCurrentResult = useMemo(
    () => (months.length > 1 ? calcPlan('gw', currentMonth, gwGrowth, gwTarget) : null),
    [calcPlan, currentMonth, gwGrowth, gwTarget, months],
  )

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

// Simplified plan components for column layout — just show monthly savings needed
export const FiSavingsPlan: FC<SavingsPlanProps> = ({
  goal,
  gwGoals: _gwGoals,
  profileBirthday,
  growthRate,
  postGrowthRate,
  ageBoundary,
  showYearly,
  onTogglePeriod,
}) => {
  const { accounts, balances, allMonths: months } = useData()

  const retirementMonth = useMemo(
    () => getRetirementMonth(goal.birthday || profileBirthday, goal.retirementAge),
    [goal.birthday, profileBirthday, goal.retirementAge],
  )

  const currentMonth = months[months.length - 1] || ''
  const fiGrowth = growthRate ?? 8

  const fiTarget = useMemo(
    () => getFiTarget(goal, profileBirthday, fiGrowth, postGrowthRate, ageBoundary),
    [goal, profileBirthday, fiGrowth, postGrowthRate, ageBoundary],
  )

  const monthlySaving = useMemo(() => {
    if (!currentMonth || months.length === 0 || fiTarget <= 0) return null
    const bal = getTotalForMonth(accounts, balances, currentMonth, 'fi')
    const n = monthsBetween(currentMonth, retirementMonth)
    return calcMonthlySaving(bal, fiTarget, fiGrowth, n)
  }, [accounts, balances, months, currentMonth, retirementMonth, fiTarget, fiGrowth])

  if (months.length === 0 || fiTarget <= 0) return null

  return (
    <div className="splan splan--simple">
      <p className="splan-simple-message">
        At {fiGrowth}% growth,{' '}
        {monthlySaving === null || monthlySaving <= 0 ? (
          <span className="splan-simple-amount">you've achieved this goal 🎉</span>
        ) : (
          <>
            you need to save{' '}
            <span className="splan-simple-amount goal-summary-toggleable" onClick={onTogglePeriod}>
              {formatCurrency(showYearly ? monthlySaving * 12 : monthlySaving)}/{showYearly ? 'yr' : 'mo'}
            </span>
          </>
        )}
      </p>
    </div>
  )
}

export const GwSavingsPlan: FC<SavingsPlanProps> = ({
  goal,
  gwGoals,
  profileBirthday,
  growthRate,
  showYearly,
  onTogglePeriod,
}) => {
  const { accounts, balances, allMonths: months } = useData()

  const retirementMonth = useMemo(
    () => getRetirementMonth(goal.birthday || profileBirthday, goal.retirementAge),
    [goal.birthday, profileBirthday, goal.retirementAge],
  )

  const gwTarget = useMemo(() => getGwTarget(goal, gwGoals, profileBirthday), [goal, gwGoals, profileBirthday])
  const currentMonth = months[months.length - 1] || ''
  const gwGrowth = growthRate ?? 8

  const monthlySaving = useMemo(() => {
    if (!currentMonth || months.length === 0 || gwTarget <= 0) return null
    const bal = getTotalForMonth(accounts, balances, currentMonth, 'gw')
    const n = monthsBetween(currentMonth, retirementMonth)
    return calcMonthlySaving(bal, gwTarget, gwGrowth, n)
  }, [accounts, balances, months, currentMonth, retirementMonth, gwTarget, gwGrowth])

  if (months.length === 0 || gwTarget <= 0) return null

  return (
    <div className="splan splan--simple">
      <p className="splan-simple-message">
        At {gwGrowth}% growth,{' '}
        {monthlySaving === null || monthlySaving <= 0 ? (
          <span className="splan-simple-amount">you've achieved this goal 🎉</span>
        ) : (
          <>
            you need to save{' '}
            <span className="splan-simple-amount goal-summary-toggleable" onClick={onTogglePeriod}>
              {formatCurrency(showYearly ? monthlySaving * 12 : monthlySaving)}/{showYearly ? 'yr' : 'mo'}
            </span>
          </>
        )}
      </p>
    </div>
  )
}
