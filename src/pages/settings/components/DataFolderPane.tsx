import { FC, useCallback, useState } from 'react'
import { useFileStore } from '../../../contexts/FileStoreContext'

const DataFolderPane: FC = () => {
  const { folderName, isReady, pickFolder, disconnect } = useFileStore()
  const [error, setError] = useState('')

  const handleChange = useCallback(async () => {
    setError('')
    try {
      await pickFolder()
    } catch (e) {
      const name = (e as { name?: string })?.name
      if (name === 'AbortError') setError('No folder selected — your current folder is unchanged.')
      else if (name === 'NotAllowedError') setError('Permission denied. Grant read & write access to use that folder.')
      else setError('Could not open that folder. Try another one.')
    }
  }, [pickFolder])

  return (
    <div className="settings-section">
      <h3>Data Folder</h3>
      <div className="settings-section-content">
        <p className="settings-description">
          Every account, budget, goal and tax document is stored as a plain file in this folder on your machine.
        </p>

        <div className="settings-toggle-row settings-toggle-row--spaced">
          <div>
            <span className="settings-toggle-label">Current folder</span>
            <span className="settings-toggle-hint">{isReady && folderName ? folderName : 'Not connected'}</span>
          </div>
        </div>

        <div className="settings-data-actions">
          <button className="settings-btn settings-btn--secondary" onClick={handleChange}>
            Change Folder
          </button>
          <button className="settings-btn settings-btn--danger" onClick={disconnect} disabled={!isReady}>
            Disconnect
          </button>
        </div>

        {error && (
          <p className="settings-description" role="alert">
            {error}
          </p>
        )}

        <p className="settings-description">
          Disconnecting only forgets the folder — your files stay exactly where they are.
        </p>
      </div>
    </div>
  )
}

export default DataFolderPane
