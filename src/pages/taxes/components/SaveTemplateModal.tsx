import { FC, useState } from 'react'
import type { TaxTemplate } from '../types'

export interface SaveTemplateModalProps {
  templates: TaxTemplate[]
  onSaveNew: (name: string) => void
  onUpdate: (id: string) => void
  onClose: () => void
}

const SaveTemplateModal: FC<SaveTemplateModalProps> = ({ templates, onSaveNew, onUpdate, onClose }) => {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'new' | 'update'>(templates.length > 0 ? 'update' : 'new')
  const [selectedId, setSelectedId] = useState(templates[0]?.id || '')

  return (
    <div className="tax-modal-overlay" onClick={onClose}>
      <div className="tax-modal tax-modal--sm" onClick={e => e.stopPropagation()}>
        <h3>Save as Template</h3>
        <p className="tax-modal-hint">
          Save the current checklist structure (without documents) as a reusable template.
        </p>
        {templates.length > 0 && (
          <div className="tax-tpl-mode">
            <label className={`tax-tpl-mode-opt${mode === 'update' ? ' active' : ''}`}>
              <input type="radio" name="tpl-mode" checked={mode === 'update'} onChange={() => setMode('update')} />{' '}
              Update existing
            </label>
            <label className={`tax-tpl-mode-opt${mode === 'new' ? ' active' : ''}`}>
              <input type="radio" name="tpl-mode" checked={mode === 'new'} onChange={() => setMode('new')} /> Create new
            </label>
          </div>
        )}
        {mode === 'update' && templates.length > 0 ? (
          <select className="tax-input" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.items.length} items)
              </option>
            ))}
          </select>
        ) : (
          <input
            className="tax-input"
            placeholder="Template name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && name.trim()) onSaveNew(name.trim())
            }}
          />
        )}
        <div className="tax-modal-actions">
          <button className="tax-btn tax-btn--outline" onClick={onClose}>
            Cancel
          </button>
          {mode === 'update' && templates.length > 0 ? (
            <button className="tax-btn tax-btn--primary" disabled={!selectedId} onClick={() => onUpdate(selectedId)}>
              Update Template
            </button>
          ) : (
            <button className="tax-btn tax-btn--primary" disabled={!name.trim()} onClick={() => onSaveNew(name.trim())}>
              Save New
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SaveTemplateModal
