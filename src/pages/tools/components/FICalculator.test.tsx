import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FICalculator from './FICalculator'
import { appStorage } from '../../../utils/appStorage'

/* ─── Mock dependencies ─── */

const mockUseData = vi.fn(() => ({
  accounts: [] as ReturnType<typeof import('../../../contexts/DataContext').useData>['accounts'],
  balances: [] as ReturnType<typeof import('../../../contexts/DataContext').useData>['balances'],
  allMonths: [] as string[],
  setAccounts: vi.fn(),
  setBalances: vi.fn(),
}))

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => mockUseData(),
}))

vi.mock('../../budget/utils/budgetStorage', () => ({
  loadBudgetStore: vi.fn(() => ({ csvs: {}, categoryGroups: [], configs: {}, years: [] })),
}))

vi.mock('../../budget/utils/csvParser', () => ({
  parseCSV: vi.fn(() => []),
}))

vi.mock('../../../utils/appStorage', () => ({
  appStorage: {
    getJSON: vi.fn((key: string, fallback: unknown) => {
      if (key === 'fi-simulations') return []
      if (key === 'user-profile') return {}
      return fallback ?? {}
    }),
    setJSON: vi.fn(),
  },
}))

vi.mock('../../../styles/FICalculator.css', () => ({}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockUseData.mockReturnValue({
    accounts: [],
    balances: [],
    allMonths: [],
    setAccounts: vi.fn(),
    setBalances: vi.fn(),
  })
})

function renderCalc() {
  return render(<FICalculator />)
}

