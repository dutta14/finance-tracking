import { FC, useState } from 'react'
import { CategoryGroup } from '../types'

interface CategoryGroupManagerProps {
  groups: CategoryGroup[]
  onUpdate: (groups: CategoryGroup[]) => void
  onMerge: (sourceCategories: string[], targetName: string) => void
  onDeleteCategory: (category: string) => void
  categoryHasTransactions: (category: string) => boolean
  categorySums: Record<string, Record<string, number>>
}

const CategoryGroupManager: FC<CategoryGroupManagerProps> = ({
  groups,
  onUpdate,
  onMerge,
  onDeleteCategory,
  categoryHasTransactions,
  categorySums,
}) => {
  const [newGroupName, setNewGroupName] = useState('')

  /** Strip group prefix from category for display: "X: Y" in group "X" → "Y" */
  const displayCat = (cat: string, groupName: string): string => {
    const prefix = groupName + ':'
    if (cat.toLowerCase().startsWith(prefix.toLowerCase())) {
      return cat.slice(prefix.length).trim()
    }
    return cat
  }
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(groups.map(g => g.id)))
  const [dragCat, setDragCat] = useState<{ category: string; fromGroupId: string } | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set())
  const [mergeTargetName, setMergeTargetName] = useState('')
  const [deletingCat, setDeletingCat] = useState<string | null>(null)
  const [deleteMergeTarget, setDeleteMergeTarget] = useState('')

  // Income categories (no negative months) are hidden from group manager
  const isIncomeCategory = (cat: string): boolean => {
    const vals = Object.values(categorySums[cat] || {})
    return !vals.some(v => v < 0) && vals.some(v => v > 0)
  }

  // Filter each group's categories to only show expense categories
  const displayGroups = groups.map(g => ({
    ...g,
    displayCategories: g.categories.filter(c => !isIncomeCategory(c)),
  }))

  const toggleMergeSelect = (cat: string) => {
    setMergeSelected(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const handleMerge = () => {
    const target = mergeTargetName.trim()
    if (!target || mergeSelected.size < 2) return
    onMerge([...mergeSelected], target)
    setMergeMode(false)
    setMergeSelected(new Set())
    setMergeTargetName('')
  }

  const cancelMerge = () => {
    setMergeMode(false)
    setMergeSelected(new Set())
    setMergeTargetName('')
  }

  const handleDeleteCat = (cat: string) => {
    if (categoryHasTransactions(cat)) {
      setDeletingCat(cat)
      setDeleteMergeTarget('')
    } else {
      onDeleteCategory(cat)
    }
  }

  const confirmDeleteMerge = () => {
    if (!deletingCat || !deleteMergeTarget.trim()) return
    onMerge([deletingCat], deleteMergeTarget.trim())
    setDeletingCat(null)
    setDeleteMergeTarget('')
  }

  // All expense categories across all groups for merge mode
  const allExpenseCats = displayGroups.flatMap(g => g.displayCategories).sort((a, b) => a.localeCompare(b))

  const toggleExpanded = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addGroup = () => {
    const name = newGroupName.trim()
    if (!name) return
    if (groups.find(g => g.name.toLowerCase() === name.toLowerCase())) return
    const id = `group-${Date.now()}`
    const removedIdx = groups.findIndex(g => g.id === 'removed')
    const insertAt = removedIdx >= 0 ? removedIdx : groups.length
    const newGroups = [...groups.slice(0, insertAt), { id, name, categories: [] }, ...groups.slice(insertAt)]
    onUpdate(newGroups)
    setNewGroupName('')
    setExpandedGroups(prev => new Set([...prev, id]))
  }

  const renameGroup = (id: string) => {
    const name = editName.trim()
    if (!name || id === 'others' || id === 'removed') return
    onUpdate(groups.map(g => (g.id === id ? { ...g, name } : g)))
    setEditingId(null)
  }

  const removeGroup = (id: string) => {
    if (id === 'others' || id === 'removed') return
    const group = groups.find(g => g.id === id)
    if (!group) return
    onUpdate(
      groups
        .filter(g => g.id !== id)
        .map(g => (g.id === 'others' ? { ...g, categories: [...g.categories, ...group.categories] } : g)),
    )
  }

  const handleDragStart = (e: React.DragEvent, category: string, fromGroupId: string) => {
    e.dataTransfer.setData('text/plain', category)
    e.dataTransfer.effectAllowed = 'move'
    setDragCat({ category, fromGroupId })
  }

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverGroupId(groupId)
  }

  const handleDrop = (e: React.DragEvent, toGroupId: string) => {
    e.preventDefault()
    setDragOverGroupId(null)
    if (!dragCat || dragCat.fromGroupId === toGroupId) {
      setDragCat(null)
      return
    }
    onUpdate(
      groups.map(g => {
        if (g.id === dragCat.fromGroupId) {
          return { ...g, categories: g.categories.filter(c => c !== dragCat.category) }
        }
        if (g.id === toGroupId) {
          return { ...g, categories: [...g.categories, dragCat.category] }
        }
        return g
      }),
    )
    setDragCat(null)
  }

  const handleDragEnd = () => {
    setDragCat(null)
    setDragOverGroupId(null)
  }

  const moveGroup = (id: string, direction: 'up' | 'down') => {
    const idx = groups.findIndex(g => g.id === id)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= groups.length) return
    // Don't swap with "removed" (always last)
    if (groups[targetIdx].id === 'removed') return
    const newGroups = [...groups]
    ;[newGroups[idx], newGroups[targetIdx]] = [newGroups[targetIdx], newGroups[idx]]
    onUpdate(newGroups)
  }

  return (
    <div className="budget-group-manager">
      <div className="budget-group-manager-header">
        <h4 className="budget-group-manager-title">Expense Category Groups</h4>
        <p className="budget-group-manager-hint">
          Drag expense categories between groups. Income categories are grouped automatically.
        </p>
      </div>

      <div className="budget-group-list">
        {displayGroups.map(g => {
          const isExpanded = expandedGroups.has(g.id)
          const isDropTarget = dragOverGroupId === g.id && dragCat?.fromGroupId !== g.id
          const isRemoved = g.id === 'removed'
          const isProtected = g.id === 'others' || g.id === 'removed'

          return (
            <div
              key={g.id}
              className={`budget-group-block${isDropTarget ? ' budget-group-block--drop-target' : ''}${isRemoved ? ' budget-group-block--removed' : ''}`}
              onDragOver={e => handleDragOver(e, g.id)}
              onDrop={e => handleDrop(e, g.id)}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverGroupId(null)
              }}
            >
              <div className="budget-group-header">
                <button className="budget-group-toggle" onClick={() => toggleExpanded(g.id)}>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                  >
                    <path
                      d="M4 2l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {editingId === g.id ? (
                  <input
                    className="budget-group-input"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => renameGroup(g.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameGroup(g.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    className="budget-group-name"
                    onDoubleClick={() => {
                      if (!isProtected) {
                        setEditingId(g.id)
                        setEditName(g.name)
                      }
                    }}
                  >
                    {g.name}
                    <span className="budget-group-count">{g.displayCategories.length}</span>
                  </span>
                )}
                {!isProtected && (
                  <>
                    <button className="budget-group-move" onClick={() => moveGroup(g.id, 'up')} title="Move group up">
                      ▲
                    </button>
                    <button
                      className="budget-group-move"
                      onClick={() => moveGroup(g.id, 'down')}
                      title="Move group down"
                    >
                      ▼
                    </button>
                    <button
                      className="budget-group-rename"
                      onClick={() => {
                        setEditingId(g.id)
                        setEditName(g.name)
                      }}
                      title="Rename group"
                    >
                      ✎
                    </button>
                    <button
                      className="budget-group-remove"
                      onClick={() => removeGroup(g.id)}
                      title="Delete group (categories move to Others)"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>

              {isExpanded && (
                <div className="budget-group-cats">
                  {g.displayCategories.length === 0 ? (
                    <div className="budget-group-cats-empty">{dragCat ? 'Drop here' : 'No categories'}</div>
                  ) : (
                    [...g.displayCategories]
                      .sort((a, b) => a.localeCompare(b))
                      .map(cat => (
                        <div
                          key={cat}
                          className={`budget-group-cat${dragCat?.category === cat ? ' budget-group-cat--dragging' : ''}${mergeMode && mergeSelected.has(cat) ? ' budget-group-cat--merge-selected' : ''}`}
                          draggable={!mergeMode}
                          onDragStart={e => !mergeMode && handleDragStart(e, cat, g.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => mergeMode && toggleMergeSelect(cat)}
                          style={mergeMode ? { cursor: 'pointer' } : undefined}
                        >
                          <span className="budget-group-cat-handle">⠿</span>
                          <span className="budget-group-cat-name">{displayCat(cat, g.name)}</span>
                          {!mergeMode && (
                            <button
                              className="budget-group-cat-delete"
                              onClick={e => {
                                e.stopPropagation()
                                handleDeleteCat(cat)
                              }}
                              title="Delete category"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="budget-group-add-row">
        <input
          className="budget-group-input"
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          placeholder="New group name"
          onKeyDown={e => {
            if (e.key === 'Enter') addGroup()
          }}
        />
        <button className="budget-group-add-btn" onClick={addGroup} disabled={!newGroupName.trim()}>
          Add Group
        </button>
        <button
          className={`budget-group-add-btn${mergeMode ? ' budget-merge-active' : ''}`}
          onClick={() => (mergeMode ? cancelMerge() : setMergeMode(true))}
        >
          {mergeMode ? 'Cancel Merge' : 'Merge Categories'}
        </button>
      </div>

      {mergeMode && (
        <div className="budget-merge-panel">
          <p className="budget-merge-hint">
            Click categories above to select them ({mergeSelected.size} selected). Then choose the target name:
          </p>
          <div className="budget-merge-controls">
            <select
              className="budget-merge-select"
              value={mergeTargetName}
              onChange={e => setMergeTargetName(e.target.value)}
            >
              <option value="">Select target name…</option>
              {[...mergeSelected]
                .sort((a, b) => a.localeCompare(b))
                .map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
            <span className="budget-merge-or">or</span>
            <input
              className="budget-group-input"
              value={mergeSelected.has(mergeTargetName) ? '' : mergeTargetName}
              onChange={e => setMergeTargetName(e.target.value)}
              placeholder="Type new name"
            />
            <button
              className="budget-group-add-btn"
              onClick={handleMerge}
              disabled={mergeSelected.size < 2 || !mergeTargetName.trim()}
            >
              Merge
            </button>
          </div>
        </div>
      )}

      {/* Delete category merge prompt */}
      {deletingCat && (
        <div className="budget-merge-panel">
          <p className="budget-merge-hint">
            <strong>{deletingCat}</strong> has transactions. Choose a category to merge them into:
          </p>
          <div className="budget-merge-controls">
            <select
              className="budget-merge-select"
              value={deleteMergeTarget}
              onChange={e => setDeleteMergeTarget(e.target.value)}
            >
              <option value="">Select target…</option>
              {allExpenseCats
                .filter(c => c !== deletingCat)
                .map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
            <span className="budget-merge-or">or</span>
            <input
              className="budget-group-input"
              value={allExpenseCats.includes(deleteMergeTarget) ? '' : deleteMergeTarget}
              onChange={e => setDeleteMergeTarget(e.target.value)}
              placeholder="Type new name"
            />
            <button className="budget-group-add-btn" onClick={confirmDeleteMerge} disabled={!deleteMergeTarget.trim()}>
              Merge &amp; Delete
            </button>
            <button
              className="budget-group-add-btn"
              onClick={() => {
                setDeletingCat(null)
                setDeleteMergeTarget('')
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CategoryGroupManager
