import { FC, FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
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
import { appStorage } from '../../../utils/appStorage'
import { useDateFilter } from '../../../hooks/useDateFilter'
import { DateFilterBarFromHook } from '../../../components/DateFilterBar'
import '../../../styles/PayDown.css'

interface PaydownLoan {
  id: number
  name: string
  principal: number
  annualRate: number
  termMonths: number
  startDate: string
  linkedAccountId: number
}

interface LoanFormState {
  name: string
  principal: string
  annualRate: string
  termMonths: string
  startDate: string
  linkedAccountId: string
}

interface ChartPoint {
  month: string
  label: string
  expected: number | null
  actual: number | null
}

const STORAGE_KEY = 'paydown-loans'

const emptyForm: LoanFormState = {
  name: '',
  principal: '',
  annualRate: '',
  termMonths: '',
  startDate: '',
  linkedAccountId: '',
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
  const monthlyPayment =
    monthlyRate === 0
      ? loan.principal / loan.termMonths
      : (loan.principal * (monthlyRate * (1 + monthlyRate) ** loan.termMonths)) /
        ((1 + monthlyRate) ** loan.termMonths - 1)

  const schedule = new Map<string, number>()
  let balance = loan.principal
  schedule.set(loan.startDate, Number(balance.toFixed(2)))

  for (let monthIndex = 1; monthIndex <= loan.termMonths; monthIndex += 1) {
    balance = balance * (1 + monthlyRate) - monthlyPayment
    balance = Math.max(0, Number(balance.toFixed(2)))
    schedule.set(addMonths(loan.startDate, monthIndex), balance)
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
          <div>
            <h2>{editingLoanId ? 'Edit loan' : 'Add loan'}</h2>
            <p>Link a liability account to compare actual balances against the amortization plan.</p>
          </div>
          <button className="action-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="paydown-form" onSubmit={onSubmit}>
          <label className="paydown-field">
            <span>Loan name</span>
            <input
              type="text"
              value={form.name}
              onChange={event => onChange('name', event.target.value)}
              placeholder="Home Loan"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
          </label>

          <div className="paydown-form__grid">
            <label className="paydown-field">
              <span>Principal ($)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.principal}
                onChange={event => onChange('principal', event.target.value)}
                placeholder="300000"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
            </label>

            <label className="paydown-field">
              <span>Annual rate (%)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.annualRate}
                onChange={event => onChange('annualRate', event.target.value)}
                placeholder="6.5"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
            </label>

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

            <label className="paydown-field">
              <span>Start date</span>
              <input
                type="month"
                value={form.startDate}
                onChange={event => onChange('startDate', event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
            </label>
          </div>

          <label className="paydown-field">
            <span>Linked liability account</span>
            <select
              value={form.linkedAccountId}
              onChange={event => onChange('linkedAccountId', event.target.value)}
              disabled={liabilityAccounts.length === 0}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            >
              <option value="">{liabilityAccounts.length === 0 ? 'No liability accounts available' : 'Select account'}</option>
              {liabilityAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

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
              Save loan
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
          <strong>{loan.termMonths} mo</strong>
        </div>
        <div className="paydown-metric">
          <span>Start</span>
          <strong>{formatMonth(loan.startDate)}</strong>
        </div>
        <div className="paydown-metric">
          <span>Expected end</span>
          <strong>{formatMonth(endDate)}</strong>
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

      {!hasActualData ? (
        <p className="paydown-card__hint">No actual balance history found yet for this linked liability account.</p>
      ) : null}
    </article>
  )
}

const PayDown: FC = () => {
  const { accounts, balances } = useData()
  const [loans, setLoans] = useState<PaydownLoan[]>(() => appStorage.getJSON<PaydownLoan[]>(STORAGE_KEY, []))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<LoanFormState>(emptyForm)
  const [error, setError] = useState('')
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null)
  const [paydownTab, setPaydownTab] = useState<'ongoing' | 'completed'>('ongoing')

  const liabilityAccounts = useMemo(
    () => accounts.filter(account => account.nature === 'liability').sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  )

  useEffect(() => appStorage.subscribe(STORAGE_KEY, () => setLoans(appStorage.getJSON<PaydownLoan[]>(STORAGE_KEY, []))), [])

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

        return {
          loan,
          chartData,
          linkedAccount,
          endDate: addMonths(loan.startDate, loan.termMonths),
          hasActualData: actualEntries.length > 0,
        }
      }),
    [balances, liabilityAccounts, loans],
  )

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const ongoingCards = useMemo(
    () => loanCards.filter(({ endDate }) => endDate > currentMonth),
    [loanCards, currentMonth],
  )
  const completedCards = useMemo(
    () => loanCards.filter(({ endDate }) => endDate <= currentMonth),
    [loanCards, currentMonth],
  )
  const visibleCards = paydownTab === 'ongoing' ? ongoingCards : completedCards

  const resetForm = () => {
    setForm(emptyForm)
    setError('')
    setEditingLoanId(null)
  }

  const openModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (loan: PaydownLoan) => {
    setForm({
      name: loan.name,
      principal: String(loan.principal),
      annualRate: String(loan.annualRate),
      termMonths: String(loan.termMonths),
      startDate: loan.startDate,
      linkedAccountId: String(loan.linkedAccountId),
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
    const termMonths = Number.parseInt(form.termMonths, 10)
    const linkedAccountId = Number.parseInt(form.linkedAccountId, 10)

    if (!form.name.trim()) {
      setError('Enter a loan name.')
      return
    }

    if (!Number.isFinite(principal) || principal <= 0) {
      setError('Enter a principal greater than 0.')
      return
    }

    if (!Number.isFinite(annualRate) || annualRate < 0) {
      setError('Enter a valid annual rate.')
      return
    }

    if (!Number.isInteger(termMonths) || termMonths <= 0) {
      setError('Enter a term in whole months.')
      return
    }

    if (!parseMonth(form.startDate)) {
      setError('Select a valid start month.')
      return
    }

    if (!Number.isInteger(linkedAccountId) || !liabilityAccounts.some(account => account.id === linkedAccountId)) {
      setError('Select a linked liability account.')
      return
    }

    const nextLoan: PaydownLoan = {
      id: editingLoanId ?? Date.now(),
      name: form.name.trim(),
      principal,
      annualRate,
      termMonths,
      startDate: form.startDate,
      linkedAccountId,
    }

    const nextLoans = editingLoanId
      ? loans.map(l => (l.id === editingLoanId ? nextLoan : l))
      : [...loans, nextLoan].sort((a, b) => a.name.localeCompare(b.name))
    appStorage.setJSON(STORAGE_KEY, nextLoans)
    closeModal()
  }

  const handleDelete = (loanId: number) => {
    appStorage.setJSON(
      STORAGE_KEY,
      loans.filter(loan => loan.id !== loanId),
    )
  }

  if (loanCards.length === 0) {
    return (
      <>
        <section className="paydown-page">
          <div className="paydown-empty-state">
            <h2>Track loan payoff progress</h2>
            <p>Add a loan to compare its expected amortization against the actual balance history from your liability account.</p>
            <button className="action-btn" type="button" onClick={openModal}>
              Add Loan
            </button>
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
          <button className="action-btn" type="button" onClick={openModal}>
            Add Loan
          </button>
        </div>

        <div className="paydown-list">
          {visibleCards.length === 0 && (
            <div className="paydown-empty-tab">
              No {paydownTab} loans.
            </div>
          )}
          {visibleCards.map(card => (
            <PayDownCard
              key={card.loan.id}
              card={card}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          ))}
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
