import { FC, useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import {
  Account, BalanceEntry, AssetAllocation, ALLOCATION_LABELS,
  formatCurrency, getDefaultAllocation,
} from '../data/types'
import { Profile } from '../../hooks/useProfile'
import '../../styles/Allocation.css'

/* ── constants ───────────────────────────────────────────────── */

const ALLOC_COLORS: Record<AssetAllocation, string> = {
  cash: '#6b7280',
  'us-stock': '#6366f1',
  'intl-stock': '#8b5cf6',
  bonds: '#0ea5e9',
  'real-estate': '#f59e0b',
  others: '#84cc16',
  debt: '#ef4444',
}

const ALL_CLASSES: AssetAllocation[] = ['us-stock', 'intl-stock', 'bonds', 'cash', 'real-estate', 'others', 'debt']

type Scope = 'total' | 'fi' | 'gw'

/* ── preset ratio views ──────────────────────────────────────── */

interface RatioPreset {
  id: string
  name: string
  scope: Scope
  groups: { label: string; classes: AssetAllocation[]; color: string }[]
}

const PRESETS: RatioPreset[] = [
  {
    id: 'stock-bond-fi',
    name: 'Stock vs Bond',
    scope: 'fi',
    groups: [
      { label: 'Stocks', classes: ['us-stock', 'intl-stock'], color: '#6366f1' },
      { label: 'Bonds', classes: ['bonds'], color: '#0ea5e9' },
    ],
  },
  {
    id: 'us-intl-total',
    name: 'US vs International',
    scope: 'total',
    groups: [
      { label: 'US Stock', classes: ['us-stock'], color: '#6366f1' },
      { label: 'Intl Stock', classes: ['intl-stock'], color: '#8b5cf6' },
    ],
  },
  {
    id: 'equity-fixed-total',
    name: 'Equity vs Fixed Income',
    scope: 'total',
    groups: [
      { label: 'Equity', classes: ['us-stock', 'intl-stock'], color: '#6366f1' },
      { label: 'Fixed Income', classes: ['bonds', 'cash'], color: '#0ea5e9' },
    ],
  },
  {
    id: 'growth-defensive-total',
    name: 'Growth vs Defensive',
    scope: 'total',
    groups: [
      { label: 'Growth', classes: ['us-stock', 'intl-stock', 'real-estate'], color: '#6366f1' },
      { label: 'Defensive', classes: ['bonds', 'cash'], color: '#0ea5e9' },
    ],
  },
]

const GROUP_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#84cc16']

const STORAGE_KEY = 'allocation-custom-ratios'

/* ── goal types ──────────────────────────────────────────────── */

type GoalOwner = 'primary' | 'partner'

interface GradualGoal {
  type: 'gradual'
  owner: GoalOwner
  startAge: number
  endAge: number
  /** pct per group index at start — must sum to 100 */
  startPcts: number[]
  /** pct per group index at end — must sum to 100 */
  endPcts: number[]
}

interface ConstantGoal {
  type: 'constant'
  /** pct per group index — must sum to 100 */
  pcts: number[]
}

type RatioGoal = GradualGoal | ConstantGoal

interface CustomRatio {
  id: string
  name: string
  scope: Scope
  groups: { label: string; classes: AssetAllocation[] }[]
  goals?: Partial<Record<Scope, RatioGoal>>
}

const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const loadCustomRatios = (): CustomRatio[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
const saveCustomRatios = (ratios: CustomRatio[]) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ratios))

const makeDefaultRatio = (): CustomRatio => ({
  id: makeId(),
  name: 'New Ratio',
  scope: 'total',
  groups: [
    { label: 'Group A', classes: [] },
    { label: 'Group B', classes: [] },
  ],
})

/* ── Rebalance panel sub-component ───────────────────────────── */

interface RebalancePanelProps {
  groups: { label: string; classes: AssetAllocation[] }[]
  /** current actual $ per group */
  actualValues: number[]
  /** target pcts from goal */
  goalPcts: number[]
  onClose: () => void
}

