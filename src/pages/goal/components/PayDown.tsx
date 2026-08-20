import { FC, FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useData } from '../../../contexts/DataContext'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import type { Account } from '../../data/types'
import { formatCurrency, formatMonth } from '../../data/types'
import { useFileStore } from '../../../contexts/FileStoreContext'
import { useDateFilter } from '../../../hooks/useDateFilter'
import { DateFilterBarFromHook } from '../../../components/DateFilterBar'
import MonthPicker from '../../../components/MonthPicker'
import '../../../styles/PayDown.css'

interface PaydownLoan {
  id: number
  type: 'loan' | 'credit-card'
  name: string
  principal: number
  annualRate: number
  termMonths: number
  startDate: string
  linkedAccountId: number
  monthlyPayment?: number
}

interface LoanFormState {
  type: 'loan' | 'credit-card'
  name: string
  principal: string
  annualRate: string
  termMonths: string
  startDate: string
  linkedAccountId: string
  monthlyPayment: string
}

interface ChartPoint {
  month: string
  label: string
  expected: number | null
  actual: number | null
}

const PAYDOWN_PATH = 'paydown-loans.json'

// All months from 2050-12 down to 2010-01 (newest first) for the start date picker
const ALL_PICKER_MONTHS: string[] = []
for (let y = 2050; y >= 2010; y--) {
  for (let m = 12; m >= 1; m--) {
    ALL_PICKER_MONTHS.push(`${y}-${String(m).padStart(2, '0')}`)
  }
}


const emptyForm: LoanFormState = {
  type: 'loan',
  name: '',
  principal: '',
  annualRate: '',
  termMonths: '',
  startDate: '',
  linkedAccountId: '',
  monthlyPayment: '',
}

const formatCurrencyCompact = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return formatCurrency(value)
}

const parseMonth = (value: string) => {
  const [yearPart, monthPart] = value.split('-')
  const year = Number.parseInt(yearPart, 10)
  const month = Number.parseInt(monthPart, 10)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  return { year, month }
}

const addMonths = (value: string, offset: number) => {
  const parsed = parseMonth(value)
  if (!parsed) return value

  const totalMonths = parsed.year * 12 + (parsed.month - 1) + offset
  const nextYear = Math.floor(totalMonths / 12)
  const nextMonth = (totalMonths % 12) + 1

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

const buildExpectedSchedule = (loan: PaydownLoan) => {
  const monthlyRate = loan.annualRate / 100 / 12
  let monthlyPayment: number

  if (loan.type === 'credit-card') {
    monthlyPayment = loan.monthlyPayment ?? 0
  } else {
    monthlyPayment =
      monthlyRate === 0
        ? loan.principal / loan.termMonths
        : (loan.principal * (monthlyRate * (1 + monthlyRate) ** loan.termMonths)) /
          ((1 + monthlyRate) ** loan.termMonths - 1)
  }

  const maxMonths = loan.type === 'credit-card' ? loan.termMonths || 600 : loan.termMonths
  const schedule = new Map<string, number>()
  let balance = loan.principal
  schedule.set(loan.startDate, Number(balance.toFixed(2)))

  for (let monthIndex = 1; monthIndex <= maxMonths; monthIndex += 1) {
    balance = balance * (1 + monthlyRate) - monthlyPayment
    balance = Math.max(0, Number(balance.toFixed(2)))
    schedule.set(addMonths(loan.startDate, monthIndex), balance)
    if (balance <= 0) break
  }

  return schedule
}

const tooltipStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  padding: '8px 12px',
}
const tooltipLabelStyle = { color: 'var(--color-text)', fontSize: 11, fontWeight: 500 as const, marginBottom: 4 }
const tooltipItemStyle = { color: 'var(--color-text)', fontSize: 12, fontWeight: 600 as const, padding: 0, whiteSpace: 'nowrap' as const }

