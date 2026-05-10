import { render, screen, within, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ManualTransactionEntry from './ManualTransactionEntry'
import { CategoryGroup } from '../types'

const groups: CategoryGroup[] = [
  { id: 'food', name: 'Food', categories: ['Groceries', 'Restaurants'] },
  { id: 'housing', name: 'Housing', categories: ['Rent', 'Utilities'] },
]

const currentYear = new Date().getFullYear()
const years = [currentYear - 1, currentYear, currentYear + 1]

function renderEntry(overrides: Partial<React.ComponentProps<typeof ManualTransactionEntry>> = {}) {
  const onAdd = vi.fn()
  const result = render(<ManualTransactionEntry categoryGroups={groups} years={years} onAdd={onAdd} {...overrides} />)
  return { onAdd, ...result }
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /add transaction/i }))
}

function selectFirstCategory(catInput: HTMLElement) {
  fireEvent.focus(catInput)
  fireEvent.keyDown(catInput, { key: 'ArrowDown' })
  fireEvent.keyDown(catInput, { key: 'Enter' })
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('ManualTransactionEntry', () => {
  it('renders collapsed by default with Add Transaction button', () => {
    renderEntry()
    const btn = screen.getByRole('button', { name: /add transaction/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Date')).not.toBeInTheDocument()
  })

  it('expands form on click', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    expect(screen.getByRole('button', { name: /add transaction/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Date')).toBeInTheDocument()
  })

  it('shows date, description, amount, and category inputs when expanded', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    expect(screen.getByLabelText('Date')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toBeInTheDocument()
    expect(screen.getByLabelText('Category')).toBeInTheDocument()
  })

  it('pre-fills date with today in ISO format', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    const dateVal = (screen.getByLabelText('Date') as HTMLInputElement).value
    expect(dateVal).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(dateVal).toBe(expected)
  })

  it('collapses form on Cancel click', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    expect(screen.getByLabelText('Date')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByLabelText('Date')).not.toBeInTheDocument()
  })

  it('shows category dropdown on focus with all categories', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    const catInput = screen.getByLabelText('Category')
    await user.click(catInput)
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    expect(options).toHaveLength(4)
    expect(options.map(o => o.textContent)).toEqual(['Groceries', 'Restaurants', 'Rent', 'Utilities'])
  })

  it('filters category dropdown as user types', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    const catInput = screen.getByLabelText('Category')
    fireEvent.focus(catInput)
    fireEvent.change(catInput, { target: { value: 'gro' } })
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('Groceries')
  })

  it('shows no match message when filter yields no results', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    const catInput = screen.getByLabelText('Category')
    fireEvent.focus(catInput)
    fireEvent.change(catInput, { target: { value: 'zzzzz' } })
    expect(screen.getByText(/no match for "zzzzz"/i)).toBeInTheDocument()
  })

  it('shows empty categories message when no category groups exist', async () => {
    const user = userEvent.setup()
    renderEntry({ categoryGroups: [] })
    await openForm(user)
    const catInput = screen.getByLabelText('Category')
    fireEvent.focus(catInput)
    expect(screen.getByText(/no categories/i)).toBeInTheDocument()
  })

  it('selects a category via keyboard ArrowDown + Enter', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    const catInput = screen.getByLabelText('Category')
    fireEvent.focus(catInput)
    fireEvent.keyDown(catInput, { key: 'ArrowDown' })
    fireEvent.keyDown(catInput, { key: 'ArrowDown' })
    fireEvent.keyDown(catInput, { key: 'Enter' })
    expect(catInput).toHaveValue('Restaurants')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes category dropdown on Escape', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    const catInput = screen.getByLabelText('Category')
    fireEvent.focus(catInput)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(catInput, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('validates amount is required on submit', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderEntry()
    await openForm(user)
    selectFirstCategory(screen.getByLabelText('Category'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Amount is required')).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('validates amount is a valid number', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderEntry()
    await openForm(user)
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'abc' } })
    selectFirstCategory(screen.getByLabelText('Category'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter a valid number')).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('validates category is required', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderEntry()
    await openForm(user)
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Category is required')).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('validates date year must be in years list', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderEntry({ years: [2000] })
    await openForm(user)
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } })
    selectFirstCategory(screen.getByLabelText('Category'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText(/budget for \d{4} doesn't exist/i)).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('calls onAdd with correct monthKey and CSV line on valid submit', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderEntry()
    await openForm(user)
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Whole Foods' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '42.50' } })
    selectFirstCategory(screen.getByLabelText('Category'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onAdd).toHaveBeenCalledOnce()
    const [monthKey, csvLine] = onAdd.mock.calls[0]
    const now = new Date()
    const expectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(monthKey).toBe(expectedMonth)
    expect(csvLine).toContain('Groceries')
    expect(csvLine).toContain('42.5')
    expect(csvLine).toContain('Whole Foods')
  })

  it('escapes commas and quotes in description for CSV safety', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderEntry()
    await openForm(user)
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Bob\'s, "fancy" store' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } })
    selectFirstCategory(screen.getByLabelText('Category'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onAdd).toHaveBeenCalledOnce()
    const csvLine = onAdd.mock.calls[0][1]
    expect(csvLine).toContain('"Bob\'s, ""fancy"" store"')
  })

  describe('success flash', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows success flash after submission then clears it', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderEntry()
      await openForm(user)
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } })
      selectFirstCategory(screen.getByLabelText('Category'))
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.getByRole('button', { name: /added/i })).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    })
  })

  it('clears form fields after successful submission', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } })
    selectFirstCategory(screen.getByLabelText('Category'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByLabelText('Description')).toHaveValue('')
    expect(screen.getByLabelText('Amount')).toHaveValue('')
    expect(screen.getByLabelText('Category')).toHaveValue('')
  })

  it('filters out removed group from category dropdown', async () => {
    const user = userEvent.setup()
    const groupsWithRemoved: CategoryGroup[] = [...groups, { id: 'removed', name: 'Removed', categories: ['OldCat'] }]
    renderEntry({ categoryGroups: groupsWithRemoved })
    await openForm(user)
    const catInput = screen.getByLabelText('Category')
    fireEvent.focus(catInput)
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    const texts = options.map(o => o.textContent)
    expect(texts).not.toContain('OldCat')
  })

  it('clears category error when selecting from dropdown', async () => {
    const user = userEvent.setup()
    renderEntry()
    await openForm(user)
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Category is required')).toBeInTheDocument()
    selectFirstCategory(screen.getByLabelText('Category'))
    expect(screen.queryByText('Category is required')).not.toBeInTheDocument()
  })

  it('strips dollar signs and commas from amount before parsing', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderEntry()
    await openForm(user)
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '$1,234.56' } })
    selectFirstCategory(screen.getByLabelText('Category'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onAdd).toHaveBeenCalledOnce()
    const csvLine = onAdd.mock.calls[0][1]
    expect(csvLine).toContain('1234.56')
  })
})