const RebalancePanel: FC<RebalancePanelProps> = ({ groups, actualValues, goalPcts, onClose }) => {
  const [newMoney, setNewMoney] = useState(0)
  const currentTotal = actualValues.reduce((a, b) => a + b, 0)
  const totalAfterAdd = currentTotal + newMoney

  // Target amount per group after rebalancing
  const targetAmounts = goalPcts.map(p => totalAfterAdd * (p / 100))
  // Delta per group: positive = needs more money, negative = has excess
  const deltas = targetAmounts.map((t, i) => t - actualValues[i])

  // Split into: new money allocations vs transfers between groups
  const newMoneyAvailable = Math.max(0, newMoney)

  // Allocate new money first to groups that need it, proportionally
  const needGroups = deltas.map((d, i) => ({ idx: i, need: Math.max(0, d) })).filter(g => g.need > 0)
  const totalNeed = needGroups.reduce((s, g) => s + g.need, 0)

  const newMoneyAlloc = new Array(groups.length).fill(0)
  if (totalNeed > 0 && newMoneyAvailable > 0) {
    const allocatable = Math.min(newMoneyAvailable, totalNeed)
    for (const g of needGroups) {
      newMoneyAlloc[g.idx] = allocatable * (g.need / totalNeed)
    }
  }

  // Remaining delta after new money is applied
  const remainingDelta = deltas.map((d, i) => d - newMoneyAlloc[i])

  // Build transfer instructions: from groups with excess to groups with deficit
  const transfers: { from: string; to: string; amount: number }[] = []
  const excess = remainingDelta.map((d, i) => ({ idx: i, amount: Math.max(0, -d) })).filter(g => g.amount > 0.01)
  const deficit = remainingDelta.map((d, i) => ({ idx: i, amount: Math.max(0, d) })).filter(g => g.amount > 0.01)

  // Match excess to deficit
  let ei = 0, di = 0
  const exCopy = excess.map(e => ({ ...e }))
  const defCopy = deficit.map(d => ({ ...d }))
  while (ei < exCopy.length && di < defCopy.length) {
    const amount = Math.min(exCopy[ei].amount, defCopy[di].amount)
    if (amount > 0.01) {
      transfers.push({
        from: groups[exCopy[ei].idx].label,
        to: groups[defCopy[di].idx].label,
        amount,
      })
    }
    exCopy[ei].amount -= amount
    defCopy[di].amount -= amount
    if (exCopy[ei].amount < 0.01) ei++
    if (defCopy[di].amount < 0.01) di++
  }

  const hasAnyAction = newMoneyAvailable > 0 || transfers.length > 0

  return (
    <div className="alloc-rebal-panel">
      <div className="alloc-rebal-header">
        <span className="alloc-ratio-builder-label">Rebalance</span>
        <button className="alloc-goal-cancel-btn" onClick={onClose}>Close</button>
      </div>

      <div className="alloc-rebal-field">
        <label className="alloc-goal-field-label">Adding new money?</label>
        <div className="alloc-rebal-input-wrap">
          <span className="alloc-rebal-dollar">$</span>
          <input type="number" className="alloc-goal-field-input alloc-rebal-money-input"
            value={newMoney || ''} onChange={e => setNewMoney(Math.max(0, Number(e.target.value)))}
            placeholder="0" min={0} />
        </div>
      </div>

      {/* Summary table */}
      <div className="alloc-rebal-table">
        <div className="alloc-rebal-row alloc-rebal-row-header">
          <span className="alloc-rebal-cell alloc-rebal-cell-name">Group</span>
          <span className="alloc-rebal-cell">Current</span>
          <span className="alloc-rebal-cell">Target</span>
          <span className="alloc-rebal-cell">Δ</span>
        </div>
        {groups.map((g, i) => {
          const delta = deltas[i]
          return (
            <div key={i} className="alloc-rebal-row">
              <span className="alloc-rebal-cell alloc-rebal-cell-name">
                <span className="alloc-ratio-group-dot" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                {g.label}
              </span>
              <span className="alloc-rebal-cell">{formatCurrency(actualValues[i])}</span>
              <span className="alloc-rebal-cell">{formatCurrency(targetAmounts[i])}</span>
              <span className={`alloc-rebal-cell alloc-rebal-delta${delta > 0.01 ? ' positive' : delta < -0.01 ? ' negative' : ' zero'}`}>
                {delta > 0 ? '+' : ''}{formatCurrency(delta)}
              </span>
            </div>
          )
        })}
        <div className="alloc-rebal-row alloc-rebal-row-total">
          <span className="alloc-rebal-cell alloc-rebal-cell-name">Total</span>
          <span className="alloc-rebal-cell">{formatCurrency(currentTotal)}</span>
          <span className="alloc-rebal-cell">{formatCurrency(totalAfterAdd)}</span>
          <span className="alloc-rebal-cell">{newMoneyAvailable > 0 ? `+${formatCurrency(newMoneyAvailable)}` : '—'}</span>
        </div>
      </div>

      {/* Action plan */}
      {hasAnyAction && (
        <div className="alloc-rebal-actions">
          <div className="alloc-rebal-actions-title">Action Plan</div>

          {newMoneyAvailable > 0 && newMoneyAlloc.some(a => a > 0.01) && (
            <div className="alloc-rebal-action-group">
              <div className="alloc-rebal-action-heading">Allocate new money</div>
              {newMoneyAlloc.map((amt, i) => amt > 0.01 ? (
                <div key={i} className="alloc-rebal-action-item alloc-rebal-action-add">
                  <span className="alloc-rebal-action-icon">＋</span>
                  <span>Put <strong>{formatCurrency(amt)}</strong> into <strong>{groups[i].label}</strong></span>
                </div>
              ) : null)}
            </div>
          )}

          {transfers.length > 0 && (
            <div className="alloc-rebal-action-group">
              <div className="alloc-rebal-action-heading">Move between groups</div>
              {transfers.map((t, i) => (
                <div key={i} className="alloc-rebal-action-item alloc-rebal-action-move">
                  <span className="alloc-rebal-action-icon">↻</span>
                  <span>Move <strong>{formatCurrency(t.amount)}</strong> from <strong>{t.from}</strong> → <strong>{t.to}</strong></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasAnyAction && (
        <div className="alloc-rebal-on-track">Your allocation is on track with the goal.</div>
      )}
    </div>
  )
}

/* ── Goal editor sub-component ───────────────────────────────── */

interface GoalEditorProps {
  groups: { label: string; classes: AssetAllocation[] }[]
  existingGoal: RatioGoal | null
  hasPrimary: boolean
  hasPartner: boolean
  primaryName: string
  partnerName: string
  onSave: (goal: RatioGoal) => void
  onCancel: () => void
}

const GoalEditor: FC<GoalEditorProps> = ({ groups, existingGoal, hasPrimary, hasPartner, primaryName, partnerName, onSave, onCancel }) => {
  const n = groups.length
  const evenPct = Math.floor(100 / n)
  const remainder = 100 - evenPct * n

  const [goalType, setGoalType] = useState<'constant' | 'gradual'>(existingGoal?.type ?? 'constant')
  const [owner, setOwner] = useState<GoalOwner>(existingGoal?.type === 'gradual' ? existingGoal.owner : 'primary')
  const [startAge, setStartAge] = useState(existingGoal?.type === 'gradual' ? existingGoal.startAge : 30)
  const [endAge, setEndAge] = useState(existingGoal?.type === 'gradual' ? existingGoal.endAge : 60)
  const [pcts, setPcts] = useState<number[]>(
    existingGoal?.type === 'constant' ? [...existingGoal.pcts] : Array.from({ length: n }, (_, i) => evenPct + (i === 0 ? remainder : 0))
  )
  const [startPcts, setStartPcts] = useState<number[]>(
    existingGoal?.type === 'gradual' ? [...existingGoal.startPcts] : Array.from({ length: n }, (_, i) => evenPct + (i === 0 ? remainder : 0))
  )
  const [endPcts, setEndPcts] = useState<number[]>(
    existingGoal?.type === 'gradual' ? [...existingGoal.endPcts] : Array.from({ length: n }, (_, i) => evenPct + (i === 0 ? remainder : 0))
  )

  const updatePct = (arr: number[], setArr: (v: number[]) => void, idx: number, val: number) => {
    const clamped = Math.max(0, Math.min(100, val))
    const next = [...arr]
    next[idx] = clamped
    setArr(next)
  }

  const pctSum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

  const handleSave = () => {
    if (goalType === 'constant') {
      onSave({ type: 'constant', pcts: [...pcts] })
    } else {
      onSave({ type: 'gradual', owner, startAge, endAge, startPcts: [...startPcts], endPcts: [...endPcts] })
    }
  }

  const constantValid = pctSum(pcts) === 100
  const gradualValid = startAge < endAge && pctSum(startPcts) === 100 && pctSum(endPcts) === 100

  return (
    <div className="alloc-goal-editor">
      <div className="alloc-goal-editor-header">
        <span className="alloc-ratio-builder-label">Goal Type</span>
        <div className="alloc-page-scope-tabs">
          <button className={`alloc-page-tab${goalType === 'constant' ? ' active' : ''}`}
            onClick={() => setGoalType('constant')}>Constant</button>
          <button className={`alloc-page-tab${goalType === 'gradual' ? ' active' : ''}`}
            onClick={() => setGoalType('gradual')}>Gradual</button>
        </div>
      </div>

      {goalType === 'gradual' && (
        <div className="alloc-goal-gradual-fields">
          <div className="alloc-goal-field-row">
            <label className="alloc-goal-field-label">Based on</label>
            <div className="alloc-page-scope-tabs">
              <button className={`alloc-page-tab${owner === 'primary' ? ' active' : ''}`}
                onClick={() => setOwner('primary')} disabled={!hasPrimary}>{primaryName || 'Primary'}</button>
              <button className={`alloc-page-tab${owner === 'partner' ? ' active' : ''}`}
                onClick={() => setOwner('partner')} disabled={!hasPartner}>{partnerName || 'Partner'}</button>
            </div>
          </div>
          <div className="alloc-goal-field-row">
            <label className="alloc-goal-field-label">Start age</label>
            <input type="number" className="alloc-goal-field-input" value={startAge}
              onChange={e => setStartAge(Number(e.target.value))} min={0} max={120} />
            <label className="alloc-goal-field-label" style={{ marginLeft: '0.75rem' }}>End age</label>
            <input type="number" className="alloc-goal-field-input" value={endAge}
              onChange={e => setEndAge(Number(e.target.value))} min={0} max={120} />
          </div>
        </div>
      )}

      {/* Pct inputs */}
      {goalType === 'constant' && (
        <div className="alloc-goal-pct-grid">
          <div className="alloc-goal-pct-header">Target %</div>
          {groups.map((g, i) => (
            <div key={i} className="alloc-goal-pct-row">
              <span className="alloc-goal-pct-label">
                <span className="alloc-ratio-group-dot" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                {g.label}
              </span>
              <input type="number" className="alloc-goal-field-input" value={pcts[i] ?? 0}
                onChange={e => updatePct(pcts, setPcts, i, Number(e.target.value))} min={0} max={100} />
              <span className="alloc-goal-pct-unit">%</span>
            </div>
          ))}
          <div className={`alloc-goal-pct-sum${pctSum(pcts) === 100 ? ' valid' : ' invalid'}`}>
            Sum: {pctSum(pcts)}%{pctSum(pcts) !== 100 && ' (must be 100%)'}
          </div>
        </div>
      )}

      {goalType === 'gradual' && (
        <div className="alloc-goal-pct-grid">
          <div className="alloc-goal-pct-cols">
            <span className="alloc-goal-pct-header" style={{ flex: 1 }} />
            <span className="alloc-goal-pct-header">Start %</span>
            <span className="alloc-goal-pct-header">End %</span>
          </div>
          {groups.map((g, i) => (
            <div key={i} className="alloc-goal-pct-row alloc-goal-pct-row-dual">
              <span className="alloc-goal-pct-label">
                <span className="alloc-ratio-group-dot" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                {g.label}
              </span>
              <div className="alloc-goal-pct-pair">
                <input type="number" className="alloc-goal-field-input" value={startPcts[i] ?? 0}
                  onChange={e => updatePct(startPcts, setStartPcts, i, Number(e.target.value))} min={0} max={100} />
                <span className="alloc-goal-pct-arrow">→</span>
                <input type="number" className="alloc-goal-field-input" value={endPcts[i] ?? 0}
                  onChange={e => updatePct(endPcts, setEndPcts, i, Number(e.target.value))} min={0} max={100} />
              </div>
            </div>
          ))}
          <div className="alloc-goal-pct-sums">
            <div className={`alloc-goal-pct-sum${pctSum(startPcts) === 100 ? ' valid' : ' invalid'}`}>
              Start: {pctSum(startPcts)}%{pctSum(startPcts) !== 100 && ' ≠ 100'}
            </div>
            <div className={`alloc-goal-pct-sum${pctSum(endPcts) === 100 ? ' valid' : ' invalid'}`}>
              End: {pctSum(endPcts)}%{pctSum(endPcts) !== 100 && ' ≠ 100'}
            </div>
          </div>
        </div>
      )}

      <div className="alloc-goal-editor-actions">
        <button className="alloc-goal-save-btn"
          disabled={goalType === 'constant' ? !constantValid : !gradualValid}
          onClick={handleSave}>Save Goal</button>
        <button className="alloc-goal-cancel-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

/* ── component ───────────────────────────────────────────────── */

const Allocation: FC = () => {
  const accounts: Account[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('data-accounts') || '[]') } catch { return [] }
  }, [])
  const balances: BalanceEntry[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('data-balances') || '[]') } catch { return [] }
  }, [])

  const [scope, setScope] = useState<Scope>('total')
  const [legendMode, setLegendMode] = useState<'pct' | 'val'>('pct')

  /* Custom ratios state — persisted to localStorage */
  const [customRatios, setCustomRatios] = useState<CustomRatio[]>(loadCustomRatios)
  const [activeRatioId, setActiveRatioId] = useState<string | null>(
    () => { const saved = loadCustomRatios(); return saved.length > 0 ? saved[0].id : null }
  )
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const activeRatio = customRatios.find(r => r.id === activeRatioId) ?? null

  const persist = useCallback((next: CustomRatio[]) => {
    setCustomRatios(next)
    saveCustomRatios(next)
  }, [])

  const updateActiveRatio = useCallback((updater: (r: CustomRatio) => CustomRatio) => {
    if (!activeRatioId) return
    setActivePreset(null)
    setCustomRatios(prev => {
      const next = prev.map(r => r.id === activeRatioId ? updater(r) : r)
      saveCustomRatios(next)
      return next
    })
  }, [activeRatioId])

  const createRatio = () => {
    const nr = makeDefaultRatio()
    const next = [...customRatios, nr]
    persist(next)
    setActiveRatioId(nr.id)
    setActivePreset(null)
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const requestDeleteRatio = (id: string) => {
    const ratio = customRatios.find(r => r.id === id)
    const goalCount = ratio?.goals ? Object.keys(ratio.goals).length : 0
    if (goalCount > 0) {
      setConfirmDeleteId(id)
      return
    }
    doDeleteRatio(id)
  }

  const doDeleteRatio = (id: string) => {
    const next = customRatios.filter(r => r.id !== id)
    persist(next)
    if (activeRatioId === id) {
      setActiveRatioId(next.length > 0 ? next[0].id : null)
    }
    setActivePreset(null)
    setConfirmDeleteId(null)
  }

  /* Sync active selection if ratios change externally */
  useEffect(() => {
    if (activeRatioId && !customRatios.find(r => r.id === activeRatioId)) {
      setActiveRatioId(customRatios.length > 0 ? customRatios[0].id : null)
    }
  }, [customRatios, activeRatioId])

  /* New-ratio dropdown */
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const createMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!createMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) setCreateMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [createMenuOpen])

  const createFromPreset = (preset: RatioPreset) => {
    const nr: CustomRatio = {
      id: makeId(), name: preset.name, scope: preset.scope,
      groups: preset.groups.map(g => ({ label: g.label, classes: [...g.classes] })),
    }
    persist([...customRatios, nr])
    setActiveRatioId(nr.id)
    setCreateMenuOpen(false)
  }

  /* ── profile / age ─────────────────────────────────────────── */

  const profile: Profile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user-profile') || '{}') } catch { return {} as Profile }
  }, [])

  const getAge = (owner: GoalOwner): number | null => {
    const bday = owner === 'partner' ? profile.partner?.birthday : profile.birthday
    if (!bday) return null
    const bd = new Date(bday)
    if (isNaN(bd.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - bd.getFullYear()
    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--
    return age
  }

  /** Compute target pcts for each group at current age */
  const computeGoalPcts = (goal: RatioGoal, numGroups: number): number[] | null => {
    if (goal.type === 'constant') {
      return goal.pcts.length === numGroups ? goal.pcts : null
    }
    // gradual
    const age = getAge(goal.owner)
    if (age === null) return null
    if (goal.startPcts.length !== numGroups || goal.endPcts.length !== numGroups) return null
    if (age <= goal.startAge) return goal.startPcts
    if (age >= goal.endAge) return goal.endPcts
    const progress = (age - goal.startAge) / (goal.endAge - goal.startAge)
    return goal.startPcts.map((sp, i) => {
      const ep = goal.endPcts[i]
      return Math.round(sp + (ep - sp) * progress)
    })
  }

  /* ── goal helpers ──────────────────────────────────────────── */

  const setGoalForScope = (scopeKey: Scope, goal: RatioGoal | null) => {
    updateActiveRatio(r => {
      const prev = r.goals ?? {}
      if (goal === null) {
        const { [scopeKey]: _, ...rest } = prev
        return { ...r, goals: rest }
      }
      return { ...r, goals: { ...prev, [scopeKey]: goal } }
    })
  }

  const [goalEditing, setGoalEditing] = useState(false)
  const [rebalOpen, setRebalOpen] = useState(false)

  /* ── data computation ──────────────────────────────────────── */

  const allocMap = useMemo(() => {
    if (balances.length === 0) return new Map<string, Map<AssetAllocation, number>>()
    const months = [...new Set(balances.map(b => b.month))].sort()
    const latest = months[months.length - 1]
    const latestBals = balances.filter(b => b.month === latest)
    const balMap = new Map<number, number>()
    for (const b of latestBals) balMap.set(b.accountId, b.balance)

    const build = (goalFilter?: 'fi' | 'gw') => {
      const grouped = new Map<AssetAllocation, number>()
      for (const a of accounts) {
        if (a.status !== 'active' || (a.nature || 'asset') !== 'asset') continue
        if (goalFilter && a.goalType !== goalFilter) continue
        const bal = balMap.get(a.id)
        if (!bal || bal === 0) continue
        const alloc = a.allocation || getDefaultAllocation('asset')
        grouped.set(alloc, (grouped.get(alloc) ?? 0) + bal)
      }
      for (const a of accounts) {
        if (a.status !== 'active' || (a.nature || 'asset') !== 'liability') continue
        if (goalFilter && a.goalType !== goalFilter) continue
        const bal = balMap.get(a.id)
        if (!bal || bal === 0) continue
        const absBal = Math.abs(bal)
        if (a.linkedAccountId != null) {
          const linked = accounts.find(la => la.id === a.linkedAccountId)
          if (linked) {
            const linkedAlloc = linked.allocation || getDefaultAllocation(linked.nature || 'asset')
            grouped.set(linkedAlloc, (grouped.get(linkedAlloc) ?? 0) - absBal)
            continue
          }
        }
        const alloc = a.allocation || getDefaultAllocation('liability')
        grouped.set(alloc, (grouped.get(alloc) ?? 0) + absBal)
      }
      return grouped
    }

    const result = new Map<string, Map<AssetAllocation, number>>()
    result.set('total', build())
    result.set('fi', build('fi'))
    result.set('gw', build('gw'))
    return result
  }, [accounts, balances])

  const getSlices = (s: Scope) => {
    const m = allocMap.get(s)
    if (!m) return []
    return [...m.entries()]
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ key: k, name: ALLOCATION_LABELS[k], value: v, color: ALLOC_COLORS[k] }))
      .sort((a, b) => b.value - a.value)
  }

  const slices = getSlices(scope)
  const total = slices.reduce((s, d) => s + d.value, 0)

  /* ── ratio computation ─────────────────────────────────────── */

  const computeRatio = (groups: { label: string; classes: AssetAllocation[] }[], s: Scope) => {
    const m = allocMap.get(s)
    if (!m) return []
    return groups
      .map((g, i) => {
        const val = g.classes.reduce((sum, cls) => sum + (m.get(cls) ?? 0), 0)
        return { name: g.label, value: Math.max(0, val), color: GROUP_COLORS[i % GROUP_COLORS.length] }
      })
      .filter(d => d.value > 0)
  }

  const customRatioData = activeRatio ? computeRatio(activeRatio.groups, activeRatio.scope) : []
  const customRatioTotal = customRatioData.reduce((s, d) => s + d.value, 0)

  /* ── preset helpers ────────────────────────────────────────── */

  const applyPreset = (preset: RatioPreset) => {
    setActivePreset(preset.id)
    updateActiveRatio(r => ({
      ...r, scope: preset.scope, name: preset.name,
      groups: preset.groups.map(g => ({ label: g.label, classes: [...g.classes] })),
    }))
  }

  const updateGroupLabel = (idx: number, label: string) => {
    updateActiveRatio(r => ({
      ...r, groups: r.groups.map((g, i) => i === idx ? { ...g, label } : g),
    }))
  }

  const toggleClass = (groupIdx: number, cls: AssetAllocation) => {
    updateActiveRatio(r => {
      const next = r.groups.map((g, i) => {
        if (i === groupIdx) {
          const has = g.classes.includes(cls)
          return { ...g, classes: has ? g.classes.filter(c => c !== cls) : [...g.classes, cls] }
        }
        return g
      })
      // Ensure each class is in at most one group
      const used = new Set(next[groupIdx].classes)
      return { ...r, groups: next.map((g, i) => i === groupIdx ? g : { ...g, classes: g.classes.filter(c => !used.has(c)) }) }
    })
  }

  const addGroup = () => {
    if (!activeRatio || activeRatio.groups.length >= 6) return
    updateActiveRatio(r => ({
      ...r, groups: [...r.groups, { label: `Group ${String.fromCharCode(65 + r.groups.length)}`, classes: [] }],
    }))
  }

  const removeGroup = (idx: number) => {
    if (!activeRatio || activeRatio.groups.length <= 2) return
    updateActiveRatio(r => ({
      ...r, groups: r.groups.filter((_, i) => i !== idx),
    }))
  }

  const updateRatioName = (name: string) => {
    updateActiveRatio(r => ({ ...r, name }))
  }

  const updateRatioScope = (s: Scope) => {
    setActivePreset(null)
    setGoalEditing(false)
    setRebalOpen(false)
    updateActiveRatio(r => ({ ...r, scope: s }))
  }

  /* ── dark mode ─────────────────────────────────────────────── */

  const isDark = document.body.classList.contains('dark')
  const tooltipBg = isDark ? '#1f2937' : '#fff'
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb'

  /* ── render helpers ────────────────────────────────────────── */

  const renderDonut = (
    data: { name: string; value: number; color: string }[],
    innerR = 50,
    outerR = 90,
    height = 220,
  ) => {
    if (data.length === 0) return <div className="alloc-page-empty">No data for this scope</div>
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={innerR} outerRadius={outerR}
            paddingAngle={2} dataKey="value" stroke="none">
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '6px 10px', fontSize: 12 }}
            formatter={(v: number) => formatCurrency(v)}
          />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const renderLegend = (data: { name: string; value: number; color: string }[], tot: number) => (
    <div className="alloc-page-legend">
      {data.map((d, i) => (
        <div key={i} className="alloc-page-legend-row">
          <span className="alloc-page-legend-dot" style={{ background: d.color }} />
          <span className="alloc-page-legend-label">{d.name}</span>
          <span className="alloc-page-legend-val">
            {legendMode === 'pct' ? `${((d.value / tot) * 100).toFixed(1)}%` : formatCurrency(d.value)}
          </span>
        </div>
      ))}
    </div>
  )

  const renderRatioBar = (data: { name: string; value: number; color: string }[], tot: number) => {
    if (data.length === 0 || tot === 0) return null
    return (
      <div className="alloc-ratio-bar-wrap">
        <div className="alloc-ratio-bar">
          {data.map((d, i) => {
            const pct = ((d.value / tot) * 100).toFixed(1)
            return (
              <div key={i} className="alloc-ratio-seg" style={{ width: `${pct}%`, background: d.color }}>
                {Number(pct) > 8 && <span className="alloc-ratio-seg-label">{pct}%</span>}
              </div>
            )
          })}
        </div>
        <div className="alloc-ratio-labels">
          {data.map((d, i) => {
            const pct = ((d.value / tot) * 100).toFixed(1)
            return (
              <span key={i} className="alloc-ratio-label">
                <span className="alloc-ratio-label-dot" style={{ background: d.color }} />
                {d.name}: {pct}% ({formatCurrency(d.value)})
              </span>
            )
          })}
        </div>
      </div>
    )
  }

  /* ── main render ───────────────────────────────────────────── */

  return (
    <div className="alloc-page">
      <div className="alloc-page-header">
        <h1 className="alloc-page-title">Allocation</h1>
      </div>

      {/* ── Full breakdown ─────────────────────────────── */}
      <section className="alloc-page-section">
        <div className="alloc-page-section-header">
          <h2>Breakdown</h2>
          <div className="alloc-page-controls">
            <div className="alloc-page-scope-tabs">
              {(['total', 'fi', 'gw'] as Scope[]).map(s => (
                <button key={s} className={`alloc-page-tab${scope === s ? ' active' : ''}`}
                  onClick={() => setScope(s)}>
                  {s === 'total' ? 'Total' : s.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="alloc-page-toggle">
              <button className={`alloc-page-toggle-btn${legendMode === 'pct' ? ' active' : ''}`}
                onClick={() => setLegendMode('pct')}>%</button>
              <button className={`alloc-page-toggle-btn${legendMode === 'val' ? ' active' : ''}`}
                onClick={() => setLegendMode('val')}>$</button>
            </div>
          </div>
        </div>
        <div className="alloc-page-chart-row">
          <div className="alloc-page-donut">
            {renderDonut(slices)}
          </div>
          <div className="alloc-page-legend-col">
            {slices.length > 0 && (
              <>
                <div className="alloc-page-total-label">
                  Total: {formatCurrency(total)}
                </div>
                {renderLegend(slices, total)}
              </>
            )}
            {slices.length === 0 && <div className="alloc-page-empty">No data</div>}
          </div>
        </div>
      </section>

      {/* ── Custom ratio builder ──────────────────────── */}
      <section className="alloc-page-section">
        <div className="alloc-page-section-header">
          <h2>Custom Ratios</h2>
          <div className="alloc-ratio-create-wrap" ref={createMenuRef}>
            <button className="alloc-ratio-create-btn" onClick={() => setCreateMenuOpen(v => !v)}>+ New Ratio</button>
            {createMenuOpen && (
              <div className="alloc-ratio-create-menu">
                <button className="alloc-ratio-create-option" onClick={() => { createRatio(); setCreateMenuOpen(false) }}>
                  Blank
                </button>
                {PRESETS.map(p => (
                  <button key={p.id} className="alloc-ratio-create-option" onClick={() => createFromPreset(p)}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ratio tabs */}
        {customRatios.length > 0 && (
          <div className="alloc-ratio-tabs">
            {customRatios.map(r => (
              <div key={r.id}
                className={`alloc-ratio-tab${r.id === activeRatioId ? ' active' : ''}`}
                onClick={() => { setActiveRatioId(r.id); setActivePreset(null); setConfirmDeleteId(null) }}>
                <span className="alloc-ratio-tab-name">{r.name}</span>
                <button className="alloc-ratio-tab-delete" onClick={e => { e.stopPropagation(); requestDeleteRatio(r.id) }}
                  title="Delete ratio">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Inline delete confirm */}
        {confirmDeleteId && (() => {
          const r = customRatios.find(cr => cr.id === confirmDeleteId)
          if (!r) return null
          const scopes = Object.keys(r.goals ?? {}).map(s => s === 'total' ? 'Total' : s.toUpperCase()).join(', ')
          return (
            <div className="alloc-ratio-confirm-bar">
              <span>Delete <strong>{r.name}</strong>? Goals for {scopes} will also be removed.</span>
              <button className="alloc-ratio-confirm-yes" onClick={() => doDeleteRatio(confirmDeleteId)}>Delete</button>
              <button className="alloc-ratio-confirm-no" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
            </div>
          )
        })()}

        {customRatios.length === 0 && (
          <div className="alloc-page-empty">No custom ratios yet. Click "+ New Ratio" to get started.</div>
        )}

        {/* Result — actual vs goal */}
        {activeRatio && customRatioData.length > 0 && (() => {
          const scopeGoal = activeRatio.goals?.[activeRatio.scope] ?? null
          const goalPcts = scopeGoal ? computeGoalPcts(scopeGoal, activeRatio.groups.length) : null
          const goalData = goalPcts ? activeRatio.groups.map((g, i) => ({
            name: g.label, pct: goalPcts[i], color: GROUP_COLORS[i % GROUP_COLORS.length],
          })) : null
          return (
            <div className="alloc-ratio-result">
              <div className="alloc-ratio-result-row">
                <div className="alloc-ratio-donut">
                  {renderDonut(customRatioData, 40, 72, 180)}
                </div>
                <div className="alloc-ratio-detail">
                  {/* Actual bar */}
                  <div className="alloc-ratio-bar-label">Actual</div>
                  {renderRatioBar(customRatioData, customRatioTotal)}

                  {/* Goal bar */}
                  {goalData && (
                    <>
                      <div className="alloc-ratio-bar-label" style={{ marginTop: '0.75rem' }}>
                        Goal{scopeGoal?.type === 'gradual' ? ` (age ${getAge(scopeGoal.owner) ?? '?'})` : ''}
                      </div>
                      <div className="alloc-ratio-bar-wrap">
                        <div className="alloc-ratio-bar">
                          {goalData.map((d, i) => (
                            <div key={i} className="alloc-ratio-seg" style={{ width: `${d.pct}%`, background: d.color, opacity: 0.5 }}>
                              {d.pct > 8 && <span className="alloc-ratio-seg-label">{d.pct}%</span>}
                            </div>
                          ))}
                        </div>
                        <div className="alloc-ratio-labels">
                          {goalData.map((d, i) => {
                            const actualPct = customRatioTotal > 0 ? ((customRatioData.find(cd => cd.name === d.name)?.value ?? 0) / customRatioTotal * 100) : 0
                            const diff = actualPct - d.pct
                            const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)
                            return (
                              <span key={i} className="alloc-ratio-label">
                                <span className="alloc-ratio-label-dot" style={{ background: d.color }} />
                                {d.name}: {d.pct}%
                                <span className={`alloc-ratio-diff${Math.abs(diff) < 1 ? ' on-track' : diff > 0 ? ' over' : ' under'}`}>
                                  ({diffStr}%)
                                </span>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Builder */}
        {activeRatio && (
        <div className="alloc-ratio-builder">
          <div className="alloc-ratio-builder-header">
            <span className="alloc-ratio-builder-label">Name</span>
            <input className="alloc-ratio-name-input" value={activeRatio.name}
              onChange={e => updateRatioName(e.target.value)} />
            <span className="alloc-ratio-builder-label" style={{ marginLeft: '0.75rem' }}>Scope</span>
            <div className="alloc-page-scope-tabs">
              {(['total', 'fi', 'gw'] as Scope[]).map(s => (
                <button key={s}
                  className={`alloc-page-tab${activeRatio.scope === s ? ' active' : ''}`}
                  onClick={() => updateRatioScope(s)}>
                  {s === 'total' ? 'Total' : s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="alloc-ratio-groups">
            {activeRatio.groups.map((group, gi) => (
              <div key={gi} className="alloc-ratio-group">
                <div className="alloc-ratio-group-header">
                  <span className="alloc-ratio-group-dot" style={{ background: GROUP_COLORS[gi % GROUP_COLORS.length] }} />
                  <input
                    className="alloc-ratio-group-name"
                    value={group.label}
                    onChange={e => updateGroupLabel(gi, e.target.value)}
                  />
                  {activeRatio.groups.length > 2 && (
                    <button className="alloc-ratio-group-remove" onClick={() => removeGroup(gi)} title="Remove group">×</button>
                  )}
                </div>
                <div className="alloc-ratio-class-pills">
                  {ALL_CLASSES.map(cls => {
                    const isSelected = group.classes.includes(cls)
                    const usedElsewhere = !isSelected && activeRatio.groups.some((g, i) => i !== gi && g.classes.includes(cls))
                    return (
                      <button key={cls}
                        className={`alloc-ratio-pill${isSelected ? ' active' : ''}${usedElsewhere ? ' used' : ''}`}
                        onClick={() => toggleClass(gi, cls)}
                        disabled={usedElsewhere}
                        style={isSelected ? { background: GROUP_COLORS[gi % GROUP_COLORS.length], borderColor: GROUP_COLORS[gi % GROUP_COLORS.length] } : undefined}
                      >
                        {ALLOCATION_LABELS[cls]}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {activeRatio.groups.length < 6 && (
            <button className="alloc-ratio-add-group" onClick={addGroup}>
              + Add Group
            </button>
          )}

          {/* ── Goal section (per scope) ────────────────── */}
          <div className="alloc-goal-section">
            <div className="alloc-goal-scope-label">Goal for <strong>{activeRatio.scope === 'total' ? 'Total' : activeRatio.scope.toUpperCase()}</strong></div>
            {(() => {
              const scopeGoal = activeRatio.goals?.[activeRatio.scope] ?? null
              const otherScopes = (['total', 'fi', 'gw'] as Scope[]).filter(s => s !== activeRatio.scope && activeRatio.goals?.[s])
              return (
                <>
                  {!scopeGoal && !goalEditing && (
                    <button className="alloc-goal-set-btn" onClick={() => setGoalEditing(true)}>
                      Set Goal
                    </button>
                  )}
                  {scopeGoal && !goalEditing && (
                    <div className="alloc-goal-summary">
                      <span className="alloc-goal-summary-text">
                        {scopeGoal.type === 'constant'
                          ? activeRatio.groups.map((g, i) => `${g.label} ${(scopeGoal as ConstantGoal).pcts[i] ?? 0}%`).join(' / ')
                          : (() => {
                              const gr = scopeGoal as GradualGoal
                              return `Age ${gr.startAge}→${gr.endAge} (${gr.owner}): ${activeRatio.groups.map((g, i) => `${g.label} ${gr.startPcts[i]}→${gr.endPcts[i]}%`).join(' / ')}`
                            })()
                        }
                      </span>
                      <button className="alloc-goal-edit-btn" onClick={() => { setGoalEditing(true); setRebalOpen(false) }}>Edit</button>
                      <button className="alloc-goal-edit-btn" onClick={() => { setRebalOpen(v => !v); setGoalEditing(false) }}>
                        {rebalOpen ? 'Hide Rebalance' : 'Rebalance'}
                      </button>
                      <button className="alloc-goal-remove-btn" onClick={() => setGoalForScope(activeRatio.scope, null)}>Remove</button>
                    </div>
                  )}
                  {goalEditing && <GoalEditor
                    groups={activeRatio.groups}
                    existingGoal={scopeGoal}
                    hasPrimary={!!profile.birthday}
                    hasPartner={!!profile.partner?.birthday}
                    primaryName={profile.name || ''}
                    partnerName={profile.partner?.name || ''}
                    onSave={g => { setGoalForScope(activeRatio.scope, g); setGoalEditing(false) }}
                    onCancel={() => setGoalEditing(false)}
                  />}
                  {rebalOpen && !goalEditing && scopeGoal && (() => {
                    const gp = computeGoalPcts(scopeGoal, activeRatio.groups.length)
                    if (!gp) return null
                    const actuals = activeRatio.groups.map(g => {
                      const m = allocMap.get(activeRatio.scope)
                      if (!m) return 0
                      return g.classes.reduce((sum, cls) => sum + Math.max(0, m.get(cls) ?? 0), 0)
                    })
                    return <RebalancePanel
                      groups={activeRatio.groups}
                      actualValues={actuals}
                      goalPcts={gp}
                      onClose={() => setRebalOpen(false)}
                    />
                  })()}
                  {otherScopes.length > 0 && (
                    <div className="alloc-goal-other-scopes">
                      {otherScopes.map(s => (
                        <span key={s} className="alloc-goal-other-badge">{s === 'total' ? 'Total' : s.toUpperCase()} has goal</span>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
        )}
      </section>
    </div>
  )
}

export default Allocation
