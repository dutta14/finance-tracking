import { FC, useState, useRef } from 'react'
import type { TaxChecklistItem } from '../types'
import type { Account } from '../../data/types'

export interface ChecklistRowProps {
  item: TaxChecklistItem
  year: number
  onUpload: (itemId: string, files: FileList) => void
  onRemoveFile: (itemId: string, fileId: string) => void
  onRemoveItem: (itemId: string) => void
  onRename: (itemId: string, newLabel: string) => void
  primaryName: string
  partnerName: string
  primaryAvatar?: string
  partnerAvatar?: string
  accounts: Account[]
}

const ChecklistRow: FC<ChecklistRowProps> = ({
  item,
  year: _year,
  onUpload,
  onRemoveFile,
  onRemoveItem,
  onRename,
  primaryName: _primaryName,
  partnerName: _partnerName,
  primaryAvatar: _primaryAvatar,
  partnerAvatar: _partnerAvatar,
  accounts,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.label)
  const hasFiles = item.files.length > 0
  const linkedAccts =
    item.accountIds.length > 0
      ? item.accountIds
          .map(id => accounts.find(a => a.id === id)?.name)
          .filter(Boolean)
          .join(', ')
      : null

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== item.label) onRename(item.id, trimmed)
    else setDraft(item.label)
    setEditing(false)
  }

  return (
    <div className={`tax-item${hasFiles ? ' tax-item--done' : ''}`} data-done={hasFiles ? 'true' : 'false'}>
      <div
        className="tax-item-check"
        role="img"
        aria-label={`${item.label}${hasFiles ? ' (complete)' : ' (not started)'}`}
      >
        {hasFiles ? <span className="tax-item-tick">✓</span> : <span className="tax-item-empty" />}
      </div>
      <div className="tax-item-body">
        <div className="tax-item-label">
          {editing ? (
            <input
              className="tax-rename-input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setDraft(item.label)
                  setEditing(false)
                }
              }}
              autoFocus
            />
          ) : (
            <>
              <span
                className="tax-item-label-text"
                onDoubleClick={() => {
                  setDraft(item.label)
                  setEditing(true)
                }}
              >
                {item.label}
              </span>
              <button
                className="tax-rename-btn"
                onClick={() => {
                  setDraft(item.label)
                  setEditing(true)
                }}
                title="Rename"
              >
                ✎
              </button>
            </>
          )}
          {!editing && linkedAccts && <span className="tax-item-acct">{linkedAccts}</span>}
        </div>
        {item.files.length > 0 && (
          <div className="tax-item-files">
            {item.files.map(f => (
              <span key={f.id} className="tax-file-chip">
                <span className="tax-file-name">{f.name}</span>
                <button className="tax-file-remove" onClick={() => onRemoveFile(item.id, f.id)} title="Remove file">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="tax-item-actions">
        <button className="tax-btn tax-btn--sm" onClick={() => inputRef.current?.click()}>
          {hasFiles ? 'Add' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files?.length) {
              onUpload(item.id, e.target.files)
              e.target.value = ''
            }
          }}
        />
        <button
          className="tax-btn tax-btn--sm tax-btn--muted"
          onClick={() => onRemoveItem(item.id)}
          title="Remove item"
        >
          ×
        </button>
      </div>
    </div>
  )
}

export default ChecklistRow
