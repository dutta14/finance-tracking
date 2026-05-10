import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CSVViewer from './CSVViewer'

vi.mock('./driveIcons', () => ({
  BackIcon: () => <span data-testid="back-icon">←</span>,
}))

const sampleCSV = 'Date,Category,Amount\n2025-01-15,Groceries,-150\n2025-01-16,Rent,-2000'

describe('CSVViewer', () => {
  it('renders CSV content as a table with headers and rows', () => {
    render(<CSVViewer content={sampleCSV} label="Jan 2025" ext="csv" onBack={vi.fn()} />)

    expect(screen.getByText('Jan 2025')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('2 rows')).toBeInTheDocument()
  })

  it('handles single-row CSV (header only, no data rows)', () => {
    render(<CSVViewer content="Name,Value" label="Empty.csv" ext="csv" onBack={vi.fn()} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('0 rows')).toBeInTheDocument()
  })

  it('calls onBack when the Back button is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<CSVViewer content={sampleCSV} label="Jan 2025" ext="csv" onBack={onBack} />)

    await user.click(screen.getByText('Back'))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('renders non-CSV files as raw preformatted text', () => {
    const rawContent = '{"key": "value"}'
    render(<CSVViewer content={rawContent} label="data.json" ext="json" onBack={vi.fn()} />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(rawContent)).toBeInTheDocument()
    expect(screen.getByText('data.json')).toBeInTheDocument()
  })
})
