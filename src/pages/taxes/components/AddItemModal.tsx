import { FC, useState } from 'react'
import type { TaxDocOwner, ChecklistCategory } from '../types'

export interface AddItemModalProps {
  owner: TaxDocOwner
  onAdd: (label: string, category: ChecklistCategory) => void
  onClose: () => void
}

const AddItemModal: FC<AddItemModalProps> = ({ owner: _owner, onAdd, onClose }) => {
  const [label, setLabel] = useState('')
  return (
    <div className="tax-modal-overlay" onClick={onClose}>
      <div className="tax-modal tax-modal--sm" onClick={e => e.stopPropagation()}>
        <h3>Add Checklist Item</h3>
        <input
          className="tax-input"
          placeholder="Item name"
          value={label}
          onChange={e => setLabel(e.target.value)}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter' && label.trim()) {
              onAdd(label.trim(), 'custom')
              onClose()
            }
          }}
        />
        <div className="tax-modal-actions">
          <button className="tax-btn tax-btn--outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="tax-btn tax-btn--primary"
            disabled={!label.trim()}
            onClick={() => {
              onAdd(label.trim(), 'custom')
              onClose()
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddItemModal
