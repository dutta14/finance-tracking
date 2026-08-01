import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonthPicker from './MonthPicker'

const MONTHS = ['2025-07', '2025-05', '2024-12']

const StatefulMonthPicker = ({ initialMonth = MONTHS[0] }: { initialMonth?: string }) => {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)

  return <MonthPicker allMonths={MONTHS} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
}

describe('MonthPicker', () => {
  it('renders the current month label', () => {
    render(<MonthPicker allMonths={MONTHS} selectedMonth="2025-07" onMonthChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Choose month, currently July 2025' })).toHaveTextContent('July 2025')
  })

  it('opens the popover on click and shows year navigation', async () => {
    const user = userEvent.setup()

    render(<MonthPicker allMonths={MONTHS} selectedMonth="2025-07" onMonthChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Choose month, currently July 2025' }))

    const picker = screen.getByRole('dialog', { name: 'Select month' })

    expect(picker).toBeVisible()
    expect(within(picker).getByText('2025')).toBeVisible()
    expect(within(picker).getByRole('button', { name: 'Show previous year, 2024' })).toBeEnabled()
    expect(within(picker).getByRole('button', { name: 'Show next year, 2026' })).toBeDisabled()
  })

  it('clicking a month calls onMonthChange', async () => {
    const user = userEvent.setup()
    const onMonthChange = vi.fn()

    render(<MonthPicker allMonths={MONTHS} selectedMonth="2025-07" onMonthChange={onMonthChange} />)

    await user.click(screen.getByRole('button', { name: 'Choose month, currently July 2025' }))
    await user.click(screen.getByRole('button', { name: 'May 2025' }))

    expect(onMonthChange).toHaveBeenCalledWith('2025-05')
  })

  it('disables months that are not in allMonths', async () => {
    const user = userEvent.setup()

    render(<MonthPicker allMonths={MONTHS} selectedMonth="2025-07" onMonthChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Choose month, currently July 2025' }))

    expect(screen.getByRole('button', { name: 'January 2025' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'July 2025' })).toBeEnabled()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()

    render(<StatefulMonthPicker />)

    const trigger = screen.getByRole('button', { name: 'Choose month, currently July 2025' })

    await user.click(trigger)
    await waitFor(() => expect(screen.getByRole('button', { name: 'July 2025' })).toHaveFocus())
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Select month' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('uses chevrons to step through months', async () => {
    const user = userEvent.setup()

    render(<StatefulMonthPicker />)

    const previousMonthButton = screen.getByRole('button', { name: 'Previous month' })
    const nextMonthButton = screen.getByRole('button', { name: 'Next month' })

    expect(previousMonthButton).toBeEnabled()
    expect(nextMonthButton).toBeDisabled()

    await user.click(previousMonthButton)

    expect(screen.getByRole('button', { name: 'Choose month, currently May 2025' })).toHaveTextContent('May 2025')
    expect(previousMonthButton).toBeEnabled()
    expect(nextMonthButton).toBeEnabled()

    await user.click(previousMonthButton)

    expect(screen.getByRole('button', { name: 'Choose month, currently December 2024' })).toHaveTextContent(
      'December 2024',
    )
    expect(previousMonthButton).toBeDisabled()
    expect(nextMonthButton).toBeEnabled()

    await user.click(nextMonthButton)

    expect(screen.getByRole('button', { name: 'Choose month, currently May 2025' })).toHaveTextContent('May 2025')
  })
})
