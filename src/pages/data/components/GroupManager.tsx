import { FC, useState, useRef } from 'react'
import { Account } from '../types'

interface GroupManagerProps {
  accounts: Account[]
  existingGroups: string[]
  dragAccountId: number | null
  dropTarget: string | null
  onSetDragAccountId: (id: number | null) => void
  onSetDropTarget: (target: string | null) => void
  onUpdate: (id: number, updates: Partial<Account>) => void
  onRenameGroup: (oldName: string, newName: string) => void
}

const GroupManager: FC<GroupManagerProps> = ({
  accounts,
  existingGroups,
  dragAccountId,
  dropTarget,
  onSetDragAccountId,
  onSetDropTarget,
  onUpdate,
  onRenameGroup,
}) => {
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupInput, setNewGroupInput] = useState('')
  const [pendingGroupName, setPendingGroupName] = useState<string | null>(null)
  const newGroupRef = useRef<HTMLInputElement>(null)

  return (
    <div className="data-groups-page">
      {existingGroups.map(g => {
        const members = accounts.filter(a => a.group === g)
        return (
          <div
            key={g}
            className={`data-group-card${dropTarget === g ? ' data-group-card--drop' : ''}`}
            onDragOver={e => {
              e.preventDefault()
              onSetDropTarget(g)
            }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) onSetDropTarget(null)
            }}
            onDrop={() => {
              if (dragAccountId != null) {
                onUpdate(dragAccountId, { group: g })
                onSetDragAccountId(null)
                onSetDropTarget(null)
              }
            }}
          >
            <div className="data-group-card-header">
              {renamingGroup === g ? (
                <input
                  ref={renameInputRef}
                  className="data-group-rename-input"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && renameValue.trim() && renameValue.trim() !== g) {
                      onRenameGroup(g, renameValue.trim())
                      setRenamingGroup(null)
                    }
                    if (e.key === 'Escape') setRenamingGroup(null)
                  }}
                  onBlur={() => {
                    if (renameValue.trim() && renameValue.trim() !== g) onRenameGroup(g, renameValue.trim())
                    setRenamingGroup(null)
                  }}
                />
              ) : (
                <>
                  <span className="data-group-card-name">{g}</span>
                  <button
                    className="data-group-rename-btn"
                    title="Rename group"
                    onClick={() => {
                      setRenamingGroup(g)
                      setRenameValue(g)
                      setTimeout(() => renameInputRef.current?.select(), 0)
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M3 17h14M10 3l4 4-7 7H3v-4l7-7z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
            <div className="data-group-card-members">
              {members.map(a => (
                <span
                  key={a.id}
                  className="data-group-member"
                  draggable
                  onDragStart={() => onSetDragAccountId(a.id)}
                  onDragEnd={() => {
                    onSetDragAccountId(null)
                    onSetDropTarget(null)
                  }}
                >
                  <span className={`data-group-member-dot data-group-member-dot--${a.owner}`} />
                  {a.name}
                  {a.status === 'inactive' && <span className="data-group-member-inactive">inactive</span>}
                </span>
              ))}
            </div>
          </div>
        )
      })}

      {creatingGroup ? (
        <div className="data-group-card data-group-card--new">
          <div className="data-group-card-header">
            <input
              ref={newGroupRef}
              className="data-group-rename-input"
              value={newGroupInput}
              onChange={e => setNewGroupInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newGroupInput.trim()) {
                  setPendingGroupName(newGroupInput.trim())
                  setCreatingGroup(false)
                  setNewGroupInput('')
                }
                if (e.key === 'Escape') {
                  setCreatingGroup(false)
                  setNewGroupInput('')
                }
              }}
              onBlur={() => {
                if (newGroupInput.trim()) {
                  setPendingGroupName(newGroupInput.trim())
                }
                setCreatingGroup(false)
                setNewGroupInput('')
              }}
              placeholder="Group name"
            />
          </div>
          <div className="data-group-card-members data-group-card-members--empty">
            <span className="data-group-empty-hint">Type a name then press Enter</span>
          </div>
        </div>
      ) : pendingGroupName && !existingGroups.includes(pendingGroupName) ? (
        <div
          className={`data-group-card data-group-card--new${dropTarget === '__pending__' ? ' data-group-card--drop' : ''}`}
          onDragOver={e => {
            e.preventDefault()
            onSetDropTarget('__pending__')
          }}
          onDragLeave={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) onSetDropTarget(null)
          }}
          onDrop={() => {
            if (dragAccountId != null && pendingGroupName) {
              onUpdate(dragAccountId, { group: pendingGroupName })
              onSetDragAccountId(null)
              onSetDropTarget(null)
              setPendingGroupName(null)
            }
          }}
        >
          <div className="data-group-card-header">
            <span className="data-group-card-name">{pendingGroupName}</span>
            <button
              className="data-group-rename-btn data-group-rename-btn--visible"
              title="Remove"
              onClick={() => setPendingGroupName(null)}
            >
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="data-group-card-members data-group-card-members--empty">
            <span className="data-group-empty-hint">Drag accounts here</span>
          </div>
        </div>
      ) : (
        <button
          className="data-group-add-btn"
          onClick={() => {
            setCreatingGroup(true)
            setPendingGroupName(null)
            setTimeout(() => newGroupRef.current?.focus(), 0)
          }}
        >
          + New Group
        </button>
      )}

      {(() => {
        const ungrouped = accounts.filter(a => !a.group)
        if (ungrouped.length === 0) return null
        return (
          <div
            className={`data-group-card data-group-card--ungrouped${dropTarget === '__ungrouped__' ? ' data-group-card--drop' : ''}`}
            onDragOver={e => {
              e.preventDefault()
              onSetDropTarget('__ungrouped__')
            }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) onSetDropTarget(null)
            }}
            onDrop={() => {
              if (dragAccountId != null) {
                onUpdate(dragAccountId, { group: undefined })
                onSetDragAccountId(null)
                onSetDropTarget(null)
              }
            }}
          >
            <div className="data-group-card-header">
              <span className="data-group-card-name data-group-card-name--muted">Ungrouped</span>
            </div>
            <div className="data-group-card-members">
              {ungrouped.map(a => (
                <span
                  key={a.id}
                  className="data-group-member"
                  draggable
                  onDragStart={() => onSetDragAccountId(a.id)}
                  onDragEnd={() => {
                    onSetDragAccountId(null)
                    onSetDropTarget(null)
                  }}
                >
                  <span className={`data-group-member-dot data-group-member-dot--${a.owner}`} />
                  {a.name}
                  {a.status === 'inactive' && <span className="data-group-member-inactive">inactive</span>}
                </span>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default GroupManager
