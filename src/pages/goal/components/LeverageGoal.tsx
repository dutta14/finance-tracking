import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import useLeverage, { type AssetBreakdown, type RatioDataPoint } from '../../../hooks/useLeverage'
import { useData } from '../../../contexts/DataContext'
import '../../../styles/Leverage.css'

type AllocationType = 'loan' | 'mortgage'

interface ScenarioAllocation {
  id: string
  label: string
  type: AllocationType
  sharePct: string
  downPaymentPct: string
}

interface ScenarioState {
  id: string
  name: string
  allocations: ScenarioAllocation[]
}

interface AllocationResult {
  label: string
  type: AllocationType
  sharePct: number
  borrowAmount: number
  downPaymentPct: number
  purchasePrice: number
  downPayment: number
}

interface ScenarioView {
  id: string
  name: string
  allocations: ScenarioAllocation[]
  error: string | null
  targetValue: number | null
  totalBorrow: number | null
  newAssets: number | null
  newLiabilities: number | null
  newRatio: number | null
  allocationResults: AllocationResult[]
  allocatedTotal: number
  remaining: number
}

const TARGET_STORAGE_KEY = 'al-ratio-target'
const CHART_START_KEY = 'al-chart-start'
const SCENARIOS_KEY = 'al-scenarios'
const MAIN_ALLOC_KEY = 'al-main-allocations'
const MAIN_NAME_KEY = 'al-main-name'

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

