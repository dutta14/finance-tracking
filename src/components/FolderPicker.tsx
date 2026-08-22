import { FC, useCallback, useState } from 'react'
import { useFileStore } from '../contexts/FileStoreContext'
import '../styles/FolderPicker.css'

const FolderIcon: FC = () => (
  <svg
    className="folder-picker-icon"
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
)

const isSupported = (): boolean => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'

const FolderPicker: FC = () => {
  const { pickFolder, enterDemo } = useFileStore()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const supported = isSupported()

  const handlePick = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      await pickFolder()
    } catch (e) {
      const name = (e as { name?: string })?.name
      if (name === 'AbortError') setError('No folder selected. Choose a folder to continue.')
      else if (name === 'NotAllowedError') setError('Permission denied. Grant read & write access to use this folder.')
      else setError('Could not open that folder. Try another one.')
    } finally {
      setBusy(false)
    }
  }, [pickFolder])

  return (
    <div className="folder-picker">
      <div className="folder-picker-card">
        <div className="folder-picker-brand">
          <FolderIcon />
          <h1 className="folder-picker-title">Choose your data folder</h1>
        </div>
        <p className="folder-picker-copy">
          Your accounts, budgets, goals and tax documents are stored as plain files on your own machine. Pick a folder
          and the app writes everything there. Nothing leaves your device.
        </p>

        {supported ? (
          <>
            <button className="folder-picker-button" onClick={handlePick} disabled={busy}>
              {busy ? 'Waiting for folder…' : 'Choose Folder'}
            </button>
            {error && (
              <p className="folder-picker-error" role="alert">
                {error}
              </p>
            )}
            <button className="folder-picker-secondary" onClick={enterDemo}>
              Explore with demo data
            </button>
          </>
        ) : (
          <p className="folder-picker-error" role="alert">
            This app requires Chrome or Edge. Your browser does not support the File System Access API.
          </p>
        )}
      </div>
    </div>
  )
}

export default FolderPicker
