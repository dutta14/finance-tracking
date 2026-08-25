import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import useLeverage, {
  useLeverageSettings,
  type AssetBreakdown,
  type RatioDataPoint,
  type LeverageAllocation,
  type LeverageScenario,
} from '../../../hooks/useLeverage'
import { useData } from '../../../contexts/DataContext'
import { useDateFilter } from '../../../hooks/useDateFilter'
import { DateFilterBar } from '../../../components/DateFilterBar'
import '../../../styles/Leverage.css'

type AllocationType = 'loan' | 'mortgage'

type ScenarioAllocation = LeverageAllocation
type ScenarioState = LeverageScenario

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
  target: string
  allocations: ScenarioAllocation[]
  error: string | null
  targetValue: number | null
  totalBorrow: number | null
  baseBorrow: number | null
  upgradeMortgageTotal: number
  newAssets: number | null
  newLiabilities: number | null
  newRatio: number | null
  allocationResults: AllocationResult[]
  allocatedTotal: number
  remaining: number
}

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

  const borrowAmount = (totalBorrow * sharePct) / 100

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
      <div className="lever-tooltip-row">
        <span>Assets</span>
        <strong>{formatCurrency(point.assets)}</strong>
      </div>
      <div className="lever-tooltip-row">
        <span>Liabilities</span>
        <strong>{formatCurrency(point.liabilities)}</strong>
      </div>
      <div className="lever-tooltip-row">
        <span>Ratio</span>
        <strong>{point.ratio === null ? '—' : formatRatio(point.ratio)}</strong>
      </div>
    </div>
  )
}

type RealEstateProperty = { accountId: number; name: string; value: number; mortgage: number; equity: number }

const ALLOCATION_PRESETS = [
  { label: 'Rental Property', type: 'mortgage' as AllocationType, downPaymentPct: '30', mortgageRate: '7' },
  { label: 'Margin Loan', type: 'loan' as AllocationType, mortgageRate: '6' },
]

