import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileStoreContext } from '../../../contexts/FileStoreContext'
import { makeFileStoreValue } from '../../../test/fileStoreTestUtils'
import { MemoryFileStore } from '../../../utils/memoryFileStore'

const { mockGetStorageItem, mockSetStorageItem } = vi.hoisted(() => ({
  mockGetStorageItem: vi.fn().mockReturnValue('0'),
  mockSetStorageItem: vi.fn(),
}))

vi.mock('../../../utils/storage', () => ({
  getStorageItem: mockGetStorageItem,
  setStorageItem: mockSetStorageItem,
}))

import LabsPane from './LabsPane'

const mockEnterDemo = vi.fn()
const mockExitDemo = vi.fn()

const renderPane = () =>
  render(
    <FileStoreContext.Provider
      value={{ ...makeFileStoreValue(new MemoryFileStore()), enterDemo: mockEnterDemo, exitDemo: mockExitDemo }}
    >
      <LabsPane />
    </FileStoreContext.Provider>,
  )

const activateDemo = () => localStorage.setItem('_demoMode', '1')

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockGetStorageItem.mockReturnValue('0')
})

describe('LabsPane', () => {
  it('renders the Labs heading and description', () => {
    renderPane()
    expect(screen.getByText('Labs')).toBeInTheDocument()
    expect(screen.getByText(/experimental features/i)).toBeInTheDocument()
  })

  it('renders PDF → CSV toggle switch in off state', () => {
    renderPane()
    const pdfSwitch = screen.getByRole('switch', { name: /pdf.*csv/i })
    expect(pdfSwitch).toHaveAttribute('aria-checked', 'false')
  })

  it('renders PDF → CSV toggle in on state when storage value is 1', () => {
    mockGetStorageItem.mockReturnValue('1')
    renderPane()
    const pdfSwitch = screen.getByRole('switch', { name: /pdf.*csv/i })
    expect(pdfSwitch).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles PDF → CSV on click and persists to storage', async () => {
    renderPane()
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
    renderPane()
    const pdfSwitch = screen.getByRole('switch', { name: /pdf.*csv/i })
    expect(pdfSwitch).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(pdfSwitch)
    expect(pdfSwitch).toHaveAttribute('aria-checked', 'false')
    expect(mockSetStorageItem).toHaveBeenCalledWith('lab-pdf-to-csv', '0')
  })

  it('renders Demo Mode toggle switch', () => {
    renderPane()
    const demoSwitch = screen.getByRole('switch', { name: /demo mode/i })
    expect(demoSwitch).toHaveAttribute('aria-checked', 'false')
  })

  it('enters demo mode when the toggle is clicked while inactive', async () => {
    renderPane()
    await userEvent.click(screen.getByRole('switch', { name: /demo mode/i }))
    expect(mockEnterDemo).toHaveBeenCalledOnce()
    expect(mockExitDemo).not.toHaveBeenCalled()
  })

  it('exits demo mode when the toggle is clicked while active', async () => {
    activateDemo()
    renderPane()
    await userEvent.click(screen.getByRole('switch', { name: /demo mode/i }))
    expect(mockExitDemo).toHaveBeenCalledOnce()
    expect(mockEnterDemo).not.toHaveBeenCalled()
  })

  it('shows the active hint text when demo mode is on', () => {
    activateDemo()
    renderPane()
    expect(screen.getByText(/sample data only/i)).toBeInTheDocument()
  })

  it('shows the invitation hint text when demo mode is off', () => {
    renderPane()
    expect(screen.getByText(/explore the app with realistic sample data/i)).toBeInTheDocument()
  })
})
