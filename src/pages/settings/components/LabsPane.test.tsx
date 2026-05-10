import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockGetStorageItem, mockSetStorageItem, mockIsDemoActive, mockEnterDemoMode, mockExitDemoMode } = vi.hoisted(
  () => ({
    mockGetStorageItem: vi.fn().mockReturnValue('0'),
    mockSetStorageItem: vi.fn(),
    mockIsDemoActive: vi.fn().mockReturnValue(false),
    mockEnterDemoMode: vi.fn(),
    mockExitDemoMode: vi.fn(),
  }),
)

vi.mock('../../../utils/storage', () => ({
  getStorageItem: mockGetStorageItem,
  setStorageItem: mockSetStorageItem,
}))

vi.mock('../demoMode', () => ({
  isDemoActive: mockIsDemoActive,
  enterDemoMode: mockEnterDemoMode,
  exitDemoMode: mockExitDemoMode,
}))

import LabsPane from './LabsPane'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetStorageItem.mockReturnValue('0')
  mockIsDemoActive.mockReturnValue(false)
})

describe('LabsPane', () => {
  it('renders the Labs heading and description', () => {
    render(<LabsPane />)
    expect(screen.getByText('Labs')).toBeInTheDocument()
    expect(screen.getByText(/experimental features/i)).toBeInTheDocument()
  })

  it('renders PDF → CSV toggle switch in off state', () => {
    render(<LabsPane />)
    const pdfSwitch = screen.getByRole('switch', { name: /pdf.*csv/i })
    expect(pdfSwitch).toHaveAttribute('aria-checked', 'false')
  })

  it('renders PDF → CSV toggle in on state when storage value is 1', () => {
    mockGetStorageItem.mockReturnValue('1')
    render(<LabsPane />)
    const pdfSwitch = screen.getByRole('switch', { name: /pdf.*csv/i })
    expect(pdfSwitch).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles PDF → CSV on click and persists to storage', async () => {
    render(<LabsPane />)
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const pdfSwitch = screen.getByRole('switch', { name: /pdf.*csv/i })
    await userEvent.click(pdfSwitch)
    expect(mockSetStorageItem).toHaveBeenCalledWith('lab-pdf-to-csv', '1')
    expect(pdfSwitch).toHaveAttribute('aria-checked', 'true')
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'labs-changed' }))
    dispatchSpy.mockRestore()
  })

  it('toggles PDF → CSV off after toggling on', async () => {
    mockGetStorageItem.mockReturnValue('1')
    render(<LabsPane />)
    const pdfSwitch = screen.getByRole('switch', { name: /pdf.*csv/i })
    expect(pdfSwitch).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(pdfSwitch)
    expect(pdfSwitch).toHaveAttribute('aria-checked', 'false')
    expect(mockSetStorageItem).toHaveBeenCalledWith('lab-pdf-to-csv', '0')
  })

  it('renders Demo Mode toggle switch', () => {
    render(<LabsPane />)
    const demoSwitch = screen.getByRole('switch', { name: /demo mode/i })
    expect(demoSwitch).toHaveAttribute('aria-checked', 'false')
  })

  it('calls enterDemoMode when demo toggle is clicked while inactive', async () => {
    render(<LabsPane />)
    const demoSwitch = screen.getByRole('switch', { name: /demo mode/i })
    await userEvent.click(demoSwitch)
    expect(mockEnterDemoMode).toHaveBeenCalledOnce()
  })

  it('calls exitDemoMode when demo toggle is clicked while active', async () => {
    mockIsDemoActive.mockReturnValue(true)
    render(<LabsPane />)
    const demoSwitch = screen.getByRole('switch', { name: /demo mode/i })
    await userEvent.click(demoSwitch)
    expect(mockExitDemoMode).toHaveBeenCalledOnce()
  })

  it('shows active hint text when demo mode is active', () => {
    mockIsDemoActive.mockReturnValue(true)
    render(<LabsPane />)
    expect(screen.getByText(/currently active/i)).toBeInTheDocument()
  })

  it('shows inactive hint text when demo mode is not active', () => {
    render(<LabsPane />)
    expect(screen.getByText(/replace your data with realistic sample data/i)).toBeInTheDocument()
  })
})