const PaydownTooltip: FC<{
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; payload: ChartPoint }>
  label?: string
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload
  if (!point) return null

  const diff = point.expected != null && point.actual != null ? point.actual - point.expected : null
  const diffColor = diff != null ? (diff > 0 ? '#dc2626' : diff < 0 ? '#16a34a' : 'var(--color-text)') : null

  return (
    <div style={tooltipStyle}>
      <div style={tooltipLabelStyle}>{label ? formatMonth(label) : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', alignItems: 'baseline', columnGap: 14, rowGap: 4 }}>
        {point.expected != null && (
          <>
            <div style={tooltipItemStyle}>Expected</div>
            <div style={{ ...tooltipItemStyle, textAlign: 'right' }}>{formatCurrency(point.expected)}</div>
            <div />
          </>
        )}
        {point.actual != null && (
          <>
            <div style={tooltipItemStyle}>Actual</div>
            <div style={{ ...tooltipItemStyle, textAlign: 'right' }}>{formatCurrency(point.actual)}</div>
            {diff != null && diff !== 0 ? (
              <div style={{ fontSize: 11, fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap', color: diffColor ?? undefined }}>
                {diff > 0 ? '+' : ''}{formatCurrency(diff)}
              </div>
            ) : <div />}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Custom Select (styled dropdown) ── */
interface CustomSelectOption { value: string; label: string }
const CustomSelect: FC<{
  value: string
  onChange: (value: string) => void
  options: CustomSelectOption[]
  placeholder?: string
  disabled?: boolean
}> = ({ value, onChange, options, placeholder = 'Select…', disabled }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className={`custom-select${disabled ? ' custom-select--disabled' : ''}`}>
      <button
        type="button"
        className="custom-select__trigger"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'custom-select__placeholder'}>{selected ? selected.label : placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 5L6 8L9 5" />
        </svg>
      </button>
      {open ? (
        <ul className="custom-select__menu" role="listbox">
          {options.map(opt => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`custom-select__option${opt.value === value ? ' custom-select__option--selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const PayDownModal: FC<{
  isOpen: boolean
  form: LoanFormState
  liabilityAccounts: Account[]
  error: string
  editingLoanId: number | null
  onClose: () => void
  onChange: (field: keyof LoanFormState, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}> = ({ isOpen, form, liabilityAccounts, error, editingLoanId, onClose, onChange, onSubmit }) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const errorId = useId()
  useFocusTrap(modalRef, isOpen)

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="paydown-modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="paydown-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add pay down loan"
        onClick={event => event.stopPropagation()}
      >
        <div className="paydown-modal__header">
          <h2>{editingLoanId ? `Edit ${form.type === 'credit-card' ? 'credit card' : 'loan'}` : `Add ${form.type === 'credit-card' ? 'credit card' : 'loan'}`}</h2>
        </div>

        <form className="paydown-form" onSubmit={onSubmit}>
          <label className="paydown-field">
            <span>{form.type === 'credit-card' ? 'Card name' : 'Loan name'}</span>
            <input
              type="text"
              value={form.name}
              onChange={event => onChange('name', event.target.value)}
              placeholder={form.type === 'credit-card' ? 'Chase Sapphire' : 'Home Loan'}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
          </label>

          <div className="paydown-form__grid">
            <label className="paydown-field">
              <span>{form.type === 'credit-card' ? 'Balance ($)' : 'Principal ($)'}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.principal}
                onChange={event => onChange('principal', event.target.value)}
                placeholder={form.type === 'credit-card' ? '5000' : '300000'}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
            </label>

            <label className="paydown-field">
              <span>APR (%)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.annualRate}
                onChange={event => onChange('annualRate', event.target.value)}
                placeholder={form.type === 'credit-card' ? '24.99' : '6.5'}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
            </label>

            {form.type === 'credit-card' ? (
              <label className="paydown-field">
                <span>Monthly payment ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.monthlyPayment}
                  onChange={event => onChange('monthlyPayment', event.target.value)}
                  placeholder="200"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                />
              </label>
            ) : (
              <label className="paydown-field">
                <span>Term (months)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={form.termMonths}
                  onChange={event => onChange('termMonths', event.target.value)}
                  placeholder="360"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                />
              </label>
            )}

            <div className="paydown-field">
              <span>Start date</span>
              <MonthPicker
                allMonths={ALL_PICKER_MONTHS}
                selectedMonth={form.startDate}
                onMonthChange={month => onChange('startDate', month)}
              />
            </div>
          </div>

          <div className="paydown-field">
            <span>Linked liability account</span>
            <CustomSelect
              value={form.linkedAccountId}
              onChange={value => onChange('linkedAccountId', value)}
              disabled={liabilityAccounts.length === 0}
              placeholder={liabilityAccounts.length === 0 ? 'No liability accounts available' : 'Select account'}
              options={liabilityAccounts.map(account => ({ value: String(account.id), label: account.name }))}
            />
          </div>

          {error ? (
            <p className="paydown-form__error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}

          <div className="paydown-form__actions">
            <button className="action-btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="action-btn" type="submit">
              {editingLoanId ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface LoanCardData {
  loan: PaydownLoan
  chartData: ChartPoint[]
  linkedAccount: Account | null
  endDate: string
  hasActualData: boolean
}

const PayDownCard: FC<{
  card: LoanCardData
  onEdit: (loan: PaydownLoan) => void
  onDelete: (id: number) => void
}> = ({ card, onEdit, onDelete }) => {
  const { loan, chartData, linkedAccount, endDate, hasActualData } = card
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const historicalMonths = useMemo(() => chartData.map(p => p.month).filter(m => m <= currentMonth), [chartData, currentMonth])
  const dateFilter = useDateFilter(historicalMonths)
  const filteredData = useMemo(
    () => dateFilter.dateFilter === 'all' ? chartData : chartData.filter(p => dateFilter.filteredMonths.includes(p.month)),
    [chartData, dateFilter.dateFilter, dateFilter.filteredMonths],
  )

  const yDomain = useMemo(() => {
    const values = filteredData.flatMap(p => [p.expected, p.actual].filter((v): v is number => v != null))
    if (!values.length) return [0, 'auto'] as const
    const min = Math.min(...values)
    const max = Math.max(...values)
    const padding = (max - min) * 0.05 || max * 0.05
    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)] as const
  }, [filteredData])

  const loanCosts = useMemo(() => {
    if (loan.annualRate === 0) {
      return { monthlyPayment: loan.principal / (loan.termMonths || 1), totalInterest: 0, totalCost: loan.principal }
    }
    const monthlyRate = loan.annualRate / 100 / 12
    const payment = loan.type === 'credit-card'
      ? (loan.monthlyPayment ?? 0)
      : (loan.principal * (monthlyRate * (1 + monthlyRate) ** loan.termMonths)) / ((1 + monthlyRate) ** loan.termMonths - 1)
    const totalMonths = loan.type === 'credit-card' ? chartData.length - 1 : loan.termMonths
    const totalCost = payment * totalMonths
    return { monthlyPayment: payment, totalInterest: totalCost - loan.principal, totalCost }
  }, [loan, chartData.length])

  return (
    <article className="paydown-card">
      <div className="paydown-card__header">
        <div>
          <h3>{loan.name}</h3>
          <p>{linkedAccount ? linkedAccount.name : 'Linked liability account removed'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="action-btn" type="button" onClick={() => onEdit(loan)}>
            Edit
          </button>
          <button className="action-btn action-btn--danger" type="button" onClick={() => onDelete(loan.id)}>
            Delete
          </button>
        </div>
      </div>

      <div className="paydown-metrics">
        <div className="paydown-metric">
          <span>Principal</span>
          <strong>{formatCurrency(loan.principal)}</strong>
        </div>
        <div className="paydown-metric">
          <span>Rate</span>
          <strong>{loan.annualRate.toFixed(2)}%</strong>
        </div>
        <div className="paydown-metric">
          <span>Term</span>
          <strong>{loan.type === 'credit-card'
            ? `${chartData.length} mo`
            : loan.termMonths % 12 === 0 ? `${loan.termMonths / 12} yr` : `${Math.floor(loan.termMonths / 12)} yr ${loan.termMonths % 12} mo`
          }</strong>
        </div>
        <div className="paydown-metric">
          <span>Start</span>
          <strong>{formatMonth(loan.startDate)}</strong>
        </div>
        <div className="paydown-metric">
          <span>Expected end</span>
          <strong>{formatMonth(endDate)}</strong>
        </div>
        <div className="paydown-metric">
          <span>Progress</span>
          <strong>{(() => {
            const actuals = chartData.filter(p => p.actual != null && p.month <= currentMonth)
            if (actuals.length === 0) return '—'
            const latestBalance = actuals[actuals.length - 1].actual!
            const pct = Math.min(100, Math.max(0, Math.round(((loan.principal - latestBalance) / loan.principal) * 100)))
            return `${pct}%`
          })()}</strong>
        </div>
      </div>

      <div className="paydown-card__filter">
        <DateFilterBarFromHook hook={dateFilter} allMonths={historicalMonths} size="sm" />
      </div>

      <div className="paydown-chart">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={filteredData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={value => formatMonth(String(value))}
              minTickGap={24}
              tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={value => formatCurrencyCompact(Number(value))}
              tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
              width={72}
            />
            <Tooltip content={<PaydownTooltip />} />
            <Line
              type="monotone"
              dataKey="expected"
              name="Expected"
              stroke="#9ca3af"
              strokeWidth={2}
              dot={false}
              strokeDasharray="6 6"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="paydown-bottom-sections">
        <div className="paydown-interest-section">
          <span className="paydown-interest-label">Interest</span>
          <div className="paydown-metrics">
            <div className="paydown-metric">
              <span>Paid to date</span>
              <strong>{(() => {
                if (loan.annualRate === 0) return '$0'
                const actuals = chartData.filter(p => p.actual != null && p.month <= currentMonth)
                if (actuals.length === 0) return '—'
                const monthsElapsed = actuals.length - 1
                const principalPaidDown = loan.principal - (actuals[actuals.length - 1].actual ?? 0)
                const totalPaidToDate = loanCosts.monthlyPayment * monthsElapsed
                return formatCurrency(totalPaidToDate - principalPaidDown)
              })()}</strong>
            </div>
            <div className="paydown-metric">
              <span>Total interest</span>
              <strong>{formatCurrency(loanCosts.totalInterest)}</strong>
            </div>
          </div>
        </div>

        <div className="paydown-interest-section">
          <span className="paydown-interest-label">Total</span>
          <div className="paydown-metrics">
            <div className="paydown-metric">
              <span>Total cost</span>
              <strong>{formatCurrency(loanCosts.totalCost)}</strong>
            </div>
          </div>
        </div>
      </div>

      {!hasActualData ? (
        <p className="paydown-card__hint">No actual balance history found yet for this linked liability account.</p>
      ) : null}
    </article>
  )
}

const PayDown: FC = () => {
  const { accounts, balances } = useData()
  const { fileStore } = useFileStore()
  const [loans, setLoans] = useState<PaydownLoan[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<LoanFormState>(emptyForm)
  const [error, setError] = useState('')
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null)
  const [paydownTab, setPaydownTab] = useState<'ongoing' | 'completed'>('ongoing')
  const [selectedCompletedId, setSelectedCompletedId] = useState<number | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!addMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (!addMenuRef.current?.contains(e.target as Node)) setAddMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [addMenuOpen])

  const liabilityAccounts = useMemo(
    () => accounts.filter(account => account.nature === 'liability').sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  )

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      fileStore
        .readJSON<PaydownLoan[]>(PAYDOWN_PATH, [])
        .then(next => {
          if (!cancelled) setLoans(next)
        })
        .catch(console.error)
    }
    refresh()
    const unsubscribe = fileStore.subscribe(PAYDOWN_PATH, refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [fileStore])

  const persistLoans = useCallback(
    (next: PaydownLoan[]) => {
      setLoans(next)
      fileStore.writeJSON(PAYDOWN_PATH, next).catch(console.error)
    },
    [fileStore],
  )

  const loanCards = useMemo(
    () =>
      loans.map(loan => {
        const expected = buildExpectedSchedule(loan)
        const actualEntries = balances
          .filter(entry => entry.accountId === loan.linkedAccountId && entry.month >= loan.startDate)
          .sort((a, b) => a.month.localeCompare(b.month))

        const actual = new Map(actualEntries.map(entry => [entry.month, Math.abs(entry.balance)]))
        const months = [...new Set([...expected.keys(), ...actual.keys()])].sort()
        const chartData: ChartPoint[] = months.map(month => ({
          month,
          label: formatMonth(month),
          expected: expected.get(month) ?? null,
          actual: actual.get(month) ?? null,
        }))
        const linkedAccount = liabilityAccounts.find(account => account.id === loan.linkedAccountId) ?? null

        const expectedMonths = [...expected.keys()]
        const lastExpectedMonth = expectedMonths[expectedMonths.length - 1] || loan.startDate

        return {
          loan,
          chartData,
          linkedAccount,
          endDate: loan.type === 'credit-card' ? lastExpectedMonth : addMonths(loan.startDate, loan.termMonths),
          hasActualData: actualEntries.length > 0,
        }
      }),
    [balances, liabilityAccounts, loans],
  )

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const ongoingCards = useMemo(
    () => loanCards.filter(({ endDate }) => endDate > currentMonth).sort((a, b) => b.loan.startDate.localeCompare(a.loan.startDate)),
    [loanCards, currentMonth],
  )
  const completedCards = useMemo(
    () => loanCards.filter(({ endDate }) => endDate <= currentMonth).sort((a, b) => {
      const lastActualA = [...a.chartData].reverse().find(p => p.actual != null)?.month ?? a.endDate
      const lastActualB = [...b.chartData].reverse().find(p => p.actual != null)?.month ?? b.endDate
      return lastActualB.localeCompare(lastActualA)
    }),
    [loanCards, currentMonth],
  )

  const resetForm = () => {
    setForm(emptyForm)
    setError('')
    setEditingLoanId(null)
  }

  const openModal = (type: 'loan' | 'credit-card' = 'loan') => {
    resetForm()
    setForm(current => ({ ...current, type }))
    setIsModalOpen(true)
  }

  const openEditModal = (loan: PaydownLoan) => {
    setForm({
      type: loan.type || 'loan',
      name: loan.name,
      principal: String(loan.principal),
      annualRate: String(loan.annualRate),
      termMonths: String(loan.termMonths),
      startDate: loan.startDate,
      linkedAccountId: String(loan.linkedAccountId),
      monthlyPayment: loan.monthlyPayment ? String(loan.monthlyPayment) : '',
    })
    setEditingLoanId(loan.id)
    setError('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const handleFormChange = (field: keyof LoanFormState, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
    if (error) setError('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const principal = Number.parseFloat(form.principal)
    const annualRate = Number.parseFloat(form.annualRate)
    const linkedAccountId = Number.parseInt(form.linkedAccountId, 10)

    if (!form.name.trim()) {
      setError(form.type === 'credit-card' ? 'Enter a card name.' : 'Enter a loan name.')
      return
    }

    if (!Number.isFinite(principal) || principal <= 0) {
      setError(form.type === 'credit-card' ? 'Enter a balance greater than 0.' : 'Enter a principal greater than 0.')
      return
    }

    if (!Number.isFinite(annualRate) || annualRate < 0) {
      setError('Enter a valid APR.')
      return
    }

    if (form.type === 'credit-card') {
      const monthlyPayment = Number.parseFloat(form.monthlyPayment)
      if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) {
        setError('Enter a monthly payment greater than 0.')
        return
      }
      const monthlyRate = annualRate / 100 / 12
      if (monthlyPayment <= principal * monthlyRate) {
        setError('Monthly payment must exceed monthly interest to pay down the balance.')
        return
      }
    } else {
      const termMonths = Number.parseInt(form.termMonths, 10)
      if (!Number.isInteger(termMonths) || termMonths <= 0) {
        setError('Enter a term in whole months.')
        return
      }
    }

    if (!parseMonth(form.startDate)) {
      setError('Select a valid start month.')
      return
    }

    if (!Number.isInteger(linkedAccountId) || !liabilityAccounts.some(account => account.id === linkedAccountId)) {
      setError('Select a linked liability account.')
      return
    }

    const monthlyPayment = form.type === 'credit-card' ? Number.parseFloat(form.monthlyPayment) : undefined
    const termMonths = form.type === 'credit-card' ? 0 : Number.parseInt(form.termMonths, 10)

    const nextLoan: PaydownLoan = {
      id: editingLoanId ?? Date.now(),
      type: form.type,
      name: form.name.trim(),
      principal,
      annualRate,
      termMonths,
      startDate: form.startDate,
      linkedAccountId,
      monthlyPayment,
    }

    const nextLoans = editingLoanId
      ? loans.map(l => (l.id === editingLoanId ? nextLoan : l))
      : [...loans, nextLoan].sort((a, b) => a.name.localeCompare(b.name))
    persistLoans(nextLoans)
    closeModal()
  }

  const handleDelete = (loanId: number) => {
    persistLoans(loans.filter(loan => loan.id !== loanId))
  }

  if (loanCards.length === 0) {
    return (
      <>
        <section className="paydown-page">
          <div className="paydown-empty-state">
            <h2>Track loan payoff progress</h2>
          <p>Add a loan or credit card to compare its expected amortization against the actual balance history.</p>
          <div className="paydown-add-menu" ref={addMenuRef}>
            <button className="action-btn" type="button" onClick={() => setAddMenuOpen(o => !o)}>
              Add <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 5L6 8L9 5" /></svg>
            </button>
            {addMenuOpen ? (
              <ul className="paydown-add-menu__list">
                <li onClick={() => { openModal('loan'); setAddMenuOpen(false) }}>Add loan</li>
                <li onClick={() => { openModal('credit-card'); setAddMenuOpen(false) }}>Add credit card</li>
              </ul>
            ) : null}
          </div>
          </div>
        </section>
        <PayDownModal
          isOpen={isModalOpen}
          form={form}
          liabilityAccounts={liabilityAccounts}
          error={error}
          editingLoanId={editingLoanId}
          onClose={closeModal}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
        />
      </>
    )
  }

  return (
    <>
      <section className="paydown-page">
        <div className="paydown-header">
          <div className="tab-bar">
            <button
              className={`tab-btn${paydownTab === 'ongoing' ? ' active' : ''}`}
              onClick={() => setPaydownTab('ongoing')}
            >
              Ongoing
            </button>
            <button
              className={`tab-btn${paydownTab === 'completed' ? ' active' : ''}`}
              onClick={() => setPaydownTab('completed')}
            >
              Completed
            </button>
          </div>
          <div className="paydown-add-menu" ref={addMenuRef}>
            <button className="action-btn" type="button" onClick={() => setAddMenuOpen(o => !o)}>
              Add <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 5L6 8L9 5" /></svg>
            </button>
            {addMenuOpen ? (
              <ul className="paydown-add-menu__list">
                <li onClick={() => { openModal('loan'); setAddMenuOpen(false) }}>Add loan</li>
                <li onClick={() => { openModal('credit-card'); setAddMenuOpen(false) }}>Add credit card</li>
              </ul>
            ) : null}
          </div>
        </div>

        <div className="paydown-list">
          {paydownTab === 'ongoing' ? (
            <>
              {ongoingCards.length === 0 && (
                <div className="paydown-empty-tab">No ongoing loans.</div>
              )}
              {ongoingCards.map(card => (
                <PayDownCard
                  key={card.loan.id}
                  card={card}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                />
              ))}
            </>
          ) : (
            <>
              {completedCards.length === 0 && (
                <div className="paydown-empty-tab">No completed loans.</div>
              )}
              {completedCards.length > 0 && (
                <div className="paydown-completed-list">
                  {completedCards.map(card => {
                    const isSelected = selectedCompletedId === card.loan.id
                    return (
                      <div key={card.loan.id} className="paydown-completed-item">
                        <button
                          type="button"
                          className={`paydown-completed-row${isSelected ? ' paydown-completed-row--active' : ''}`}
                          onClick={() => setSelectedCompletedId(isSelected ? null : card.loan.id)}
                        >
                          <span className="paydown-completed-name">{card.loan.name}</span>
                          <span className="paydown-completed-principal">{formatCurrency(card.loan.principal)}</span>
                          <span className="paydown-completed-dates">{formatMonth(card.loan.startDate)} – {formatMonth(card.endDate)}</span>
                          <span className="paydown-completed-paidoff">{(() => {
                            const lastActual = [...card.chartData].reverse().find(p => p.actual != null && p.actual === 0)
                            return lastActual ? formatMonth(lastActual.month) : formatMonth(card.endDate)
                          })()}</span>
                          <svg className={`paydown-completed-chevron${isSelected ? ' paydown-completed-chevron--open' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 5L6 8L9 5" /></svg>
                        </button>
                        {isSelected && (
                          <PayDownCard
                            card={card}
                            onEdit={openEditModal}
                            onDelete={handleDelete}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <PayDownModal
        isOpen={isModalOpen}
        form={form}
        liabilityAccounts={liabilityAccounts}
        error={error}
        editingLoanId={editingLoanId}
        onClose={closeModal}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
      />
    </>
  )
}

export default PayDown
