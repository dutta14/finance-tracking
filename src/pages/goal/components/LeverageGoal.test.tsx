import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { cloneElement, isValidElement, type ReactNode } from 'react'
import LeverageGoal from './LeverageGoal'
import type { AssetBreakdown, LeverageSettings } from '../../../hooks/useLeverage'

const mocks = vi.hoisted(() => ({
  leverageData: {
    totalAssets: 900000,
    totalLiabilities: 300000,
    netWorth: 600000,
    currentRatio: 3 as number | null,
    assetBreakdown: {
      cash: 100000,
      'us-stock': 250000,
      'intl-stock': 50000,
      bonds: 100000,
      'real-estate': 400000,
      others: 0,
      debt: 0,
    } as AssetBreakdown,
    liabilityBreakdown: {
      cash: 0,
      'us-stock': 0,
      'intl-stock': 0,
      bonds: 0,
      'real-estate': 200000,
      others: 0,
      debt: 100000,
    } as AssetBreakdown,
    realEstateProperties: [
      { accountId: 7, name: 'Townhome', value: 400000, mortgage: 200000, equity: 200000 },
      { accountId: 8, name: 'Lake House', value: 300000, mortgage: 120000, equity: 180000 },
    ],
    computeAcquisition: vi.fn(
      (): {
        acquisitionAmount: number
        purchasePrice: number
        downPayment: number
        newAssets: number
        newLiabilities: number
        newRatio: number
        netWorth: number
      } | null => ({
        acquisitionAmount: 100000,
        purchasePrice: 100000,
        downPayment: 0,
        newAssets: 1000000,
        newLiabilities: 400000,
        newRatio: 2.5,
        netWorth: 600000,
      }),
    ),
    getRatioHistory: vi.fn(
      (): { month: string; label: string; ratio: number | null; assets: number; liabilities: number }[] => [
        { month: '2026-01', label: 'Jan 2026', ratio: 2.8, assets: 840000, liabilities: 300000 },
        { month: '2026-02', label: 'Feb 2026', ratio: 2.9, assets: 870000, liabilities: 300000 },
        { month: '2026-03', label: 'Mar 2026', ratio: 3.0, assets: 900000, liabilities: 300000 },
      ],
    ),
  },
  settingsState: {
    settings: {
      target: '',
      currentScenarioName: 'Current plan',
      chartStart: '2026-01',
      mainAllocations: [],
      scenarios: [
        {
          id: 'scenario-1',
          name: 'Upgrade plan',
          target: '2.5',
          allocations: [
            {
              id: 'allocation-1',
              label: 'Upgrade Townhome',
              type: 'mortgage' as const,
              sharePct: '60',
              downPaymentPct: '30',
              mortgageRate: '7',
              upgradeFromAccountId: 7,
            },
            {
              id: 'allocation-2',
              label: 'Margin Loan',
              type: 'loan' as const,
              sharePct: '40',
              downPaymentPct: '20',
              mortgageRate: '6',
            },
          ],
        },
        {
          id: 'scenario-2',
          name: 'Conservative',
          target: '2.2',
          allocations: [],
        },
      ],
    } as LeverageSettings,
    loaded: true,
  },
  setSettings: vi.fn(),
  allMonths: ['2026-01', '2026-02', '2026-03'],
  dateFilter: {
    dateFilter: 'all',
    setDateFilter: vi.fn(),
    customFrom: '',
    customTo: '',
    setCustomFrom: vi.fn(),
    setCustomTo: vi.fn(),
    filteredMonths: ['2026-01', '2026-02', '2026-03'],
  },
}))

let lastRatioData: Array<{ month: string; label: string; ratio: number | null; assets: number; liabilities: number }> =
  []

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="responsive-chart">{children}</div>,
  LineChart: ({
    children,
    data,
  }: {
    children: ReactNode
    data?: Array<{ month: string; label: string; ratio: number | null; assets: number; liabilities: number }>
  }) => {
    lastRatioData = data ?? []
    return <div data-testid="line-chart">{children}</div>
  },
  Line: () => <div data-testid="line-series" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: ({ content }: { content?: ReactNode }) => {
    const sample = lastRatioData[1] ?? lastRatioData[0]
    if (!sample || !isValidElement(content)) return <div data-testid="chart-tooltip" />
    return (
      <div data-testid="chart-tooltip">
        {cloneElement(content as React.ReactElement<Record<string, unknown>>, { active: true, payload: [{ payload: sample }] })}
      </div>
    )
  },
  CartesianGrid: () => <div data-testid="chart-grid" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
}))

