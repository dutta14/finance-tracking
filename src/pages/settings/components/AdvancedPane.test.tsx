import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvancedPane from './AdvancedPane'
import type { AdvancedPaneProps } from '../types'

const defaultProps: AdvancedPaneProps = {
  allowCsvImport: false,
  onToggleAllowCsvImport: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdvancedPane', () => {
  it('renders the Advanced heading and description', () => {
    render(<AdvancedPane {...defaultProps} />)
    expect(screen.getByText('Advanced')).toBeInTheDocument()
    expect(screen.getByText('Turn on power-user tools for bulk data entry')).toBeInTheDocument()
  })

  it('renders the CSV import toggle as a switch reflecting the current value', () => {
    render(<AdvancedPane {...defaultProps} allowCsvImport={true} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('renders the CSV import toggle as off when imports are disabled', () => {
    render(<AdvancedPane {...defaultProps} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onToggleAllowCsvImport when the toggle is clicked', async () => {
    render(<AdvancedPane {...defaultProps} />)
    await userEvent.click(screen.getByRole('switch'))
    expect(defaultProps.onToggleAllowCsvImport).toHaveBeenCalledOnce()
  })

  it('no longer offers export, import or factory reset actions', () => {
    render(<AdvancedPane {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /import/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /factory reset/i })).not.toBeInTheDocument()
  })
})