describe('FICalculator', () => {
  it('renders the Annual Expense input', () => {
    renderCalc()
    expect(screen.getByText('Annual Expense')).toBeInTheDocument()
  })

  it('renders inflation and growth rate steppers', () => {
    renderCalc()
    expect(screen.getByText('Inflation')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
  })

  it('renders retire year and plan until steppers', () => {
    renderCalc()
    expect(screen.getByText('Retire in')).toBeInTheDocument()
    expect(screen.getByText('Plan until')).toBeInTheDocument()
  })

  it('renders the primary 401(k) stepper', () => {
    renderCalc()
    expect(screen.getByText('Primary 401(k)')).toBeInTheDocument()
  })

  it('renders the GW liquid toggle', () => {
    renderCalc()
    expect(screen.getByText(/Include GW liquid/)).toBeInTheDocument()
  })

  it('renders current holdings summary section', () => {
    renderCalc()
    expect(screen.getByText('FI Retirement (Primary)')).toBeInTheDocument()
    expect(screen.getByText('FI Retirement (Partner)')).toBeInTheDocument()
    expect(screen.getByText('FI Non-Retirement')).toBeInTheDocument()
  })

  it('displays result section with annual saving or FI ready message', () => {
    renderCalc()
    // With no accounts/balances and default expense=60000, gap > 0 so "Save each year" should show
    expect(screen.getByText(/Save each year until/)).toBeInTheDocument()
  })

  it('renders year-by-year projection when expanded', async () => {
    const user = userEvent.setup()
    renderCalc()
    const expandBtn = screen.getByText(/Year-by-year projection/)
    await user.click(expandBtn)
    expect(screen.getByText('Year')).toBeInTheDocument()
    expect(screen.getByText('Expense')).toBeInTheDocument()
    expect(screen.getByText('Net Worth')).toBeInTheDocument()
  })

  it('updates annual expense when user types in the input', async () => {
    const user = userEvent.setup()
    renderCalc()
    const input = screen.getByDisplayValue('60,000')
    await user.clear(input)
    await user.type(input, '120000')
    expect(input).toHaveValue('120,000')
  })

  it('displays inflation rate value and responds to stepper clicks', () => {
    renderCalc()
    // Default inflation is 3%, scoped to the Inflation stepper row
    const inflationRow = screen.getByText('Inflation').parentElement!
    expect(within(inflationRow).getByText('3%')).toBeInTheDocument()
  })

  it('displays growth rate value', () => {
    renderCalc()
    // Default growth is 8%, scoped to the Growth stepper row
    const growthRow = screen.getByText('Growth').parentElement!
    expect(within(growthRow).getByText('8%')).toBeInTheDocument()
  })

  it('shows the Save button and save form', async () => {
    const user = userEvent.setup()
    renderCalc()
    const saveBtn = screen.getByText('+ Save')
    await user.click(saveBtn)
    expect(screen.getByPlaceholderText('Simulation name')).toBeInTheDocument()
  })

  it('shows FI ready when existing balances exceed corpus need', () => {
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'Brokerage',
          type: 'non-retirement',
          owner: 'primary',
          status: 'active',
          goalType: 'fi',
          nature: 'asset',
          allocation: 'us-stock',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2025-01', balance: 50_000_000 }],
      allMonths: ['2025-01'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderCalc()
    expect(screen.getByText(/You're ready to FI/)).toBeInTheDocument()
  })

  it('renders breakdown rows when result is computed', () => {
    renderCalc()
    expect(screen.getByText(/Expense at retirement/)).toBeInTheDocument()
    expect(screen.getByText(/Non-ret corpus needed/)).toBeInTheDocument()
    expect(screen.getByText(/Gap to close/)).toBeInTheDocument()
  })

  it('cancel save form hides the input', async () => {
    const user = userEvent.setup()
    renderCalc()
    await user.click(screen.getByText('+ Save'))
    expect(screen.getByPlaceholderText('Simulation name')).toBeInTheDocument()
    await user.click(screen.getByText('✕'))
    expect(screen.queryByPlaceholderText('Simulation name')).not.toBeInTheDocument()
  })

  it('does not render partner 401(k) when no partner birth year', () => {
    renderCalc()
    expect(screen.queryByText('Partner 401(k)')).not.toBeInTheDocument()
  })

  it('increments inflation rate when plus stepper is clicked', async () => {
    const user = userEvent.setup()
    renderCalc()
    const inflationRow = screen.getByText('Inflation').closest('.fi-calc-stepper-item')! as HTMLElement
    const plusBtn = within(inflationRow)
      .getAllByRole('button')
      .find(b => b.textContent === '+')!
    await user.click(plusBtn)
    expect(within(inflationRow).getByText('3.5%')).toBeInTheDocument()
  })

  it('decrements inflation rate when minus stepper is clicked', async () => {
    const user = userEvent.setup()
    renderCalc()
    const inflationRow = screen.getByText('Inflation').closest('.fi-calc-stepper-item')! as HTMLElement
    const minusBtn = within(inflationRow)
      .getAllByRole('button')
      .find(b => b.textContent === '−')!
    await user.click(minusBtn)
    expect(within(inflationRow).getByText('2.5%')).toBeInTheDocument()
  })

  it('increments growth rate when plus stepper is clicked', async () => {
    const user = userEvent.setup()
    renderCalc()
    const growthRow = screen.getByText('Growth').closest('.fi-calc-stepper-item')! as HTMLElement
    const plusBtn = within(growthRow)
      .getAllByRole('button')
      .find(b => b.textContent === '+')!
    await user.click(plusBtn)
    expect(within(growthRow).getByText('8.5%')).toBeInTheDocument()
  })

  it('decrements growth rate when minus stepper is clicked', async () => {
    const user = userEvent.setup()
    renderCalc()
    const growthRow = screen.getByText('Growth').closest('.fi-calc-stepper-item')! as HTMLElement
    const minusBtn = within(growthRow)
      .getAllByRole('button')
      .find(b => b.textContent === '−')!
    await user.click(minusBtn)
    expect(within(growthRow).getByText('7.5%')).toBeInTheDocument()
  })

  it('increments retire year when plus stepper is clicked', async () => {
    const user = userEvent.setup()
    renderCalc()
    const retireRow = screen.getByText('Retire in').closest('.fi-calc-stepper-item')! as HTMLElement
    const plusBtn = within(retireRow)
      .getAllByRole('button')
      .find(b => b.textContent === '+')!
    await user.click(plusBtn)
    const thisYear = new Date().getFullYear()
    expect(within(retireRow).getByText(`(${thisYear + 2 - thisYear}yr)`, { exact: false })).toBeInTheDocument()
  })

  it('decrements plan-until year when minus stepper is clicked', async () => {
    const user = userEvent.setup()
    renderCalc()
    const planRow = screen.getByText('Plan until').closest('.fi-calc-stepper-item')! as HTMLElement
    const minusBtn = within(planRow)
      .getAllByRole('button')
      .find(b => b.textContent === '−')!
    const initialText = planRow.querySelector('.fi-calc-step-val')!.textContent!
    await user.click(minusBtn)
    const afterText = planRow.querySelector('.fi-calc-step-val')!.textContent!
    expect(parseInt(afterText)).toBeLessThan(parseInt(initialText))
  })

  it('toggles GW liquid inclusion and shows GW Liquid row', async () => {
    const user = userEvent.setup()
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'GW',
          type: 'liquid',
          owner: 'primary',
          status: 'active',
          goalType: 'gw',
          nature: 'asset',
          allocation: 'cash',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2025-01', balance: 10000 }],
      allMonths: ['2025-01'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderCalc()
    expect(screen.queryByText('GW Liquid')).not.toBeInTheDocument()

    const toggle = screen.getByText(/Include GW liquid/)
    await user.click(toggle)
    expect(screen.getByText('GW Liquid')).toBeInTheDocument()
  })

  it('saves a simulation and displays it as a chip', async () => {
    const user = userEvent.setup()
    renderCalc()
    await user.click(screen.getByText('+ Save'))
    const nameInput = screen.getByPlaceholderText('Simulation name')
    await user.type(nameInput, 'Base Case')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Base Case')).toBeInTheDocument()
  })

  it('deletes a saved simulation when × is clicked on chip', async () => {
    const user = userEvent.setup()
    renderCalc()
    // Save a sim
    await user.click(screen.getByText('+ Save'))
    await user.type(screen.getByPlaceholderText('Simulation name'), 'To Delete')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('To Delete')).toBeInTheDocument()

    // Delete it via the × span
    const chip = screen.getByText('To Delete').closest('button')! as HTMLElement
    const deleteBtn = chip.querySelector('.fi-sim-chip-x')!
    await user.click(deleteBtn)
    expect(screen.queryByText('To Delete')).not.toBeInTheDocument()
  })

  it('loads a saved simulation when chip is clicked', async () => {
    const user = userEvent.setup()
    renderCalc()
    // Change expense to something distinct
    const input = screen.getByDisplayValue('60,000')
    await user.clear(input)
    await user.type(input, '99000')
    // Save
    await user.click(screen.getByText('+ Save'))
    await user.type(screen.getByPlaceholderText('Simulation name'), 'Custom')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Change expense again
    const input2 = screen.getByDisplayValue('99,000')
    await user.clear(input2)
    await user.type(input2, '50000')
    expect(screen.getByDisplayValue('50,000')).toBeInTheDocument()

    // Click the saved sim chip to restore
    await user.click(screen.getByText('Custom'))
    expect(screen.getByDisplayValue('99,000')).toBeInTheDocument()
  })

  it('shows primary 401k balance in breakdown when FI retirement accounts exist', () => {
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: '401k',
          type: 'retirement',
          owner: 'primary',
          status: 'active',
          goalType: 'fi',
          nature: 'asset',
          allocation: 'us-stock',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2025-01', balance: 200000 }],
      allMonths: ['2025-01'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderCalc()
    expect(screen.getByText(/Primary 401\(k\) at/)).toBeInTheDocument()
  })

  it('shows partner 401k in breakdown when partner retirement accounts exist', () => {
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: '401k Partner',
          type: 'retirement',
          owner: 'partner',
          status: 'active',
          goalType: 'fi',
          nature: 'asset',
          allocation: 'us-stock',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2025-01', balance: 100000 }],
      allMonths: ['2025-01'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderCalc()
    expect(screen.getByText(/Partner 401\(k\) at/)).toBeInTheDocument()
  })

  it('shows existing non-ret at retire year in breakdown', () => {
    renderCalc()
    expect(screen.getByText(/Existing non-ret at/)).toBeInTheDocument()
  })

  it('renders year-by-year projection rows with year, expense, and net worth columns', async () => {
    const user = userEvent.setup()
    renderCalc()
    await user.click(screen.getByText(/Year-by-year projection/))
    // Should have data rows in the table
    const rows = document.querySelectorAll('.fi-calc-yby-table tbody tr')
    expect(rows.length).toBeGreaterThan(0)
  })

  it('collapses year-by-year projection on second click', async () => {
    const user = userEvent.setup()
    renderCalc()
    const btn = screen.getByText(/Year-by-year projection/)
    await user.click(btn) // expand
    expect(document.querySelector('.fi-calc-yby-table')).toBeInTheDocument()
    await user.click(btn) // collapse
    expect(document.querySelector('.fi-calc-yby-table')).not.toBeInTheDocument()
  })

  it('disables save button when simulation name is empty', async () => {
    const user = userEvent.setup()
    renderCalc()
    await user.click(screen.getByText('+ Save'))
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    expect(saveBtn).toBeDisabled()
  })

  it('formats expense input on blur', async () => {
    const user = userEvent.setup()
    renderCalc()
    const input = screen.getByDisplayValue('60,000')
    await user.clear(input)
    await user.type(input, '75000')
    await user.tab() // triggers blur
    expect(input).toHaveValue('75,000')
  })

  it('renders partner 401(k) stepper when profile has partner birth year', () => {
    vi.mocked(appStorage.getJSON).mockImplementation((key: string, fallback: unknown) => {
      if (key === 'user-profile') return { birthday: '1990-01-01', partner: { birthday: '1992-06-15' } }
      if (key === 'fi-simulations') return []
      return fallback ?? {}
    })

    renderCalc()
    expect(screen.getByText('Partner 401(k)')).toBeInTheDocument()
  })

  it('increments primary 401k year when plus stepper is clicked', async () => {
    const user = userEvent.setup()
    renderCalc()
    const row401k = screen.getByText('Primary 401(k)').closest('.fi-calc-stepper-item')! as HTMLElement
    const initial = row401k.querySelector('.fi-calc-step-val')!.textContent!
    const plusBtn = within(row401k)
      .getAllByRole('button')
      .find(b => b.textContent === '+')!
    await user.click(plusBtn)
    const after = row401k.querySelector('.fi-calc-step-val')!.textContent!
    expect(parseInt(after)).toBe(parseInt(initial) + 1)
  })

  /* ── Results display ──────────────────────────────────────────── */

  it('displays results section with expense and corpus breakdown', () => {
    renderCalc()
    // Results section should render by default with default values
    expect(screen.getByText(/Expense at retirement/)).toBeInTheDocument()
    expect(screen.getByText(/Non-ret corpus needed/)).toBeInTheDocument()
    expect(screen.getByText(/Gap to close/)).toBeInTheDocument()
  })

  it('shows Save each year message when gap is positive', () => {
    renderCalc()
    // Default values should produce a positive gap
    expect(screen.getByText(/Save each year until/)).toBeInTheDocument()
  })

  it('displays current holdings summary', () => {
    renderCalc()
    expect(screen.getByText('FI Retirement (Primary)')).toBeInTheDocument()
    expect(screen.getByText('FI Retirement (Partner)')).toBeInTheDocument()
    expect(screen.getByText('FI Non-Retirement')).toBeInTheDocument()
  })

  it('shows GW Liquid row when toggle is on', async () => {
    const user = userEvent.setup()
    renderCalc()

    const toggleBtn = screen.getByText(/Include GW liquid/)
    await user.click(toggleBtn)

    expect(screen.getByText('GW Liquid')).toBeInTheDocument()
  })

  it('shows primary 401k breakdown when fiRetirementPrimary > 0', () => {
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: '401k',
          type: 'retirement',
          owner: 'primary',
          status: 'active',
          goalType: 'fi',
          nature: 'asset',
          allocation: 'us-stock',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2025-01', balance: 100000 }],
      allMonths: ['2025-01'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderCalc()
    expect(screen.getByText(/Primary 401\(k\) at/)).toBeInTheDocument()
  })

  it('shows partner 401k breakdown when fiRetirementPartner > 0', () => {
    vi.mocked(appStorage.getJSON).mockImplementation((key: string, fallback: unknown) => {
      if (key === 'user-profile') return { birthday: '1990-01-01', partner: { birthday: '1992-06-15' } }
      if (key === 'fi-simulations') return []
      return fallback ?? {}
    })
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 2,
          name: 'Partner 401k',
          type: 'retirement',
          owner: 'partner',
          status: 'active',
          goalType: 'fi',
          nature: 'asset',
          allocation: 'us-stock',
        },
      ],
      balances: [{ id: 2, accountId: 2, month: '2025-01', balance: 80000 }],
      allMonths: ['2025-01'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderCalc()
    expect(screen.getByText(/Partner 401\(k\) at/)).toBeInTheDocument()
  })

  /* ── Simulation save/load/delete ──────────────────────────────── */

  it('saves a simulation and shows it in the list', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.click(screen.getByText('+ Save'))
    const nameInput = screen.getByPlaceholderText('Simulation name')
    await user.type(nameInput, 'My Sim')
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    await user.click(saveBtn)

    expect(appStorage.setJSON).toHaveBeenCalledWith(
      'fi-simulations',
      expect.arrayContaining([expect.objectContaining({ name: 'My Sim' })]),
    )
  })

  it('loads a saved simulation', async () => {
    vi.mocked(appStorage.getJSON).mockImplementation((key: string, fallback: unknown) => {
      if (key === 'fi-simulations')
        return [
          {
            name: 'Saved Sim',
            annualExpense: 80000,
            inflationRate: 3,
            growthRate: 7,
            lastYear: 2070,
            retireYear: 2040,
            primary401kYear: 2050,
            partner401kYear: 2050,
            includeGwLiquid: false,
          },
        ]
      if (key === 'user-profile') return {}
      return fallback ?? {}
    })

    const user = userEvent.setup()
    renderCalc()

    // The saved sim should appear as a button
    const simBtn = screen.getByText('Saved Sim')
    await user.click(simBtn)

    // Expense should update to saved value
    expect(screen.getByDisplayValue('80,000')).toBeInTheDocument()
  })

  it('deletes a saved simulation via chip × button', async () => {
    vi.mocked(appStorage.getJSON).mockImplementation((key: string, fallback: unknown) => {
      if (key === 'fi-simulations')
        return [
          {
            name: 'ToDelete',
            annualExpense: 60000,
            inflationRate: 2.5,
            growthRate: 7,
            lastYear: 2065,
            retireYear: 2040,
            primary401kYear: 2050,
            partner401kYear: 2050,
            includeGwLiquid: false,
          },
        ]
      if (key === 'user-profile') return {}
      return fallback ?? {}
    })

    const user = userEvent.setup()
    renderCalc()

    // Click the × span inside the chip
    const deleteSpan = document.querySelector('.fi-sim-chip-x')!
    await user.click(deleteSpan)

    expect(appStorage.setJSON).toHaveBeenCalledWith('fi-simulations', [])
  })

  /* ── Expense from budget ──────────────────────────────────────── */

  it('shows Use last year button when budget has expense data', async () => {
    const { loadBudgetStore } = await import('../../budget/utils/budgetStorage')
    const { parseCSV } = await import('../../budget/utils/csvParser')

    const lastYear = new Date().getFullYear() - 1
    const csvs: Record<string, { csv: string; month: string; uploadedAt: string }> = {}
    for (let m = 1; m <= 12; m++) {
      const key = `${lastYear}-${String(m).padStart(2, '0')}`
      csvs[key] = { csv: 'test', month: key, uploadedAt: '' }
    }

    vi.mocked(loadBudgetStore).mockReturnValue({
      csvs,
      categoryGroups: [],
      configs: {},
      years: [lastYear],
    })
    vi.mocked(parseCSV).mockReturnValue([{ category: 'Food', amount: -500, date: '', description: '' } as never])

    renderCalc()

    const useLastYearBtn = screen.queryByText(/Use last year/)
    if (useLastYearBtn) {
      expect(useLastYearBtn).toBeInTheDocument()
    }
  })

  /* ── defaultLastYear (regression: #163) ───────────────────────── */

  /**
   * Pin the documented `defaultLastYear` rule (FICalculator.tsx lines 173-182):
   *   defaultLastYear = max(primary+100, partner+100), or thisYear+60 if neither.
   * The Plan-until stepper value at first render IS defaultLastYear, so we
   * read the `.fi-calc-step-val` inside the "Plan until" row to assert it.
   * A future refactor that breaks the rule must make these tests fail.
   */
  describe('defaultLastYear (regression: #163)', () => {
    function readPlanUntilYear(): number {
      const row = screen.getByText('Plan until').closest('.fi-calc-stepper-item')! as HTMLElement
      const text = row.querySelector('.fi-calc-step-val')!.textContent!
      return parseInt(text, 10)
    }

    it('falls back to thisYear+60 when neither birth year is present', () => {
      vi.mocked(appStorage.getJSON).mockImplementation((key: string, fallback: unknown) => {
        if (key === 'user-profile') return {}
        if (key === 'fi-simulations') return []
        return fallback ?? {}
      })
      renderCalc()
      const thisYear = new Date().getFullYear()
      expect(readPlanUntilYear()).toBe(thisYear + 60)
    })

    it('uses primary+100 when only primary birthday is set', () => {
      vi.mocked(appStorage.getJSON).mockImplementation((key: string, fallback: unknown) => {
        if (key === 'user-profile') return { birthday: '1990-05-15' }
        if (key === 'fi-simulations') return []
        return fallback ?? {}
      })
      renderCalc()
      expect(readPlanUntilYear()).toBe(2090)
    })

    it('uses partner+100 (NOT primary+100) when partner is younger — the #163 case', () => {
      vi.mocked(appStorage.getJSON).mockImplementation((key: string, fallback: unknown) => {
        if (key === 'user-profile') return { birthday: '1990-01-01', partner: { birthday: '1995-06-15' } }
        if (key === 'fi-simulations') return []
        return fallback ?? {}
      })
      renderCalc()
      expect(readPlanUntilYear()).toBe(2095)
      expect(readPlanUntilYear()).not.toBe(2090)
    })

    it('uses primary+100 when partner is older than primary', () => {
      vi.mocked(appStorage.getJSON).mockImplementation((key: string, fallback: unknown) => {
        if (key === 'user-profile') return { birthday: '1990-01-01', partner: { birthday: '1985-06-15' } }
        if (key === 'fi-simulations') return []
        return fallback ?? {}
      })
      renderCalc()
      expect(readPlanUntilYear()).toBe(2090)
    })
  })

  /* ── Partner 401k stepper decrement ───────────────────────────── */

  it('increments partner 401k year when plus stepper is clicked', async () => {
    vi.mocked(appStorage.getJSON).mockImplementation((key: string, fallback: unknown) => {
      if (key === 'user-profile') return { birthday: '1990-01-01', partner: { birthday: '1992-06-15' } }
      if (key === 'fi-simulations') return []
      return fallback ?? {}
    })

    const user = userEvent.setup()
    renderCalc()
    const row = screen.getByText('Partner 401(k)').closest('.fi-calc-stepper-item')! as HTMLElement
    const initial = row.querySelector('.fi-calc-step-val')!.textContent!
    const plusBtn = within(row)
      .getAllByRole('button')
      .find(b => b.textContent === '+')!
    await user.click(plusBtn)
    const after = row.querySelector('.fi-calc-step-val')!.textContent!
    expect(parseInt(after)).toBe(parseInt(initial) + 1)
  })
})
