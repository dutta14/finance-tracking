import { FC, useState, useRef, useEffect } from 'react'
import { Account } from '../types'

interface GroupManagerProps {
  accounts: Account[]
  existingGroups: string[]
  ownerLabels: Record<string, string>
  dragAccountId: number | null
  dropTarget: string | null
  startCreating?: boolean
  onStartCreatingHandled?: () => void
  onSetDragAccountId: (id: number | null) => void
  onSetDropTarget: (target: string | null) => void
  onUpdate: (id: number, updates: Partial<Account>) => void
  onRenameGroup: (oldName: string, newName: string) => void
}

const GroupManager: FC<GroupManagerProps> = ({
  accounts,
  existingGroups,
  ownerLabels,
  dragAccountId,
  dropTarget,
  startCreating,
  onStartCreatingHandled,
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

  useEffect(() => {
    if (startCreating) {
      setCreatingGroup(true)
      setPendingGroupName(null)
      onStartCreatingHandled?.()
      setTimeout(() => newGroupRef.current?.focus(), 0)
    }
  }, [startCreating, onStartCreatingHandled])

  // Build composite group entries: split same-name groups by owner
  const groupEntries: { name: string; ownerKey: string; members: typeof accounts }[] = []
  for (const g of existingGroups) {
    const groupAccounts = accounts.filter(a => a.group === g)
    // Split by owner type; joint accounts stay with joint
    const byOwner = new Map<string, typeof accounts>()
    for (const a of groupAccounts) {
      const key = a.owner
      if (!byOwner.has(key)) byOwner.set(key, [])
      byOwner.get(key)!.push(a)
    }
    if (byOwner.size === 1) {
      const [ownerKey, members] = [...byOwner.entries()][0]
      groupEntries.push({ name: g, ownerKey, members })
    } else {
      for (const [ownerKey, members] of byOwner) {
        groupEntries.push({ name: g, ownerKey, members })
      }
    }
  }
  // Sort: active groups first, then inactive
  groupEntries.sort((a, b) => {
    const aInactive = a.members.every(x => x.status === 'inactive') ? 1 : 0
    const bInactive = b.members.every(x => x.status === 'inactive') ? 1 : 0
    return aInactive - bInactive
  })

  return (
    <div className="data-groups-page">
      {groupEntries.map(({ name: g, ownerKey, members }) => {
        const compositeKey = `${g}::${ownerKey}`
        const allInactive = members.every(a => a.status === 'inactive')
        const ownerLabel = ownerLabels[ownerKey] || ownerKey
        return (
          <div
            key={compositeKey}
            className={`data-group-card${allInactive ? ' data-group-card--all-inactive' : ''}${dropTarget === compositeKey ? ' data-group-card--drop' : ''}`}
            onDragOver={e => {
              e.preventDefault()
              onSetDropTarget(compositeKey)
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
              {renamingGroup === compositeKey ? (
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
                  <span className="data-group-card-owner">{ownerLabel}</span>
                  <button
                    className="data-group-rename-btn"
                    title="Rename group"
                    onClick={() => {
                      setRenamingGroup(compositeKey)
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
              {[...members]
                .sort((a, b) => (a.status === 'inactive' ? 1 : 0) - (b.status === 'inactive' ? 1 : 0))
                .map(a => (
                  <span
                    key={a.id}
                    className={`data-group-member${a.status === 'inactive' ? ' data-group-member--inactive' : ''}`}
                    draggable
                    onDragStart={() => onSetDragAccountId(a.id)}
                    onDragEnd={() => {
                      onSetDragAccountId(null)
                      onSetDropTarget(null)
                    }}
                  >
                    <span className={`data-group-member-dot data-group-member-dot--${a.owner}`} />
                    {a.name}
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
      ) : null}

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
            <div className="data-group-card-members data-group-card-members--ungrouped">
              {(['primary', 'partner', 'joint'] as const).map(ownerType => {
                const ownerAccounts = ungrouped.filter(a => a.owner === ownerType)
                if (ownerAccounts.length === 0 && ownerType !== 'primary') return <div key={ownerType} />
                return (
                  <div key={ownerType} className="data-group-ungrouped-col">
                    <span className="data-group-ungrouped-col-label">{ownerLabels[ownerType]}</span>
                    {[...ownerAccounts]
                      .sort((a, b) => (a.status === 'inactive' ? 1 : 0) - (b.status === 'inactive' ? 1 : 0))
                      .map(a => (
                        <span
                          key={a.id}
                          className={`data-group-member${a.status === 'inactive' ? ' data-group-member--inactive' : ''}`}
                          draggable
                          onDragStart={() => onSetDragAccountId(a.id)}
                          onDragEnd={() => {
                            onSetDragAccountId(null)
                            onSetDropTarget(null)
                          }}
                        >
                          <span className={`data-group-member-dot data-group-member-dot--${a.owner}`} />
                          {a.name}
                        </span>
                      ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default GroupManager