const formatRatio = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)} : 1`)

const parseNumber = (value: string) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

const loadStoredTarget = () => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(TARGET_STORAGE_KEY) ?? ''
}

const getPlannerError = ({
  currentRatio,
  targetValue,
}: {
  currentRatio: number | null
  targetValue: number | null
}) => {
  if (currentRatio === null) return 'Track at least one liability to plan leverage.'
  if (targetValue === null) return 'Enter a target ratio below your current leverage.'
  if (targetValue <= 1) return 'Target ratio must be greater than 1.0.'
  if (targetValue >= currentRatio) return `Target ratio must stay below ${currentRatio.toFixed(1)} : 1.`
  return null
}

const computeAllocationResult = (allocation: ScenarioAllocation, totalBorrow: number): AllocationResult | null => {
  const sharePct = parseNumber(allocation.sharePct)
  if (sharePct === null || sharePct <= 0) return null

  const borrowAmount = totalBorrow * sharePct / 100

  if (allocation.type === 'loan') {
    return {
      label: allocation.label,
      type: allocation.type,
      sharePct,
      borrowAmount,
      downPaymentPct: 0,
      purchasePrice: borrowAmount,
      downPayment: 0,
    }
  }

  const downPaymentPct = parseNumber(allocation.downPaymentPct)
  if (downPaymentPct === null || downPaymentPct < 0 || downPaymentPct >= 100) return null

  const downPaymentRatio = downPaymentPct / 100
  const purchasePrice = borrowAmount / (1 - downPaymentRatio)
  const downPayment = purchasePrice * downPaymentRatio

  return {
    label: allocation.label,
    type: allocation.type,
    sharePct,
    borrowAmount,
    downPaymentPct,
    purchasePrice,
    downPayment,
  }
}

const RatioTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: RatioDataPoint }> }) => {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="lever-tooltip">
      <span>{point.label}</span>
      <div className="lever-tooltip-row"><span>Assets</span><strong>{formatCurrency(point.assets)}</strong></div>
      <div className="lever-tooltip-row"><span>Liabilities</span><strong>{formatCurrency(point.liabilities)}</strong></div>
      <div className="lever-tooltip-row"><span>Ratio</span><strong>{point.ratio === null ? '—' : formatRatio(point.ratio)}</strong></div>
    </div>
  )
}

const ScenarioCard = ({
  scenario,
  onChange,
  onRemove,
  createAllocation,
  assetBreakdown,
  liabilityBreakdown,
  currentNetWorth,
}: {
  scenario: ScenarioView
  onChange: (updates: Partial<ScenarioState>) => void
  onRemove?: () => void
  createAllocation: (index: number) => ScenarioAllocation
  assetBreakdown: AssetBreakdown
  liabilityBreakdown: AssetBreakdown
  currentNetWorth: number
}) => {
  const addAllocation = () => {
    onChange({ allocations: [...scenario.allocations, createAllocation(scenario.allocations.length)] })
  }

  const updateAllocation = (allocationId: string, updates: Partial<ScenarioAllocation>) => {
    onChange({
      allocations: scenario.allocations.map(allocation =>
        allocation.id === allocationId ? { ...allocation, ...updates } : allocation,
      ),
    })
  }

  const removeAllocation = (allocationId: string) => {
    onChange({ allocations: scenario.allocations.filter(allocation => allocation.id !== allocationId) })
  }

  const isOverAllocated = scenario.totalBorrow !== null && scenario.remaining < 0

  return (
    <article className="scenario-card">
      <header className="scenario-card__header">
        <input
          className="lever-scenario-name"
          value={scenario.name}
          onChange={event => onChange({ name: event.target.value })}
          aria-label="Scenario name"
        />
        {onRemove && (
          <button className="goal-action-btn goal-action-btn--danger" type="button" onClick={onRemove}>
            Remove
          </button>
        )}
      </header>

      <div className="scenario-card__summary">
        <div className="scenario-card__summary-metric">
          <span>Total capacity</span>
          <strong>{scenario.totalBorrow === null ? '—' : formatCurrency(scenario.totalBorrow)}</strong>
        </div>
        <div className="scenario-card__summary-metric">
          <span>Allocated</span>
          <strong>{formatCurrency(scenario.allocatedTotal)}</strong>
        </div>
        <div
          className={`scenario-card__summary-metric${isOverAllocated ? ' scenario-card__summary-metric--warning' : ''}`}
        >
          <span>{isOverAllocated ? 'Over by' : 'Remaining'}</span>
          <strong>
            {scenario.totalBorrow === null ? '—' : formatCurrency(Math.abs(scenario.remaining))}
          </strong>
        </div>
      </div>

      <div className="scenario-card__allocations">
        <div className="scenario-card__alloc-header">
          <h4>Allocations</h4>
          <button className="goal-action-btn" type="button" onClick={addAllocation}>
            + Add allocation
          </button>
        </div>

        {scenario.allocations.length === 0 ? (
          <p className="scenario-card__empty">No allocations yet. Add a loan or mortgage to split this capacity.</p>
        ) : (
          <>
            <div className="scenario-alloc-header">
              <span>Name</span>
              <span>Type</span>
              <span>Allocation %</span>
              <span>Down %</span>
              <span />
            </div>
            {scenario.allocations.map(allocation => {
            const derived = scenario.totalBorrow ? computeAllocationResult(allocation, scenario.totalBorrow) : null

            return (
              <div className="scenario-alloc-row" key={allocation.id}>
                <input
                  className="lever-input"
                  value={allocation.label}
                  onChange={event => updateAllocation(allocation.id, { label: event.target.value })}
                  aria-label="Allocation label"
                />
                <button
                  type="button"
                  className="lever-type-toggle"
                  onClick={() =>
                    updateAllocation(allocation.id, {
                      type: allocation.type === 'loan' ? 'mortgage' : 'loan',
                    })
                  }
                  aria-label="Allocation type"
                >
                  {allocation.type === 'loan' ? 'Loan' : 'Mortgage'}
                </button>
                <input
                  className="lever-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="1"
                  value={allocation.sharePct}
                  onChange={event => updateAllocation(allocation.id, { sharePct: event.target.value })}
                  aria-label="Allocation share percentage"
                  placeholder="% of total"
                />
                {allocation.type === 'mortgage' ? (
                  <input
                    className="lever-input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="99"
                    step="1"
                    value={allocation.downPaymentPct}
                    onChange={event => updateAllocation(allocation.id, { downPaymentPct: event.target.value })}
                    aria-label="Mortgage down payment percentage"
                    placeholder="Down %"
                  />
                ) : (
                  <div className="scenario-alloc-row__spacer" aria-hidden="true" />
                )}
                <button
                  className="goal-action-btn goal-action-btn--danger"
                  type="button"
                  onClick={() => removeAllocation(allocation.id)}
                  aria-label={`Remove ${allocation.label}`}
                >
                  ×
                </button>
                {derived && (
                  <div className="scenario-alloc-derived">
                    Borrow {formatCurrency(derived.borrowAmount)}
                    {derived.type === 'mortgage' &&
                      ` · Purchase ${formatCurrency(derived.purchasePrice)} · Down ${formatCurrency(derived.downPayment)}`}
                  </div>
                )}
              </div>
            )
          })}
          </>
        )}
      </div>

      {scenario.error ? (
        <p className="lever-error lever-error--compact">{scenario.error}</p>
      ) : scenario.totalBorrow !== null ? (
        <>
          {scenario.allocationResults.length > 0 && currentNetWorth > 0 && (() => {
            const newDownPayments = scenario.allocationResults
              .filter(a => a.type === 'mortgage')
              .reduce((s, a) => s + a.downPayment, 0)

            const reAssets = assetBreakdown['real-estate'] || 0
            const reLiabilities = liabilityBreakdown['real-estate'] || 0
            const beforeREEquity = reAssets - reLiabilities
            const afterREEquity = beforeREEquity + newDownPayments
            const beforeOtherEquity = currentNetWorth - beforeREEquity
            const afterOtherEquity = beforeOtherEquity - newDownPayments
            const afterNetWorth = afterREEquity + afterOtherEquity
            const pct = (v: number, total: number) => total > 0 ? `${(v / total * 100).toFixed(1)}%` : '—'

            return (
              <div className="scenario-card__asset-alloc">
                <span className="lever-field-label">Equity allocation impact</span>
                <div className="scenario-asset-table">
                  <div className="scenario-asset-row scenario-asset-row--head">
                    <span />
                    <strong>Before</strong>
                    <strong>After</strong>
                  </div>
                  <div className="scenario-asset-row">
                    <span>RE equity</span>
                    <span>{formatCurrency(beforeREEquity)} ({pct(beforeREEquity, currentNetWorth)})</span>
                    <span>{formatCurrency(afterREEquity)} ({pct(afterREEquity, afterNetWorth)})</span>
                  </div>
                  <div className="scenario-asset-row">
                    <span>Other equity</span>
                    <span>{formatCurrency(beforeOtherEquity)} ({pct(beforeOtherEquity, currentNetWorth)})</span>
                    <span>{formatCurrency(afterOtherEquity)} ({pct(afterOtherEquity, afterNetWorth)})</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      ) : null}
    </article>
  )
}

const LeverageGoal = () => {
  const { allMonths } = useData()
  const { totalAssets, totalLiabilities, netWorth, currentRatio, assetBreakdown, liabilityBreakdown, computeAcquisition, getRatioHistory } = useLeverage()
  const [targetInput, setTargetInput] = useState(loadStoredTarget)
  const [debouncedTargetInput, setDebouncedTargetInput] = useState(targetInput)
  const [currentScenarioName, setCurrentScenarioName] = useState(
    () => (typeof window !== 'undefined' && window.localStorage.getItem(MAIN_NAME_KEY)) || 'Current plan',
  )
  const [scenarios, setScenarios] = useState<ScenarioState[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = window.localStorage.getItem(SCENARIOS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [mainAllocations, setMainAllocations] = useState<ScenarioAllocation[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = window.localStorage.getItem(MAIN_ALLOC_KEY)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [chartStartMonth, setChartStartMonth] = useState(
    () => (typeof window !== 'undefined' && window.localStorage.getItem(CHART_START_KEY)) || allMonths[0] || '',
  )
  const scenarioIdRef = useRef(scenarios.length + 1)
  const allocationIdRef = useRef(
    Math.max(1, ...mainAllocations.map((_, i) => i + 1), ...scenarios.flatMap(s => s.allocations.map((_, i) => i + 1))) + 1,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios))
  }, [scenarios])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(MAIN_ALLOC_KEY, JSON.stringify(mainAllocations))
  }, [mainAllocations])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(MAIN_NAME_KEY, currentScenarioName)
  }, [currentScenarioName])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedTargetInput(targetInput)
    }, 150)

    return () => window.clearTimeout(timer)
  }, [targetInput])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const next = targetInput.trim()
    if (next) window.localStorage.setItem(TARGET_STORAGE_KEY, next)
    else window.localStorage.removeItem(TARGET_STORAGE_KEY)
  }, [targetInput])

  const targetValue = useMemo(() => parseNumber(debouncedTargetInput), [debouncedTargetInput])

  const plannerError = useMemo(
    () =>
      getPlannerError({
        currentRatio,
        targetValue,
      }),
    [currentRatio, targetValue],
  )

  const plannerResult = useMemo(
    () => (plannerError ? null : computeAcquisition(targetValue as number, 0)),
    [computeAcquisition, plannerError, targetValue],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (chartStartMonth) window.localStorage.setItem(CHART_START_KEY, chartStartMonth)
    else window.localStorage.removeItem(CHART_START_KEY)
  }, [chartStartMonth])

  const ratioHistory = useMemo(() => getRatioHistory(chartStartMonth || undefined), [getRatioHistory, chartStartMonth])
  const latestMonth = allMonths[allMonths.length - 1]
  const latestLabel = latestMonth
    ? (() => {
        const [y, m] = latestMonth.split('-').map(Number)
        return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      })()
    : undefined
  const validHistoryCount = ratioHistory.filter(point => point.ratio !== null).length

  const maxChartRatio = useMemo(() => {
    const historyMax = ratioHistory.reduce((max, point) => {
      if (point.ratio === null) return max
      return Math.max(max, point.ratio)
    }, 0)
    const targetMax = plannerError || targetValue === null ? 0 : targetValue
    return Math.max(historyMax, targetMax, 1.5)
  }, [plannerError, ratioHistory, targetValue])

  const createAllocation = useCallback(
    (index: number): ScenarioAllocation => ({
      id: `allocation-${allocationIdRef.current++}`,
      label: `Allocation ${index + 1}`,
      type: 'loan',
      sharePct: '',
      downPaymentPct: '20',
    }),
    [],
  )

  const addScenario = () => {
    if (!plannerResult || scenarios.length >= 2) return

    const nextId = `scenario-${scenarioIdRef.current++}`
    setScenarios(prev => [
      ...prev,
      {
        id: nextId,
        name: `Scenario ${prev.length + 2}`,
        allocations: [],
      },
    ])
  }

  const updateScenario = (id: string, updates: Partial<ScenarioState>) => {
    setScenarios(prev => prev.map(scenario => (scenario.id === id ? { ...scenario, ...updates } : scenario)))
  }

  const buildScenarioView = useCallback(
    (scenario: ScenarioState): ScenarioView => {
      const nextTargetValue = parseNumber(debouncedTargetInput)
      const error = getPlannerError({ currentRatio, targetValue: nextTargetValue })
      const result = error ? null : computeAcquisition(nextTargetValue as number, 0)
      const totalBorrow = result?.acquisitionAmount ?? null
      const allocationResults = totalBorrow !== null && totalBorrow > 0
        ? scenario.allocations
            .map(a => computeAllocationResult(a, totalBorrow))
            .filter((allocation): allocation is AllocationResult => allocation !== null)
        : []
      const allocatedTotal = allocationResults.reduce((sum, a) => sum + a.borrowAmount, 0)

      return {
        ...scenario,
        error,
        targetValue: nextTargetValue,
        totalBorrow,
        newAssets: result?.newAssets ?? null,
        newLiabilities: result?.newLiabilities ?? null,
        newRatio: result?.newRatio ?? null,
        allocationResults,
        allocatedTotal,
        remaining: totalBorrow === null ? 0 : totalBorrow - allocatedTotal,
      }
    },
    [computeAcquisition, currentRatio, debouncedTargetInput],
  )

  const scenarioViews = useMemo<ScenarioView[]>(() => {
    if (!plannerResult) return []

    const currentPlan = buildScenarioView({
      id: 'current-plan',
      name: currentScenarioName,
      allocations: mainAllocations,
    })

    return [currentPlan, ...scenarios.map(buildScenarioView)]
  }, [buildScenarioView, currentScenarioName, mainAllocations, plannerResult, scenarios])

  return (
    <div className="goal-container">
      <div className="lever-container">
        <section className="lever-section lever-card">
          <div className="lever-section-head">
            <div>
              <p>{latestLabel ? `Based on ${latestLabel} balances` : 'Add balances to see your leverage.'}</p>
            </div>
            <div className="lever-ratio-pills">
              <div className="lever-ratio-pill">
                <span className="lever-ratio-pill-label">Current</span>
                <span className="lever-ratio-pill-value">{formatRatio(currentRatio)}</span>
              </div>
              <div className="lever-ratio-pill lever-ratio-pill--target">
                <span className="lever-ratio-pill-label">Target</span>
                <input
                  className="lever-ratio-pill-input"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="1.01"
                  value={targetInput}
                  onChange={event => setTargetInput(event.target.value)}
                  disabled={currentRatio === null}
                  aria-label="Target ratio"
                />
                <span className="lever-ratio-pill-suffix">: 1</span>
              </div>
            </div>
          </div>

          {plannerError && <p className="lever-error">{plannerError}</p>}

          <div className="lever-status-grid">
            <div className="lever-stat">
              <span>Total Assets</span>
              <strong>{formatCurrency(totalAssets)}</strong>
              {plannerResult && (
                <span className="lever-stat-target">→ {formatCurrency(plannerResult.newAssets)}</span>
              )}
            </div>
            <div className="lever-stat">
              <span>Total Liabilities</span>
              <strong>{formatCurrency(totalLiabilities)}</strong>
              {plannerResult && (
                <span className="lever-stat-target">→ {formatCurrency(plannerResult.newLiabilities)}</span>
              )}
            </div>
            <div className="lever-stat">
              <span>Net Worth</span>
              <strong>{formatCurrency(netWorth)}</strong>
              {plannerResult && (
                <span className="lever-stat-target">→ {formatCurrency(plannerResult.netWorth)}</span>
              )}
            </div>
            <div className="lever-stat">
              <span>Borrow capacity</span>
              <strong>{plannerResult ? formatCurrency(plannerResult.acquisitionAmount) : '—'}</strong>
            </div>
          </div>

          {currentRatio === null && <p className="lever-empty-note">No liabilities tracked.</p>}
        </section>

        <section className="lever-section lever-card">
          <div className="lever-section-head lever-section-head--tight">
            <div className="lever-section-title">
              <h3>Trend chart</h3>
              <p>Track your asset / liability ratio over time.</p>
            </div>
            <label className="lever-chart-start-label">
              <span>From</span>
              <select
                className="lever-chart-start-select"
                value={chartStartMonth}
                onChange={e => setChartStartMonth(e.target.value)}
              >
                {allMonths.map(m => {
                  const [y, mo] = m.split('-').map(Number)
                  return (
                    <option key={m} value={m}>
                      {new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </option>
                  )
                })}
              </select>
            </label>
          </div>

          {currentRatio === null || validHistoryCount < 2 ? (
            <div className="lever-chart-empty">
              {currentRatio === null
                ? 'Add liability balances to chart leverage history.'
                : 'Need at least two months of leverage data.'}
            </div>
          ) : (
            <div className="lever-chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={ratioHistory} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    width={56}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickFormatter={value => `${Number(value).toFixed(1)}:1`}
                    domain={[1, Number((maxChartRatio + 0.4).toFixed(1))]}
                  />
                  <Tooltip content={<RatioTooltip />} />
                  {!plannerError && targetValue !== null && (
                    <ReferenceLine y={targetValue} stroke="var(--color-text-muted)" strokeDasharray="5 4" />
                  )}
                  <Line
                    type="monotone"
                    dataKey="ratio"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {plannerResult && (
          <section className="lever-section lever-card">
            <div className="lever-section-head lever-section-head--tight">
              <div className="lever-section-title">
                <h3>Scenario comparison</h3>
                <p>Compare up to three session-only leverage plans.</p>
              </div>
              <button className="goal-action-btn" type="button" onClick={addScenario} disabled={scenarios.length >= 2}>
                Add scenario
              </button>
            </div>

            <div className="lever-scenarios-grid">
              <ScenarioCard
                scenario={scenarioViews[0]}
                onChange={updates => {
                  if (updates.name !== undefined) setCurrentScenarioName(updates.name)
                  if (updates.allocations !== undefined) setMainAllocations(updates.allocations)
                }}
                createAllocation={createAllocation}
                assetBreakdown={assetBreakdown}
                liabilityBreakdown={liabilityBreakdown}
                currentNetWorth={netWorth}
              />

              {scenarioViews.slice(1).map(scenario => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  onChange={updates => updateScenario(scenario.id, updates)}
                  onRemove={() => setScenarios(prev => prev.filter(item => item.id !== scenario.id))}
                  createAllocation={createAllocation}
                  assetBreakdown={assetBreakdown}
                  liabilityBreakdown={liabilityBreakdown}
                  currentNetWorth={netWorth}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default LeverageGoal