const ScenarioCard = ({
  scenario,
  onChange,
  createAllocation,
  assetBreakdown,
  liabilityBreakdown,
  currentNetWorth,
  realEstateProperties,
  totalAssets,
  totalLiabilities,
}: {
  scenario: ScenarioView
  onChange: (updates: Partial<ScenarioState>) => void
  createAllocation: (index: number) => ScenarioAllocation
  assetBreakdown: AssetBreakdown
  liabilityBreakdown: AssetBreakdown
  currentNetWorth: number
  realEstateProperties: RealEstateProperty[]
  totalAssets: number
  totalLiabilities: number
}) => {
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [upgradeSubOpen, setUpgradeSubOpen] = useState(false)
  const [leverageInfoOpen, setLeverageInfoOpen] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!leverageInfoOpen) return
    const handleClick = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setLeverageInfoOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [leverageInfoOpen])

  const addAllocation = (preset: (typeof ALLOCATION_PRESETS)[number]) => {
    const alloc = createAllocation(scenario.allocations.length)
    onChange({
      allocations: [
        ...scenario.allocations,
        {
          ...alloc,
          label: preset.label,
          type: preset.type,
          ...(preset.downPaymentPct ? { downPaymentPct: preset.downPaymentPct } : {}),
          ...(preset.mortgageRate ? { mortgageRate: preset.mortgageRate } : {}),
        },
      ],
    })
    setAddMenuOpen(false)
    setUpgradeSubOpen(false)
  }

  const addUpgradeAllocation = (property: RealEstateProperty) => {
    const alloc = createAllocation(scenario.allocations.length)
    onChange({
      allocations: [
        ...scenario.allocations,
        {
          ...alloc,
          label: `Upgrade ${property.name}`,
          type: 'mortgage',
          mortgageRate: '7',
          upgradeFromAccountId: property.accountId,
        },
      ],
    })
    setAddMenuOpen(false)
    setUpgradeSubOpen(false)
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
        <div className="scenario-card__target-inline">
          <label className="scenario-card__target-label">Target</label>
          <input
            className="scenario-card__target-input"
            type="text"
            inputMode="decimal"
            value={scenario.target}
            onChange={e => onChange({ target: e.target.value })}
            placeholder="—"
          />
          <span className="scenario-card__target-colon">: 1</span>
        </div>
      </header>
      {scenario.error && <p className="lever-error lever-error--compact">{scenario.error}</p>}

      <div className="scenario-card__summary">
        <div ref={infoRef} className="scenario-card__summary-metric scenario-card__summary-metric--info">
          <span>
            Available Leverage
            <button
              className="lever-info-btn"
              type="button"
              onClick={() => setLeverageInfoOpen(o => !o)}
              aria-label="Leverage breakdown"
            >
              i
            </button>
          </span>
          <strong>{scenario.totalBorrow === null ? '—' : formatCurrency(scenario.totalBorrow)}</strong>
          {leverageInfoOpen && scenario.totalBorrow !== null && (
            <div className="lever-info-tooltip">
              <div className="lever-info-tooltip__row">
                <span>Current assets</span>
                <span>{formatCurrency(totalAssets)}</span>
              </div>
              <div className="lever-info-tooltip__row">
                <span>Current liabilities</span>
                <span>{formatCurrency(totalLiabilities)}</span>
              </div>
              {scenario.upgradeMortgageTotal > 0 && (
                <>
                  <div className="lever-info-tooltip__divider" />
                  <div className="lever-info-tooltip__row lever-info-tooltip__row--muted">
                    <span>Mortgages paid off</span>
                    <span>−{formatCurrency(scenario.upgradeMortgageTotal)}</span>
                  </div>
                  <div className="lever-info-tooltip__row">
                    <span>Post-sale assets</span>
                    <span>{formatCurrency(totalAssets - scenario.upgradeMortgageTotal)}</span>
                  </div>
                  <div className="lever-info-tooltip__row">
                    <span>Post-sale liabilities</span>
                    <span>{formatCurrency(totalLiabilities - scenario.upgradeMortgageTotal)}</span>
                  </div>
                  <div className="lever-info-tooltip__row lever-info-tooltip__row--bold">
                    <span>Post-sale ratio</span>
                    <span>
                      {totalLiabilities - scenario.upgradeMortgageTotal > 0
                        ? formatRatio(
                            (totalAssets - scenario.upgradeMortgageTotal) /
                              (totalLiabilities - scenario.upgradeMortgageTotal),
                          )
                        : '∞'}
                    </span>
                  </div>
                </>
              )}
              <div className="lever-info-tooltip__divider" />
              <div className="lever-info-tooltip__row">
                <span>Base capacity</span>
                <span>{scenario.baseBorrow !== null ? formatCurrency(scenario.baseBorrow) : '—'}</span>
              </div>
              {scenario.upgradeMortgageTotal > 0 && (
                <div className="lever-info-tooltip__row lever-info-tooltip__row--muted">
                  <span>Freed by upgrades</span>
                  <span>+{formatCurrency(scenario.upgradeMortgageTotal)}</span>
                </div>
              )}
              <div className="lever-info-tooltip__row lever-info-tooltip__row--bold">
                <span>Total available</span>
                <span>{formatCurrency(scenario.totalBorrow)}</span>
              </div>
              {scenario.newAssets !== null && scenario.newLiabilities !== null && (
                <>
                  <div className="lever-info-tooltip__divider" />
                  <div className="lever-info-tooltip__row">
                    <span>Final assets</span>
                    <span>{formatCurrency(scenario.newAssets)}</span>
                  </div>
                  <div className="lever-info-tooltip__row">
                    <span>Final liabilities</span>
                    <span>{formatCurrency(scenario.newLiabilities)}</span>
                  </div>
                  <div className="lever-info-tooltip__row lever-info-tooltip__row--bold">
                    <span>Final ratio</span>
                    <span>{scenario.newRatio ? formatRatio(scenario.newRatio) : '—'}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="scenario-card__summary-metric">
          <span>Allocated</span>
          <strong>{formatCurrency(scenario.allocatedTotal)}</strong>
        </div>
        <div
          className={`scenario-card__summary-metric${isOverAllocated ? ' scenario-card__summary-metric--warning' : ''}`}
        >
          <span>{isOverAllocated ? 'Over by' : 'Remaining'}</span>
          <strong>{scenario.totalBorrow === null ? '—' : formatCurrency(Math.abs(scenario.remaining))}</strong>
        </div>
      </div>

      <div className="scenario-card__allocations">
        <div className="scenario-card__alloc-header">
          <h4>Allocations</h4>
          <div className="scenario-card__add-wrap">
            <button className="action-btn" type="button" onClick={() => setAddMenuOpen(o => !o)}>
              + Add
            </button>
            {addMenuOpen && (
              <div className="scenario-card__add-menu">
                {ALLOCATION_PRESETS.map(preset => (
                  <button key={preset.label} type="button" onClick={() => addAllocation(preset)}>
                    {preset.label}
                  </button>
                ))}
                {realEstateProperties.length > 0 && (
                  <div
                    className="scenario-card__add-submenu-wrap"
                    onMouseEnter={() => setUpgradeSubOpen(true)}
                    onMouseLeave={() => setUpgradeSubOpen(false)}
                  >
                    <button type="button" className="scenario-card__add-submenu-trigger">
                      Upgrade Property
                      <span aria-hidden="true">›</span>
                    </button>
                    {upgradeSubOpen && (
                      <div className="scenario-card__add-submenu">
                        {realEstateProperties.map(prop => {
                          const used = scenario.allocations.some(a => a.upgradeFromAccountId === prop.accountId)
                          return (
                            <button
                              key={prop.accountId}
                              type="button"
                              disabled={used}
                              onClick={() => addUpgradeAllocation(prop)}
                            >
                              <span className="add-submenu__name">{prop.name}</span>
                              <span className="add-submenu__equity">{formatCurrency(prop.equity)} equity</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {scenario.allocations.length === 0 ? (
          <p className="scenario-card__empty">No allocations yet. Add a loan or mortgage to split this capacity.</p>
        ) : (
          <div className="alloc-card-grid">
            {scenario.allocations.map(allocation => {
              const derived = scenario.totalBorrow ? computeAllocationResult(allocation, scenario.totalBorrow) : null

              return (
                <div className="alloc-card" key={allocation.id}>
                  <div className="alloc-card__top">
                    <div className="alloc-card__icon">
                      {allocation.type === 'mortgage' ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 10.5L12 3l9 7.5V21H3V10.5z" />
                          <path d="M9 21V14h6v7" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M2 20h20M5 20V10l4 3V20M11 20V8l4 4v8M17 20V6l4 5v9" />
                        </svg>
                      )}
                    </div>
                    <input
                      className="lever-input alloc-card__name"
                      value={allocation.label}
                      onChange={event => updateAllocation(allocation.id, { label: event.target.value })}
                      aria-label="Allocation label"
                    />
                    <button
                      className="alloc-card__remove"
                      type="button"
                      onClick={() => removeAllocation(allocation.id)}
                      aria-label={`Remove ${allocation.label}`}
                    >
                      ×
                    </button>
                  </div>
                  <div className="alloc-card__fields">
                    <label className="alloc-card__field">
                      <span className="alloc-card__field-label">Allocation</span>
                      <div className="alloc-card__field-input">
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
                        />
                        <span className="alloc-card__unit">%</span>
                      </div>
                    </label>
                    {allocation.type === 'mortgage' && (
                      <label className="alloc-card__field">
                        <span className="alloc-card__field-label">Down</span>
                        <div className="alloc-card__field-input">
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
                          />
                          <span className="alloc-card__unit">%</span>
                        </div>
                      </label>
                    )}
                    <label className="alloc-card__field">
                      <span className="alloc-card__field-label">Rate</span>
                      <div className="alloc-card__field-input">
                        <input
                          className="lever-input"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="30"
                          step="0.1"
                          value={allocation.mortgageRate}
                          onChange={event => updateAllocation(allocation.id, { mortgageRate: event.target.value })}
                          aria-label="Interest rate"
                        />
                        <span className="alloc-card__unit">%</span>
                      </div>
                    </label>
                  </div>
                  {derived &&
                    (() => {
                      const upgradeProp = allocation.upgradeFromAccountId
                        ? realEstateProperties.find(p => p.accountId === allocation.upgradeFromAccountId)
                        : undefined
                      const netOutOfPocket = upgradeProp ? derived.downPayment - upgradeProp.equity : null

                      return (
                        <div className="alloc-card__derived">
                          <div className="alloc-card__derived-row">
                            <span className="alloc-card__derived-label">Borrow</span>
                            <span>{formatCurrency(derived.borrowAmount)}</span>
                          </div>
                          {derived.type === 'mortgage' && (
                            <>
                              <div className="alloc-card__derived-row">
                                <span className="alloc-card__derived-label">Purchase price</span>
                                <span>{formatCurrency(derived.purchasePrice)}</span>
                              </div>
                              <div className="alloc-card__derived-row">
                                <span className="alloc-card__derived-label">Down payment</span>
                                <span>{formatCurrency(derived.downPayment)}</span>
                              </div>
                              {upgradeProp && (
                                <>
                                  <div className="alloc-card__derived-row alloc-card__derived-row--credit">
                                    <span className="alloc-card__derived-label">Equity from {upgradeProp.name}</span>
                                    <span>−{formatCurrency(upgradeProp.equity)}</span>
                                  </div>
                                  <div className="alloc-card__derived-row alloc-card__derived-row--net">
                                    <span className="alloc-card__derived-label">Net out-of-pocket</span>
                                    <span>{formatCurrency(Math.max(0, netOutOfPocket ?? 0))}</span>
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })()}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!scenario.error && scenario.totalBorrow !== null && (
        <>
          {scenario.allocationResults.length > 0 &&
            currentNetWorth > 0 &&
            (() => {
              // For upgrades, net cash into RE = down payment - equity from sold property
              const netRECashFlow = scenario.allocations.reduce((sum, alloc) => {
                const result = scenario.allocationResults.find(r => r.label === alloc.label)
                if (!result || result.type !== 'mortgage') return sum
                const upgradeEquity = alloc.upgradeFromAccountId
                  ? (realEstateProperties.find(p => p.accountId === alloc.upgradeFromAccountId)?.equity ?? 0)
                  : 0
                return sum + result.downPayment - upgradeEquity
              }, 0)

              const reAssets = assetBreakdown['real-estate'] || 0
              const reLiabilities = liabilityBreakdown['real-estate'] || 0
              const beforeREEquity = reAssets - reLiabilities
              const afterREEquity = beforeREEquity + netRECashFlow
              const beforeOtherEquity = currentNetWorth - beforeREEquity
              const afterOtherEquity = beforeOtherEquity - netRECashFlow
              const afterNetWorth = afterREEquity + afterOtherEquity
              const pct = (v: number, total: number) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '—')

              return (
                <div className="scenario-card__asset-alloc">
                  <h4>Impact</h4>
                  <div className="scenario-asset-table">
                    <div className="scenario-asset-row scenario-asset-row--head">
                      <span />
                      <strong>Before</strong>
                      <strong>After</strong>
                    </div>
                    <div className="scenario-asset-row">
                      <span>RE equity</span>
                      <span>
                        {formatCurrency(beforeREEquity)} ({pct(beforeREEquity, currentNetWorth)})
                      </span>
                      <span>
                        {formatCurrency(afterREEquity)} ({pct(afterREEquity, afterNetWorth)})
                      </span>
                    </div>
                    <div className="scenario-asset-row">
                      <span>Other equity</span>
                      <span>
                        {formatCurrency(beforeOtherEquity)} ({pct(beforeOtherEquity, currentNetWorth)})
                      </span>
                      <span>
                        {formatCurrency(afterOtherEquity)} ({pct(afterOtherEquity, afterNetWorth)})
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}
        </>
      )}
    </article>
  )
}

const LeverageGoal = () => {
  const { allMonths } = useData()
  const {
    totalAssets,
    totalLiabilities,
    netWorth,
    currentRatio,
    assetBreakdown,
    liabilityBreakdown,
    realEstateProperties,
    computeAcquisition,
    getRatioHistory,
  } = useLeverage()
  const { settings, setSettings } = useLeverageSettings()
  const { scenarios } = settings
  const chartStartMonth = settings.chartStart || allMonths[0] || ''
  const [trendViewMode, setTrendViewMode] = useState<'chart' | 'table'>('chart')
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarios[0]?.id || '')
  const [scenarioMenuOpen, setScenarioMenuOpen] = useState<string | null>(null)
  const [scenarioRenaming, setScenarioRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const setScenarios = useCallback(
    (updater: (prev: ScenarioState[]) => ScenarioState[]) =>
      setSettings(prev => ({ ...prev, scenarios: updater(prev.scenarios) })),
    [setSettings],
  )

  const scenarioIdRef = useRef(1)
  const allocationIdRef = useRef(1)
  scenarioIdRef.current = Math.max(scenarioIdRef.current, scenarios.length + 1)
  allocationIdRef.current = Math.max(
    allocationIdRef.current,
    scenarios.reduce((sum, s) => sum + s.allocations.length, 0) + 1,
  )

  const ratioHistory = useMemo(() => getRatioHistory(chartStartMonth || undefined), [getRatioHistory, chartStartMonth])
  const validHistoryCount = ratioHistory.filter(point => point.ratio !== null).length

  const ratioMonths = useMemo(() => ratioHistory.map(p => p.month), [ratioHistory])
  const trendDateFilter = useDateFilter(ratioMonths)

  const filteredRatioHistory = useMemo(() => {
    const allowed = new Set(trendDateFilter.filteredMonths)
    return ratioHistory.filter(p => allowed.has(p.month))
  }, [ratioHistory, trendDateFilter.filteredMonths])

  const createAllocation = useCallback(
    (index: number): ScenarioAllocation => ({
      id: `allocation-${allocationIdRef.current++}`,
      label: `Allocation ${index + 1}`,
      type: 'loan',
      sharePct: '',
      downPaymentPct: '20',
      mortgageRate: '',
    }),
    [],
  )

  const addScenario = () => {
    const nextId = `scenario-${scenarioIdRef.current++}`
    setScenarios(prev => [
      ...prev,
      {
        id: nextId,
        name: `Scenario ${prev.length + 1}`,
        target: '',
        allocations: [],
      },
    ])
  }

  const updateScenario = (id: string, updates: Partial<ScenarioState>) => {
    setScenarios(prev => prev.map(scenario => (scenario.id === id ? { ...scenario, ...updates } : scenario)))
  }

  const buildScenarioView = useCallback(
    (scenario: ScenarioState): ScenarioView => {
      const nextTargetValue = parseNumber(scenario.target || '')
      const error = getPlannerError({ currentRatio, targetValue: nextTargetValue })

      // Sum mortgage balances from properties being sold (upgrade allocations)
      const upgradeMortgageTotal = scenario.allocations.reduce((sum, a) => {
        if (!a.upgradeFromAccountId) return sum
        const prop = realEstateProperties.find(p => p.accountId === a.upgradeFromAccountId)
        return sum + (prop?.mortgage ?? 0)
      }, 0)

      // Base borrow from current position (without upgrades)
      const baseResult = error ? null : computeAcquisition(nextTargetValue as number, 0)
      const baseBorrow = baseResult?.acquisitionAmount ?? 0

      // Adjusted total: selling upgrades frees capacity equal to their mortgages
      const adjustedBorrow = baseBorrow + upgradeMortgageTotal
      const totalBorrow = error || adjustedBorrow <= 0 ? null : adjustedBorrow

      // Recompute final position accounting for upgrade sales
      const newAssets = totalBorrow !== null ? totalAssets + totalBorrow - upgradeMortgageTotal : null
      const newLiabilities = totalBorrow !== null ? totalLiabilities + totalBorrow - upgradeMortgageTotal : null
      const newRatio =
        newAssets !== null && newLiabilities !== null && newLiabilities > 0 ? newAssets / newLiabilities : null

      const allocationResults =
        totalBorrow !== null && totalBorrow > 0
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
        baseBorrow: error ? null : baseBorrow,
        upgradeMortgageTotal,
        newAssets,
        newLiabilities,
        newRatio,
        allocationResults,
        allocatedTotal,
        remaining: totalBorrow === null ? 0 : totalBorrow - allocatedTotal,
      }
    },
    [computeAcquisition, currentRatio, realEstateProperties, totalAssets, totalLiabilities],
  )

  const scenarioViews = useMemo<ScenarioView[]>(() => scenarios.map(buildScenarioView), [buildScenarioView, scenarios])

  const selectedTargetValue = useMemo(() => {
    const selected = scenarioViews.find(s => s.id === selectedScenarioId) || scenarioViews[0]
    return selected?.targetValue ?? null
  }, [scenarioViews, selectedScenarioId])

  const filteredMaxRatio = useMemo(() => {
    const historyMax = filteredRatioHistory.reduce((max, point) => {
      if (point.ratio === null) return max
      return Math.max(max, point.ratio)
    }, 0)
    const targetMax = selectedTargetValue ?? 0
    return Math.max(historyMax, targetMax, 1.5)
  }, [filteredRatioHistory, selectedTargetValue])

  return (
    <div className="goal-container">
      <div className="lever-container">
        <section className="lever-section">
          <div className="lever-status-grid">
            <div className="lever-stat">
              <span className="lever-stat-label">Total Assets</span>
              <strong className="lever-stat-value lever-stat-value--asset">{formatCurrency(totalAssets)}</strong>
            </div>
            <div className="lever-stat">
              <span className="lever-stat-label">Total Liabilities</span>
              <strong className="lever-stat-value lever-stat-value--liability">
                {formatCurrency(totalLiabilities)}
              </strong>
            </div>
            <div className="lever-stat">
              <span className="lever-stat-label">Net Worth</span>
              <strong className="lever-stat-value lever-stat-value--net">{formatCurrency(netWorth)}</strong>
            </div>
            <div className="lever-stat">
              <span className="lever-stat-label">Leverage Ratio</span>
              <strong className="lever-stat-value">{formatRatio(currentRatio)}</strong>
            </div>
          </div>

          {currentRatio === null && <p className="lever-empty-note">No liabilities tracked.</p>}
        </section>

        <section className="lever-section lever-card">
          <div className="lever-section-head lever-section-head--tight">
            <DateFilterBar
              dateFilter={trendDateFilter.dateFilter}
              setDateFilter={trendDateFilter.setDateFilter}
              customFrom={trendDateFilter.customFrom}
              customTo={trendDateFilter.customTo}
              onFromChange={trendDateFilter.setCustomFrom}
              onToChange={trendDateFilter.setCustomTo}
              allMonths={ratioMonths}
            />
            <div className="tab-bar">
              <button
                className={`tab-btn tab-btn--sm${trendViewMode === 'chart' ? ' active' : ''}`}
                onClick={() => setTrendViewMode('chart')}
              >
                Chart
              </button>
              <button
                className={`tab-btn tab-btn--sm${trendViewMode === 'table' ? ' active' : ''}`}
                onClick={() => setTrendViewMode('table')}
              >
                Table
              </button>
            </div>
          </div>

          {currentRatio === null || validHistoryCount < 2 ? (
            <div className="lever-chart-empty">
              {currentRatio === null
                ? 'Add liability balances to chart leverage history.'
                : 'Need at least two months of leverage data.'}
            </div>
          ) : trendViewMode === 'chart' ? (
            <div className="lever-chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={filteredRatioHistory} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
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
                    tickFormatter={value => `${Number(value).toFixed(1)} : 1`}
                    domain={[1, Number((filteredMaxRatio + 0.4).toFixed(1))]}
                  />
                  <Tooltip content={<RatioTooltip />} />
                  {selectedTargetValue !== null && (
                    <ReferenceLine y={selectedTargetValue} stroke="var(--color-text-muted)" strokeDasharray="5 4" />
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
          ) : (
            <div className="lever-table-wrap">
              <table className="lever-trend-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Assets</th>
                    <th>Liabilities</th>
                    <th>Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRatioHistory.map(point => (
                    <tr key={point.label}>
                      <td>{point.label}</td>
                      <td>{formatCurrency(point.assets)}</td>
                      <td>{formatCurrency(point.liabilities)}</td>
                      <td>{point.ratio === null ? '—' : formatRatio(point.ratio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="lever-scenarios-layout">
          <div className="lever-scenarios-main">
            {(() => {
              const selected = scenarioViews.find(s => s.id === selectedScenarioId) || scenarioViews[0]
              if (!selected) return <p className="lever-sidebar-empty">Add a scenario to get started.</p>
              return (
                <ScenarioCard
                  key={selected.id}
                  scenario={selected}
                  onChange={updates => updateScenario(selected.id, updates)}
                  createAllocation={createAllocation}
                  assetBreakdown={assetBreakdown}
                  liabilityBreakdown={liabilityBreakdown}
                  currentNetWorth={netWorth}
                  realEstateProperties={realEstateProperties}
                  totalAssets={totalAssets}
                  totalLiabilities={totalLiabilities}
                />
              )
            })()}
          </div>

          <div className="lever-sidebar">
            <div className="lever-sidebar-section">
              <div className="lever-sidebar-header">
                <h3 className="lever-sidebar-title">Scenarios</h3>
                <button className="action-btn" type="button" onClick={addScenario}>
                  Add
                </button>
              </div>

              <div className="lever-sidebar-cards">
                {scenarioViews.map((scenario, i) => {
                  const isSelected = scenario.id === selectedScenarioId
                  const menuKey = `${scenario.id}-${i}`
                  return (
                    <div
                      key={menuKey}
                      className={`lever-sidebar-card${isSelected ? ' lever-sidebar-card--active' : ''}`}
                      onClick={() => setSelectedScenarioId(scenario.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="lever-sidebar-card-header">
                        {scenarioRenaming === menuKey ? (
                          <input
                            className="lever-sidebar-rename-input"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const trimmed = renameValue.trim()
                                if (trimmed) updateScenario(scenario.id, { name: trimmed })
                                setScenarioRenaming(null)
                              }
                              if (e.key === 'Escape') setScenarioRenaming(null)
                            }}
                            onBlur={() => {
                              const trimmed = renameValue.trim()
                              if (trimmed) updateScenario(scenario.id, { name: trimmed })
                              setScenarioRenaming(null)
                            }}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                          />
                        ) : (
                          <div className="lever-sidebar-card-name">{scenario.name || `Scenario ${i + 1}`}</div>
                        )}
                        <div className="lever-sidebar-overflow-wrap">
                          <button
                            className="lever-sidebar-overflow-btn"
                            onClick={e => {
                              e.stopPropagation()
                              setScenarioMenuOpen(scenarioMenuOpen === menuKey ? null : menuKey)
                            }}
                            aria-label={`Options for ${scenario.name}`}
                          >
                            ⋯
                          </button>
                          {scenarioMenuOpen === menuKey && (
                            <div className="lever-sidebar-overflow-menu">
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  setScenarioRenaming(menuKey)
                                  setRenameValue(scenario.name)
                                  setScenarioMenuOpen(null)
                                }}
                              >
                                Rename
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  setScenarios(prev => prev.filter(item => item.id !== scenario.id))
                                  if (isSelected) setSelectedScenarioId('')
                                  setScenarioMenuOpen(null)
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="lever-sidebar-card-stats">
                        <span>
                          Capacity: {scenario.totalBorrow === null ? '—' : formatCurrency(scenario.totalBorrow)}
                        </span>
                        <span>Ratio: {formatRatio(scenario.newRatio)}</span>
                      </div>
                    </div>
                  )
                })}

                {scenarioViews.length === 0 && <p className="lever-sidebar-empty">Add a scenario to get started.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeverageGoal
