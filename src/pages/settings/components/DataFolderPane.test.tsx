import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataFolderPane from './DataFolderPane'

const { mockPickFolder, mockDisconnect, storeState } = vi.hoisted(() => ({
  mockPickFolder: vi.fn(),
  mockDisconnect: vi.fn(),
  storeState: { folderName: 'Household', isReady: true },
}))

vi.mock('../../../contexts/FileStoreContext', () => ({
  useFileStore: () => ({
    folderName: storeState.folderName,
    isReady: storeState.isReady,
    pickFolder: mockPickFolder,
    disconnect: mockDisconnect,
  }),
}))

describe('DataFolderPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.folderName = 'Household'
    storeState.isReady = true
  })

  it('shows the current folder and allows disconnect when ready', async () => {
    const user = userEvent.setup()
    render(<DataFolderPane />)

    expect(screen.getByText('Household')).toBeInTheDocument()
    const disconnectButton = screen.getByRole('button', { name: 'Disconnect' })
    expect(disconnectButton).toBeEnabled()

    await user.click(disconnectButton)
    expect(mockDisconnect).toHaveBeenCalledOnce()
  })

  it('shows not connected state and disables disconnect when not ready', () => {
    storeState.folderName = ''
    storeState.isReady = false

    render(<DataFolderPane />)

    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeDisabled()
  })

  it('shows targeted error messages when changing the folder fails', async () => {
    const user = userEvent.setup()
    mockPickFolder.mockRejectedValueOnce({ name: 'AbortError' }).mockRejectedValueOnce({ name: 'NotAllowedError' })

    render(<DataFolderPane />)

    await user.click(screen.getByRole('button', { name: 'Change Folder' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No folder selected — your current folder is unchanged.')

    await user.click(screen.getByRole('button', { name: 'Change Folder' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Permission denied. Grant read & write access to use that folder.',
    )
  })

  it('shows a generic error for unexpected change-folder failures', async () => {
    const user = userEvent.setup()
    mockPickFolder.mockRejectedValueOnce(new Error('boom'))

    render(<DataFolderPane />)
    await user.click(screen.getByRole('button', { name: 'Change Folder' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Could not open that folder. Try another one.')
  })
})
