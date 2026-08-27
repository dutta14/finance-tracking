import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FolderPicker from './FolderPicker'

const { mockPickFolder, mockEnterDemo } = vi.hoisted(() => ({
  mockPickFolder: vi.fn(),
  mockEnterDemo: vi.fn(),
}))

vi.mock('../contexts/FileStoreContext', () => ({
  useFileStore: () => ({
    pickFolder: mockPickFolder,
    enterDemo: mockEnterDemo,
  }),
}))

describe('FolderPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the unsupported browser alert when directory picking is unavailable', () => {
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined, configurable: true })

    render(<FolderPicker />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This app requires Chrome or Edge. Your browser does not support the File System Access API.',
    )
    expect(screen.queryByRole('button', { name: 'Choose Folder' })).not.toBeInTheDocument()
  })

  it('lets the user explore demo data', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'showDirectoryPicker', { value: vi.fn(), configurable: true })

    render(<FolderPicker />)
    await user.click(screen.getByRole('button', { name: 'Explore with demo data' }))

    expect(mockEnterDemo).toHaveBeenCalledOnce()
  })

  it('shows a busy label while picking a folder and clears it after success', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'showDirectoryPicker', { value: vi.fn(), configurable: true })

    let resolvePick = () => {}
    mockPickFolder.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolvePick = resolve
        }),
    )

    render(<FolderPicker />)

    await user.click(screen.getByRole('button', { name: 'Choose Folder' }))
    expect(screen.getByRole('button', { name: 'Waiting for folder…' })).toBeDisabled()

    await Promise.resolve().then(resolvePick)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Choose Folder' })).toBeEnabled()
    })
  })

  it('shows specific errors for aborted and denied folder picks', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'showDirectoryPicker', { value: vi.fn(), configurable: true })

    mockPickFolder.mockRejectedValueOnce({ name: 'AbortError' }).mockRejectedValueOnce({ name: 'NotAllowedError' })

    render(<FolderPicker />)

    await user.click(screen.getByRole('button', { name: 'Choose Folder' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No folder selected. Choose a folder to continue.')

    await user.click(screen.getByRole('button', { name: 'Choose Folder' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Permission denied. Grant read & write access to use this folder.',
    )
  })

  it('shows a generic error for unexpected failures', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'showDirectoryPicker', { value: vi.fn(), configurable: true })
    mockPickFolder.mockRejectedValueOnce(new Error('boom'))

    render(<FolderPicker />)
    await user.click(screen.getByRole('button', { name: 'Choose Folder' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Could not open that folder. Try another one.')
  })
})
