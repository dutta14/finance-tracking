import { FC, useEffect, useMemo, useState } from 'react'
import { CategoryGroup, Transaction } from '../types'

type GroupSection = 'expense' | 'income'

interface CategoryGroupManagerProps {
  groups: CategoryGroup[]
  onUpdate: (groups: CategoryGroup[]) => void
  incomeCategoryGroups?: CategoryGroup[]
  onUpdateIncomeGroups?: (groups: CategoryGroup[]) => void
  onMerge: (sourceCategories: string[], targetName: string) => void
  onDeleteCategory: (category: string) => void
  categoryHasTransactions: (category: string) => boolean
  categorySums: Record<string, Record<string, number>>
  yearTransactions?: Record<string, Transaction[]>
}

const OTHERS_GROUP_ID = 'others'
const REMOVED_GROUP_ID = 'removed'
const INCOME_OTHERS_GROUP_ID = 'income-others'

const CategoryGroupManager: FC<CategoryGroupManagerProps> = ({
  groups,
  onUpdate,
  incomeCategoryGroups,
  onUpdateIncomeGroups,
  onMerge,
  onDeleteCategory,
  categoryHasTransactions,
  categorySums,
  yearTransactions,
}) => {
  const displayCat = (cat: string, groupName: string): string => {
    const prefix = groupName + ':'
    if (cat.toLowerCase().startsWith(prefix.toLowerCase())) {
      return cat.slice(prefix.length).trim()
    }
    return cat
  }

  const resolvedIncomeGroups = useMemo(() => incomeCategoryGroups || [], [incomeCategoryGroups])
  const expenseDisplayGroups = useMemo(
    () =>
      groups.map(g => ({
        ...g,
        displayCategories: g.categories,
      })),
    [groups],
  )
  const incomeDisplayGroups = useMemo(
    () =>
      resolvedIncomeGroups.map(g => ({
        ...g,
        displayCategories: g.categories,
      })),
    [resolvedIncomeGroups],
  )
  const showIncomeSection = incomeCategoryGroups !== undefined || onUpdateIncomeGroups !== undefined

  const [editing, setEditing] = useState<{ section: GroupSection; id: string } | null>(null)
  const [editName, setEditName] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [dragCat, setDragCat] = useState<{ section: GroupSection; category: string; fromGroupId: string } | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<{ section: GroupSection; groupId: string } | null>(null)
  const [dragGroup, setDragGroup] = useState<{ section: GroupSection; groupId: string } | null>(null)
  const [dragOverGroupReorder, setDragOverGroupReorder] = useState<{ section: GroupSection; groupId: string } | null>(
    null,
  )
  const [mergeModeSection, setMergeModeSection] = useState<GroupSection | null>(null)
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set())
  const [mergeTargetName, setMergeTargetName] = useState('')
  const [deletingCat, setDeletingCat] = useState<{ section: GroupSection; category: string } | null>(null)
  const [deleteMergeTarget, setDeleteMergeTarget] = useState('')

  useEffect(() => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      groups.forEach(group => next.add(group.id))
      resolvedIncomeGroups.forEach(group => next.add(group.id))
      return next
    })
  }, [groups, resolvedIncomeGroups])

  const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  const txnCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!yearTransactions) return counts
    Object.values(yearTransactions).forEach(txs =>
      txs.forEach(t => {
        counts[t.category] = (counts[t.category] || 0) + 1
      }),
    )
    return counts
  }, [yearTransactions])

  const getCatStats = (cat: string) => {
    const months = categorySums[cat] || {}
    const total = Object.values(months).reduce((sum, value) => sum + value, 0)
    const txnCount = txnCountByCategory[cat] || 0
    return { txnCount, total }
  }

  const getGroupsForSection = (section: GroupSection) => (section === 'expense' ? groups : resolvedIncomeGroups)
  const getDisplayGroupsForSection = (section: GroupSection) =>
    section === 'expense' ? expenseDisplayGroups : incomeDisplayGroups
  const getFallbackGroupId = (section: GroupSection) =>
    section === 'expense' ? OTHERS_GROUP_ID : INCOME_OTHERS_GROUP_ID
  const isProtectedGroup = (section: GroupSection, id: string) =>
    id === getFallbackGroupId(section) || id === REMOVED_GROUP_ID
  const updateSectionGroups = (section: GroupSection, nextGroups: CategoryGroup[]) => {
    if (section === 'expense') {
      onUpdate(nextGroups)
      return
    }
    onUpdateIncomeGroups?.(nextGroups)
  }
  const getSectionCategories = (section: GroupSection) =>
    getDisplayGroupsForSection(section)
      .flatMap(group => group.displayCategories)
      .sort((a, b) => a.localeCompare(b))

  const toggleExpanded = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleMergeSelect = (cat: string) => {
    setMergeSelected(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const cancelMerge = () => {
    setMergeModeSection(null)
    setMergeSelected(new Set())
    setMergeTargetName('')
  }

  const handleMerge = () => {
    const target = mergeTargetName.trim()
    if (!target || mergeSelected.size < 2) return
    onMerge([...mergeSelected], target)
    cancelMerge()
  }

  const handleDeleteCat = (section: GroupSection, cat: string) => {
    if (categoryHasTransactions(cat)) {
      setDeletingCat({ section, category: cat })
      setDeleteMergeTarget('')
      return
    }
    onDeleteCategory(cat)
  }

  const confirmDeleteMerge = () => {
    if (!deletingCat || !deleteMergeTarget.trim()) return
    onMerge([deletingCat.category], deleteMergeTarget.trim())
    setDeletingCat(null)
    setDeleteMergeTarget('')
  }

  const addGroup = (section: GroupSection) => {
    const sectionGroups = getGroupsForSection(section)
    const id = `${section}-group-${Date.now()}`
    const name = 'New Group'
    const removedIdx = sectionGroups.findIndex(g => g.id === REMOVED_GROUP_ID)
    const insertAt = removedIdx >= 0 ? removedIdx : sectionGroups.length
    const newGroups = [
      ...sectionGroups.slice(0, insertAt),
      { id, name, categories: [] },
      ...sectionGroups.slice(insertAt),
    ]
    updateSectionGroups(section, newGroups)
    setExpandedGroups(prev => new Set([...prev, id]))
    setEditing({ section, id })
    setEditName(name)
  }

  const renameGroup = (section: GroupSection, id: string) => {
    const name = editName.trim()
    if (!name || isProtectedGroup(section, id)) return
    updateSectionGroups(
      section,
      getGroupsForSection(section).map(g => (g.id === id ? { ...g, name } : g)),
    )
    setEditing(null)
  }

  const removeGroup = (section: GroupSection, id: string) => {
    if (isProtectedGroup(section, id)) return

    const sectionGroups = getGroupsForSection(section)
    const group = sectionGroups.find(g => g.id === id)
    if (!group) return

    const fallbackGroupId = getFallbackGroupId(section)
    const fallbackName = 'Others'
    const filteredGroups = sectionGroups.filter(g => g.id !== id)
    const fallbackGroup = filteredGroups.find(g => g.id === fallbackGroupId)

    if (fallbackGroup) {
      updateSectionGroups(
        section,
        filteredGroups.map(g =>
          g.id === fallbackGroupId ? { ...g, categories: [...g.categories, ...group.categories] } : g,
        ),
      )
      return
    }

    updateSectionGroups(section, [
      ...filteredGroups,
      { id: fallbackGroupId, name: fallbackName, categories: group.categories },
    ])
  }

  const handleDragStart = (e: React.DragEvent, section: GroupSection, category: string, fromGroupId: string) => {
    e.dataTransfer.setData('text/plain', category)
    e.dataTransfer.effectAllowed = 'move'
    setDragCat({ section, category, fromGroupId })
  }

  const handleDragOver = (e: React.DragEvent, section: GroupSection, groupId: string) => {
    if (!dragCat) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverGroup({ section, groupId })
  }

  const handleDrop = (e: React.DragEvent, section: GroupSection, toGroupId: string) => {
    e.preventDefault()
    setDragOverGroup(null)
    if (!dragCat || (dragCat.section === section && dragCat.fromGroupId === toGroupId)) {
      setDragCat(null)
      return
    }

    // Remove the category from ALL groups in BOTH sections, then add to target
    const removeFromAll = (groups: CategoryGroup[]) =>
      groups.map(group => ({
        ...group,
        categories: group.categories.filter(c => c !== dragCat.category),
      }))

    const expenseGroups = removeFromAll(getGroupsForSection('expense'))
    const incomeGroups = removeFromAll(getGroupsForSection('income'))

    // Add to the target group in the correct section
    if (section === 'expense') {
      updateSectionGroups(
        'expense',
        expenseGroups.map(g => (g.id === toGroupId ? { ...g, categories: [...g.categories, dragCat.category] } : g)),
      )
      updateSectionGroups('income', incomeGroups)
    } else {
      updateSectionGroups('expense', expenseGroups)
      updateSectionGroups(
        'income',
        incomeGroups.map(g => (g.id === toGroupId ? { ...g, categories: [...g.categories, dragCat.category] } : g)),
      )
    }
    setDragCat(null)
  }

  const handleDragEnd = () => {
    setDragCat(null)
    setDragOverGroup(null)
  }

  const handleGroupDragStart = (e: React.DragEvent, section: GroupSection, groupId: string) => {
    e.dataTransfer.setData('text/plain', `group:${groupId}`)
    e.dataTransfer.effectAllowed = 'move'
    setDragGroup({ section, groupId })
  }

  const handleGroupDragOver = (e: React.DragEvent, section: GroupSection, groupId: string) => {
    if (!dragGroup || dragGroup.section !== section || dragGroup.groupId === groupId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverGroupReorder({ section, groupId })
  }

  const handleGroupDrop = (e: React.DragEvent, section: GroupSection, targetId: string) => {
    e.preventDefault()
    setDragOverGroupReorder(null)
    if (!dragGroup || dragGroup.section !== section || dragGroup.groupId === targetId) {
      setDragGroup(null)
      return
    }

    const sectionGroups = getGroupsForSection(section)
    const fromIdx = sectionGroups.findIndex(group => group.id === dragGroup.groupId)
    const toIdx = sectionGroups.findIndex(group => group.id === targetId)
    if (fromIdx === -1 || toIdx === -1 || sectionGroups[toIdx].id === REMOVED_GROUP_ID) {
      setDragGroup(null)
      return
    }

    const newGroups = [...sectionGroups]
    const [moved] = newGroups.splice(fromIdx, 1)
    newGroups.splice(toIdx, 0, moved)
    updateSectionGroups(section, newGroups)
    setDragGroup(null)
  }

  const handleGroupDragEnd = () => {
    setDragGroup(null)
    setDragOverGroupReorder(null)
  }

  const renderSection = (section: GroupSection, title: string) => {
    const displayGroups = getDisplayGroupsForSection(section)
    const allSectionCats = getSectionCategories(section)

    return (
      <section key={section} className="budget-group-manager-section">
        <div className="budget-group-manager-header">
          <div className="budget-group-manager-header-left">
            <h4 className="budget-group-manager-title">{title}</h4>
            <p className="budget-group-manager-hint">
              Drag categories between groups or drag group headers to reorder.
            </p>
          </div>
          <div className="budget-group-manager-header-actions">
            <button className="budget-action-btn" onClick={() => addGroup(section)}>
              + New Group
            </button>
            <button
              className={`budget-action-btn${mergeModeSection === section ? ' budget-merge-active' : ''}`}
              onClick={() => {
                if (mergeModeSection === section) {
                  cancelMerge()
                  return
                }
                setMergeModeSection(section)
                setMergeSelected(new Set())
                setMergeTargetName('')
              }}
            >
              {mergeModeSection === section ? 'Cancel Merge' : 'Merge Categories'}
            </button>
          </div>
        </div>

        {mergeModeSection === section && (
          <div className="budget-merge-panel">
            <h4 className="budget-merge-title">Merge Categories</h4>
            <p className="budget-merge-step">
              1. Click categories below to select them
              <span className="budget-merge-count">{mergeSelected.size} selected</span>
            </p>
            <p className="budget-merge-step">2. Choose the merged name:</p>
            <div className="budget-merge-controls">
              <select
                className="budget-merge-select"
                value={mergeTargetName}
                onChange={e => setMergeTargetName(e.target.value)}
              >
                <option value="">Select target name…</option>
                {[...mergeSelected]
                  .sort((a, b) => a.localeCompare(b))
                  .map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
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
                className="budget-action-btn"
                onClick={handleMerge}
                disabled={mergeSelected.size < 2 || !mergeTargetName.trim()}
              >
                Merge
              </button>
              <button className="budget-action-btn" onClick={cancelMerge}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="budget-group-list">
          {displayGroups.map(group => {
            const isExpanded = expandedGroups.has(group.id)
            const isDropTarget =
              dragOverGroup?.section === section &&
              dragOverGroup.groupId === group.id &&
              dragCat?.fromGroupId !== group.id
            const isRemoved = group.id === REMOVED_GROUP_ID
            const isProtected = isProtectedGroup(section, group.id)
            const isEditing = editing?.section === section && editing.id === group.id

            return (
              <div
                key={group.id}
                className={`budget-group-block${isDropTarget ? ' budget-group-block--drop-target' : ''}${isRemoved ? ' budget-group-block--removed' : ''}${dragOverGroupReorder?.section === section && dragOverGroupReorder.groupId === group.id ? ' budget-group-block--reorder-target' : ''}${dragGroup?.section === section && dragGroup.groupId === group.id ? ' budget-group-block--dragging' : ''}`}
                onDragOver={e => {
                  if (dragGroup) handleGroupDragOver(e, section, group.id)
                  else handleDragOver(e, section, group.id)
                }}
                onDrop={e => {
                  if (dragGroup) handleGroupDrop(e, section, group.id)
                  else handleDrop(e, section, group.id)
                }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverGroup(null)
                    setDragOverGroupReorder(null)
                  }
                }}
              >
                <div
                  className="budget-group-header"
                  draggable={!isProtected && !editing}
                  onDragStart={e => !isProtected && handleGroupDragStart(e, section, group.id)}
                  onDragEnd={handleGroupDragEnd}
                >
                  <button className="budget-group-toggle" onClick={() => toggleExpanded(group.id)}>
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
                  {isEditing ? (
                    <input
                      className="budget-group-input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => renameGroup(section, group.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameGroup(section, group.id)
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="budget-group-name"
                      onDoubleClick={() => {
                        if (!isProtected) {
                          setEditing({ section, id: group.id })
                          setEditName(group.name)
                        }
                      }}
                    >
                      {group.name}
                      <span className="budget-group-count">
                        {group.displayCategories.length}{' '}
                        {group.displayCategories.length === 1 ? 'category' : 'categories'}
                      </span>
                    </span>
                  )}
                  {!isProtected && (
                    <div className="budget-group-header-actions">
                      <button
                        className="budget-group-rename"
                        onClick={() => {
                          setEditing({ section, id: group.id })
                          setEditName(group.name)
                        }}
                        title="Rename group"
                      >
                        ✎
                      </button>
                      <button
                        className="budget-group-remove"
                        onClick={() => removeGroup(section, group.id)}
                        title="Delete group (categories move to Others)"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="budget-group-cats">
                    {group.displayCategories.length === 0 ? (
                      <div className="budget-group-cats-empty">
                        {dragCat?.section === section
                          ? 'Drop here'
                          : 'No categories yet - drag categories here from other groups'}
                      </div>
                    ) : (
                      [...group.displayCategories]
                        .sort((a, b) => a.localeCompare(b))
                        .map(cat => {
                          const { txnCount, total } = getCatStats(cat)
                          const tooltip =
                            txnCount > 0
                              ? `${currencyFmt.format(Math.abs(total))} · ${txnCount} transaction${txnCount === 1 ? '' : 's'}`
                              : undefined

                          return (
                            <div
                              key={cat}
                              className={`budget-group-cat${dragCat?.category === cat ? ' budget-group-cat--dragging' : ''}${mergeModeSection === section && mergeSelected.has(cat) ? ' budget-group-cat--merge-selected' : ''}${mergeModeSection === section ? ' budget-group-cat--clickable' : ''}`}
                              draggable={mergeModeSection !== section}
                              onDragStart={e =>
                                mergeModeSection !== section && handleDragStart(e, section, cat, group.id)
                              }
                              onDragEnd={handleDragEnd}
                              onClick={() => mergeModeSection === section && toggleMergeSelect(cat)}
                              title={tooltip}
                            >
                              <span className="budget-group-cat-handle">⠿</span>
                              <span className="budget-group-cat-name">{displayCat(cat, group.name)}</span>
                              {txnCount > 0 && <span className="budget-group-cat-months">{txnCount}</span>}
                              {mergeModeSection !== section && (
                                <button
                                  className="budget-group-cat-delete"
                                  onClick={e => {
                                    e.stopPropagation()
                                    handleDeleteCat(section, cat)
                                  }}
                                  title="Delete category"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          )
                        })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {deletingCat?.section === section && (
          <div className="budget-merge-panel">
            <p className="budget-merge-hint">
              <strong>{deletingCat.category}</strong> has transactions. Choose a category to merge them into:
            </p>
            <div className="budget-merge-controls">
              <select
                className="budget-merge-select"
                value={deleteMergeTarget}
                onChange={e => setDeleteMergeTarget(e.target.value)}
              >
                <option value="">Select target…</option>
                {allSectionCats
                  .filter(cat => cat !== deletingCat.category)
                  .map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
              <span className="budget-merge-or">or</span>
              <input
                className="budget-group-input"
                value={allSectionCats.includes(deleteMergeTarget) ? '' : deleteMergeTarget}
                onChange={e => setDeleteMergeTarget(e.target.value)}
                placeholder="Type new name"
              />
              <button className="budget-action-btn" onClick={confirmDeleteMerge} disabled={!deleteMergeTarget.trim()}>
                Merge &amp; Delete
              </button>
              <button
                className="budget-action-btn"
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
      </section>
    )
  }

  return (
    <div className="budget-group-manager">
      {renderSection('expense', 'Expense Category Groups')}
      {showIncomeSection && renderSection('income', 'Income Category Groups')}
    </div>
  )
}

export default CategoryGroupManager