vi.mock('../../../hooks/useLeverage', () => ({
  default: () => mocks.leverageData,
  useLeverageSettings: () => ({
    settings: mocks.settingsState.settings,
    setSettings: mocks.setSettings,
    loaded: mocks.settingsState.loaded,
  }),
}))

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => ({
    allMonths: mocks.allMonths,
  }),
}))

vi.mock('../../../hooks/useDateFilter', () => ({
  useDateFilter: () => mocks.dateFilter,
}))

vi.mock('../../../components/DateFilterBar', () => ({
  DateFilterBar: () => <div data-testid="date-filter-bar">Date filter</div>,
}))

function renderLeverageGoal() {
  return render(<LeverageGoal />)
}

describe('LeverageGoal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.leverageData.currentRatio = 3
    mocks.leverageData.totalAssets = 900000
    mocks.leverageData.totalLiabilities = 300000
    mocks.leverageData.netWorth = 600000
    mocks.leverageData.realEstateProperties = [
      { accountId: 7, name: 'Townhome', value: 400000, mortgage: 200000, equity: 200000 },
      { accountId: 8, name: 'Lake House', value: 300000, mortgage: 120000, equity: 180000 },
    ]
    mocks.leverageData.computeAcquisition.mockReturnValue({
      acquisitionAmount: 100000,
      purchasePrice: 100000,
      downPayment: 0,
      newAssets: 1000000,
      newLiabilities: 400000,
      newRatio: 2.5,
      netWorth: 600000,
    })
    mocks.leverageData.getRatioHistory.mockReturnValue([
      { month: '2026-01', label: 'Jan 2026', ratio: 2.8, assets: 840000, liabilities: 300000 },
      { month: '2026-02', label: 'Feb 2026', ratio: 2.9, assets: 870000, liabilities: 300000 },
      { month: '2026-03', label: 'Mar 2026', ratio: 3.0, assets: 900000, liabilities: 300000 },
    ])
    mocks.settingsState.settings = {
      target: '',
      currentScenarioName: 'Current plan',
      chartStart: '2026-01',
      mainAllocations: [],
      scenarios: [
        {
          id: 'scenario-1',
          name: 'Upgrade plan',
          target: '2.5',
          allocations: [
            {
              id: 'allocation-1',
              label: 'Upgrade Townhome',
              type: 'mortgage',
              sharePct: '60',
              downPaymentPct: '30',
              mortgageRate: '7',
              upgradeFromAccountId: 7,
            },
            {
              id: 'allocation-2',
              label: 'Margin Loan',
              type: 'loan',
              sharePct: '40',
              downPaymentPct: '20',
              mortgageRate: '6',
            },
          ],
        },
        {
          id: 'scenario-2',
          name: 'Conservative',
          target: '2.2',
          allocations: [],
        },
      ],
    }
    mocks.allMonths = ['2026-01', '2026-02', '2026-03']
    mocks.dateFilter.filteredMonths = ['2026-01', '2026-02', '2026-03']
  })

  it('renders leverage metrics, chart mode, scenario details, and table mode', async () => {
    const user = userEvent.setup()
    renderLeverageGoal()

    expect(screen.getByText('Total Assets')).toBeInTheDocument()
    expect(screen.getByText('$900,000')).toBeInTheDocument()
    expect(screen.getByText('Leverage Ratio')).toBeInTheDocument()
    expect(screen.getByText('3.0 : 1')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('reference-line')).toBeInTheDocument()
    expect(screen.getByText('Upgrade plan')).toBeInTheDocument()
    expect(screen.getByText('Capacity: $300,000')).toBeInTheDocument()
    expect(screen.getAllByText('Borrow').length).toBeGreaterThan(0)
    expect(screen.getByText('$180,000')).toBeInTheDocument()
    expect(screen.getByText('Net out-of-pocket')).toBeInTheDocument()
    expect(screen.getByText('Impact')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Table' }))

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Jan 2026')).toBeInTheDocument()
    expect(screen.getByText('Mar 2026')).toBeInTheDocument()
  })

  it('opens info and add menus, renames scenarios, and dispatches scenario updates', async () => {
    const user = userEvent.setup()
    renderLeverageGoal()

    await user.click(screen.getByRole('button', { name: 'Leverage breakdown' }))
    expect(screen.getByText('Current assets')).toBeInTheDocument()
    expect(screen.getByText('Freed by upgrades')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    await waitFor(() => expect(screen.queryByText('Current assets')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '+ Add' }))
    expect(screen.getByRole('button', { name: 'Rental Property' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Margin Loan' })).toBeInTheDocument()

    await user.hover(screen.getByRole('button', { name: 'Upgrade Property' }))
    expect(screen.getByRole('button', { name: /Lake House/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rental Property' }))

    const addAllocationUpdater = mocks.setSettings.mock.calls.at(-1)?.[0] as (
      settings: LeverageSettings,
    ) => LeverageSettings
    expect(addAllocationUpdater(mocks.settingsState.settings).scenarios[0].allocations.at(-1)).toEqual(
      expect.objectContaining({
        label: 'Rental Property',
        type: 'mortgage',
        downPaymentPct: '30',
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Options for Upgrade plan' }))
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    const renameInput = screen.getByRole('textbox', { name: 'Scenario name' })
    fireEvent.change(renameInput, { target: { value: 'Bigger upgrade' } })
    fireEvent.blur(renameInput)

    const renameUpdater = mocks.setSettings.mock.calls.at(-1)?.[0] as (settings: LeverageSettings) => LeverageSettings
    expect(renameUpdater(mocks.settingsState.settings).scenarios[0].name).toBe('Bigger upgrade')

    await user.click(screen.getByRole('button', { name: 'Options for Upgrade plan' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    const deleteUpdater = mocks.setSettings.mock.calls.at(-1)?.[0] as (settings: LeverageSettings) => LeverageSettings
    expect(deleteUpdater(mocks.settingsState.settings).scenarios.map(scenario => scenario.id)).toEqual(['scenario-2'])

    await user.click(screen.getByRole('button', { name: 'Add' }))
    const addScenarioUpdater = mocks.setSettings.mock.calls.at(-1)?.[0] as (
      settings: LeverageSettings,
    ) => LeverageSettings
    expect(addScenarioUpdater(mocks.settingsState.settings).scenarios.at(-1)).toEqual(
      expect.objectContaining({ name: 'Scenario 3' }),
    )
  })

  it('shows empty leverage guidance when liabilities or scenario history are missing', () => {
    mocks.leverageData.currentRatio = null
    mocks.leverageData.totalLiabilities = 0
    mocks.leverageData.computeAcquisition.mockReturnValue(null)
    mocks.leverageData.getRatioHistory.mockReturnValue([
      { month: '2026-03', label: 'Mar 2026', ratio: null, assets: 900000, liabilities: 0 },
    ])
    mocks.settingsState.settings = {
      ...mocks.settingsState.settings,
      scenarios: [],
    }

    renderLeverageGoal()

    expect(screen.getByText('No liabilities tracked.')).toBeInTheDocument()
    expect(screen.getByText('Add liability balances to chart leverage history.')).toBeInTheDocument()
    expect(screen.getAllByText('Add a scenario to get started.').length).toBeGreaterThan(0)
  })

  it('shows the short-history empty state when there is only one valid leverage point', () => {
    mocks.leverageData.getRatioHistory.mockReturnValue([
      { month: '2026-03', label: 'Mar 2026', ratio: 3, assets: 900000, liabilities: 300000 },
      { month: '2026-04', label: 'Apr 2026', ratio: null, assets: 920000, liabilities: 0 },
    ])

    renderLeverageGoal()

    expect(screen.getByText('Need at least two months of leverage data.')).toBeInTheDocument()
  })

  it('renders tooltip details for the leverage trend chart', () => {
    renderLeverageGoal()
    expect(screen.getByText('Assets')).toBeInTheDocument()
    expect(screen.getByText('Liabilities')).toBeInTheDocument()
    expect(screen.getByText('Ratio')).toBeInTheDocument()
  })
})
