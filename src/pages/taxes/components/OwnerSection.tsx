import { FC } from 'react'
import type { TaxChecklistItem, TaxDocOwner } from '../types'
import type { Account } from '../../data/types'
import OwnerBadge from './OwnerBadge'
import ChecklistRow from './ChecklistRow'

export interface OwnerSectionProps {
  owner: TaxDocOwner
  title: string
  items: TaxChecklistItem[]
  year: number
  onUpload: (itemId: string, files: FileList) => void
  onRemoveFile: (itemId: string, fileId: string) => void
  onRemoveItem: (itemId: string) => void
  onRename: (itemId: string, newLabel: string) => void
  onAddItem: (owner: TaxDocOwner) => void
  onAddPaystub: (owner: TaxDocOwner) => void
  onSuggestAccounts: (owner: TaxDocOwner) => void
  primaryName: string
  partnerName: string
  primaryAvatar?: string
  partnerAvatar?: string
  accounts: Account[]
  hasSuggestions: boolean
}

const OwnerSection: FC<OwnerSectionProps> = ({
  owner,
  title,
  items,
  year,
  onUpload,
  onRemoveFile,
  onRemoveItem,
  onRename,
  onAddItem,
  onAddPaystub,
  onSuggestAccounts,
  primaryName,
  partnerName,
  primaryAvatar,
  partnerAvatar,
  accounts,
  hasSuggestions,
}) => {
  const done = items.filter(i => i.files.length > 0).length
  const hasPaystub = items.some(i => i.category === 'paystub')
  const showPaystubBtn = owner !== 'joint' && !hasPaystub
  return (
    <div className="tax-section">
      <div className="tax-section-header">
        <OwnerBadge
          owner={owner}
          primaryName={primaryName}
          partnerName={partnerName}
          primaryAvatar={primaryAvatar}
          partnerAvatar={partnerAvatar}
        />
        <h3 className="tax-section-title">{title}</h3>
        <span className="tax-section-count">
          {done}/{items.length}
        </span>
      </div>
      {items.length === 0 && <p className="tax-empty">No items yet</p>}
      {items.map(item => (
        <ChecklistRow
          key={item.id}
          item={item}
          year={year}
          onUpload={onUpload}
          onRemoveFile={onRemoveFile}
          onRemoveItem={onRemoveItem}
          onRename={onRename}
          primaryName={primaryName}
          partnerName={partnerName}
          primaryAvatar={primaryAvatar}
          partnerAvatar={partnerAvatar}
          accounts={accounts}
        />
      ))}
      <div className="tax-section-actions">
        <button className="tax-btn tax-btn--outline" onClick={() => onAddItem(owner)}>
          + Add Item
        </button>
        {showPaystubBtn && (
          <button className="tax-btn tax-btn--outline" onClick={() => onAddPaystub(owner)}>
            + Add Paystub
          </button>
        )}
        {hasSuggestions && (
          <button className="tax-btn tax-btn--outline" onClick={() => onSuggestAccounts(owner)}>
            + From Accounts
          </button>
        )}
      </div>
    </div>
  )
}

export default OwnerSection
