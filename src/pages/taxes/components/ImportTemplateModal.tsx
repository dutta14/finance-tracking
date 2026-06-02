import { FC } from 'react'
import type { TaxTemplate } from '../types'

export interface ImportTemplateModalProps {
  templates: TaxTemplate[]
  onImport: (template: TaxTemplate) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const ImportTemplateModal: FC<ImportTemplateModalProps> = ({ templates, onImport, onDelete, onClose }) => {
  return (
    <div className="tax-modal-overlay" onClick={onClose}>
      <div className="tax-modal" onClick={e => e.stopPropagation()}>
        <h3>Import from Template</h3>
        <p className="tax-modal-hint">Choose a template to create a checklist from.</p>
        {templates.length === 0 ? (
          <p className="tax-empty">No templates saved yet.</p>
        ) : (
          <div className="tax-tpl-list">
            {templates.map(t => (
              <div key={t.id} className="tax-tpl-row">
                <div className="tax-tpl-info">
                  <span className="tax-tpl-name">{t.name}</span>
                  <span className="tax-tpl-count">{t.items.length} items</span>
                </div>
                <div className="tax-tpl-actions">
                  <button className="tax-btn tax-btn--primary tax-btn--sm" onClick={() => onImport(t)}>
                    Use
                  </button>
                  <button
                    className="tax-btn tax-btn--sm tax-btn--muted"
                    onClick={() => onDelete(t.id)}
                    title="Delete template"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="tax-modal-actions">
          <button className="tax-btn tax-btn--outline" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImportTemplateModal
