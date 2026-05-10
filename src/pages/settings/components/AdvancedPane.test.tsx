import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvancedPane from './AdvancedPane'
import type { AdvancedPaneProps } from '../types'

const defaultProps: AdvancedPaneProps = {
  allowCsvImport: false,
  onToggleAllowCsvImport: vi.fn(),
  onExport: vi.fn(),
  onImport: vi.fn(),
  onFactoryReset: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdvancedPane', () => {
  it('renders the Advanced heading and description', () => {
    render(<AdvancedPane {...defaultProps} />)
    expect(screen.getByText('Advanced')).toBeInTheDocument()
    expect(screen.getByText('Manage app data and reset your application')).toBeInTheDocument()
  })

  it('renders export, import, and factory reset buttons', () => {
    render(<AdvancedPane {...defaultProps} />)
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /factory reset app/i })).toBeInTheDocument()
  })

  it('renders CSV import toggle as a switch with correct aria-checked', () => {
    render(<AdvancedPane {...defaultProps} allowCsvImport={true} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onToggleAllowCsvImport when toggle is clicked', async () => {
    render(<AdvancedPane {...defaultProps} />)
    await userEvent.click(screen.getByRole('switch'))
    expect(defaultProps.onToggleAllowCsvImport).toHaveBeenCalledOnce()
  })

  it('calls onExport when export button is clicked', async () => {
    render(<AdvancedPane {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /export/i }))
    expect(defaultProps.onExport).toHaveBeenCalledOnce()
  })

  it('opens hidden file input when import button is clicked', async () => {
    render(<AdvancedPane {...defaultProps} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')
    await userEvent.click(screen.getByRole('button', { name: /import/i }))
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('calls onImport with the selected file when a file is chosen', () => {
    render(<AdvancedPane {...defaultProps} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const testFile = new File(['{}'], 'data.json', { type: 'application/json' })
    fireEvent.change(fileInput, { target: { files: [testFile] } })
    expect(defaultProps.onImport).toHaveBeenCalledWith(testFile)
  })

  it('shows confirmation dialog when Factory Reset App is clicked', async () => {
    render(<AdvancedPane {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /factory reset app/i }))
    expect(screen.getByText('Permanently reset the app?')).toBeInTheDocument()
    expect(screen.getByText(/erase all goals, data, and settings/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes, reset everything/i })).toBeInTheDocument()
  })

  it('hides confirmation and does nothing when Cancel is clicked', async () => {
    render(<AdvancedPane {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /factory reset app/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText('Permanently reset the app?')).not.toBeInTheDocument()
    expect(defaultProps.onFactoryReset).not.toHaveBeenCalled()
  })

  it('calls onFactoryReset and onClose when Yes, Reset Everything is clicked', async () => {
    render(<AdvancedPane {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /factory reset app/i }))
    await userEvent.click(screen.getByRole('button', { name: /yes, reset everything/i }))
    expect(defaultProps.onFactoryReset).toHaveBeenCalledOnce()
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('accepts only .json files in the file input', () => {
    render(<AdvancedPane {...defaultProps} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput.accept).toBe('.json')
  })
})
