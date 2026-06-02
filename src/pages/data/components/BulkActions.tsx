import { FC, useState, useRef } from 'react'
import {
  Account,
  AccountType,
  AccountOwner,
  AccountGoalType,
  AccountStatus,
  AccountNature,
  AssetAllocation,
  ACCOUNT_TYPE_LABELS,
  GOAL_TYPE_LABELS,
  NATURE_LABELS,
  ALLOCATION_LABELS,
  getDefaultType,
} from '../types'

interface BulkActionsProps {
  selectedCount: number
  ownerLabels: Record<string, string>
  hasPartner: boolean
  existingGroups: string[]
  onBulkUpdate: (updates: Partial<Account>) => void
  onClearSelection: () => void
}

const BulkActions: FC<BulkActionsProps> = ({
  selectedCount,
  ownerLabels,
  hasPartner,
  existingGroups,
  onBulkUpdate,
  onClearSelection,
}) => {
  const [newGroupName, setNewGroupName] = useState<string | null>(null)
  const newGroupInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="data-bulk-bar">
      <span className="data-bulk-count">{selectedCount} selected</span>
      <select
        defaultValue=""
        onChange={e => {
          if (e.target.value) {
            const g = e.target.value as AccountGoalType
            onBulkUpdate({ goalType: g, type: getDefaultType(g) })
            e.target.value = ''
          }
        }}
      >
        <option value="" disabled>
          Goal…
        </option>
        {Object.entries(GOAL_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <select
        defaultValue=""
        onChange={e => {
          if (e.target.value) {
            onBulkUpdate({ type: e.target.value as AccountType })
            e.target.value = ''
          }
        }}
      >
        <option value="" disabled>
          Type…
        </option>
        {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <select
        defaultValue=""
        onChange={e => {
          if (e.target.value) {
            onBulkUpdate({ owner: e.target.value as AccountOwner })
            e.target.value = ''
          }
        }}
      >
        <option value="" disabled>
          Owner…
        </option>
        <option value="primary">{ownerLabels.primary}</option>
        {hasPartner && <option value="partner">{ownerLabels.partner}</option>}
        <option value="joint">{ownerLabels.joint}</option>
      </select>
      <select
        defaultValue=""
        onChange={e => {
          if (e.target.value) {
            onBulkUpdate({ status: e.target.value as AccountStatus })
            e.target.value = ''
          }
        }}
      >
        <option value="" disabled>
          Status…
        </option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select
        defaultValue=""
        onChange={e => {
          if (e.target.value) {
            onBulkUpdate({ nature: e.target.value as AccountNature })
            e.target.value = ''
          }
        }}
      >
        <option value="" disabled>
          A/L…
        </option>
        {Object.entries(NATURE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <select
        defaultValue=""
        onChange={e => {
          if (e.target.value) {
            onBulkUpdate({ allocation: e.target.value as AssetAllocation })
            e.target.value = ''
          }
        }}
      >
        <option value="" disabled>
          Allocation…
        </option>
        {Object.entries(ALLOCATION_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <select
        defaultValue=""
        onChange={e => {
          const v = e.target.value
          if (!v) return
          if (v === '__new__') {
            setNewGroupName('')
            setTimeout(() => newGroupInputRef.current?.focus(), 0)
          } else if (v === '__none__') {
            onBulkUpdate({ group: undefined })
          } else {
            onBulkUpdate({ group: v })
          }
          e.target.value = ''
        }}
      >
        <option value="" disabled>
          Group…
        </option>
        <option value="__none__">No group</option>
        {existingGroups.map(g => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
        <option value="__new__">New group…</option>
      </select>
      {newGroupName !== null && (
        <div className="data-bulk-new-group">
          <input
            ref={newGroupInputRef}
            type="text"
            className="data-bulk-group-input"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newGroupName.trim()) {
                onBulkUpdate({ group: newGroupName.trim() })
                setNewGroupName(null)
              }
              if (e.key === 'Escape') setNewGroupName(null)
            }}
            placeholder="Group name"
          />
          <button
            className="data-bulk-group-ok"
            onClick={() => {
              if (newGroupName.trim()) {
                onBulkUpdate({ group: newGroupName.trim() })
                setNewGroupName(null)
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 10l4 4 8-8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button className="data-bulk-group-cancel" onClick={() => setNewGroupName(null)}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
      <button className="data-bulk-clear" onClick={() => onClearSelection()}>
        Clear
      </button>
    </div>
  )
}

export default BulkActions
