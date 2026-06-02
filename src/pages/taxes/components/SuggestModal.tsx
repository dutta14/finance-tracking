import { FC, useState } from 'react'
import type { TaxDocOwner } from '../types'
import type { Account } from '../../data/types'

export interface SuggestModalProps {
  accounts: Account[]
  alreadyLinked: Set<number>
  owner: TaxDocOwner
  onAdd: (accountIds: number[], label: string) => void
  onClose: () => void
}

const SuggestModal: FC<SuggestModalProps> = ({ accounts, alreadyLinked, owner, onAdd, onClose }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const ownerFilter = owner === 'joint' ? 'joint' : owner
  const suggestions = accounts.filter(a => a.owner === ownerFilter && !alreadyLinked.has(a.id))

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleAdd = () => {
    if (selected.size === 0) return
    const ids = [...selected]
    const names = ids.map(id => accounts.find(a => a.id === id)?.name).filter(Boolean)
    const label = names.join(' / ')
    onAdd(ids, label)
    onClose()
  }

  return (
    <div className="tax-modal-overlay" onClick={onClose}>
      <div className="tax-modal" onClick={e => e.stopPropagation()}>
        <h3>Add from Accounts</h3>
        <p className="tax-modal-hint">
          Select accounts to create checklist items for. You can select multiple for a consolidated document.
        </p>
        {suggestions.length === 0 && <p className="tax-empty">All accounts already have items</p>}
        <div className="tax-suggest-list">
          {suggestions.map(a => (
            <label key={a.id} className={`tax-suggest-row${selected.has(a.id) ? ' selected' : ''}`}>
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
              <span className="tax-suggest-name">{a.name}</span>
              {a.status !== 'active' && <span className="tax-suggest-badge">inactive</span>}
              {a.institution && <span className="tax-suggest-inst">{a.institution}</span>}
            </label>
          ))}
        </div>
        <div className="tax-modal-actions">
          <button className="tax-btn tax-btn--outline" onClick={onClose}>
            Cancel
          </button>
          <button className="tax-btn tax-btn--primary" onClick={handleAdd} disabled={selected.size === 0}>
            Add {selected.size > 1 ? `(${selected.size} accounts)` : selected.size === 1 ? '1 account' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SuggestModal
