import { FC } from 'react'
import {
  Account,
  ACCOUNT_TYPE_LABELS,
  GOAL_TYPE_LABELS,
  NATURE_LABELS,
  ALLOCATION_LABELS,
  getDefaultAllocation,
} from '../types'

interface AccountRowProps {
  account: Account
  accounts: Account[]
  ownerLabels: Record<string, string>
  isSelected: boolean
  showMultiSelect: boolean
  onToggleSelect: (id: number) => void
  onRowClick: (id: number, e: React.MouseEvent) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
}

const AccountRow: FC<AccountRowProps> = ({
  account,
  accounts,
  ownerLabels,
  isSelected,
  showMultiSelect,
  onToggleSelect,
  onRowClick,
  onEdit,
  onDelete,
}) => {
  return (
    <tr
      className={`${account.status === 'inactive' ? 'data-row--inactive' : ''}${isSelected ? ' data-row--selected' : ''}`}
      onClick={e => onRowClick(account.id, e)}
    >
      {showMultiSelect && (
        <td className="data-td-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(account.id)}
          />
        </td>
      )}
      <td>
        <div className="data-account-name">
          <span>{account.name}</span>
          {account.institution && (
            <span className="data-account-institution">{account.institution}</span>
          )}
          {account.group && <span className="data-account-parent">↳ {account.group}</span>}
          {account.linkedAccountId != null &&
            (() => {
              const linked = accounts.find(a => a.id === account.linkedAccountId)
              return linked ? <span className="data-account-linked">⛓ {linked.name}</span> : null
            })()}
        </div>
      </td>
      <td>
        <span className={`data-badge data-badge--goal-${account.goalType}`}>
          {GOAL_TYPE_LABELS[account.goalType]}
        </span>
      </td>
      <td>
        <span className="data-badge data-badge--type">{ACCOUNT_TYPE_LABELS[account.type]}</span>
      </td>
      <td>
        <span className={`data-badge data-badge--nature-${account.nature || 'asset'}`}>
          {NATURE_LABELS[account.nature || 'asset']}
        </span>
      </td>
      <td>
        <span className="data-badge data-badge--allocation">
          {
            ALLOCATION_LABELS[
              account.allocation || getDefaultAllocation(account.nature || 'asset')
            ]
          }
        </span>
      </td>
      <td>
        <span className={`data-badge data-badge--owner-${account.owner}`}>
          {ownerLabels[account.owner]}
        </span>
      </td>
      <td>
        <span className={`data-badge data-badge--status-${account.status}`}>
          {account.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <div className="data-row-actions">
          <button
            className="data-action-btn"
            onClick={() => onEdit(account.id)}
            title="Edit"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 17h14M10 3l4 4-7 7H3v-4l7-7z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="data-action-btn data-action-btn--delete"
            onClick={() => onDelete(account.id)}
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 6h12M8 6V4h4v2m-6 0v10h8V6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

export default AccountRow
