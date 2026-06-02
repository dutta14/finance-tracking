import { FC, useState, useRef } from 'react'
import type { TaxChecklistItem, TaxDocOwner } from '../types'
import OwnerBadge from './OwnerBadge'

export interface TaxReturnSectionProps {
  items: TaxChecklistItem[]
  year: number
  onUpload: (itemId: string, files: FileList) => void
  onRemoveFile: (itemId: string, fileId: string) => void
  onAddReturnEntry: (owner: TaxDocOwner) => void
  primaryName: string
  partnerName: string
  primaryAvatar?: string
  partnerAvatar?: string
  hasPartner: boolean
}

const TaxReturnSection: FC<TaxReturnSectionProps> = ({
  items,
  year: _year,
  onUpload,
  onRemoveFile,
  onAddReturnEntry,
  primaryName,
  partnerName,
  primaryAvatar,
  partnerAvatar,
  hasPartner,
}) => {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [menuOpen, setMenuOpen] = useState(false)

  const jointReturn = items.find(i => i.owner === 'joint' && i.category === 'tax-return')
  const primaryReturn = items.find(i => i.owner === 'primary' && i.category === 'tax-return')
  const partnerReturn = items.find(i => i.owner === 'partner' && i.category === 'tax-return')

  const hasSingleReturns = !!primaryReturn || !!partnerReturn

  return (
    <div className="tax-section tax-section--return">
      <div className="tax-section-header">
        <svg
          className="tax-section-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <h3 className="tax-section-title">Tax Returns</h3>
        <div className="tax-return-menu-wrap">
          <button className="tax-btn tax-btn--sm tax-btn--outline" onClick={() => setMenuOpen(!menuOpen)}>
            ⋯
          </button>
          {menuOpen && (
            <div className="tax-return-menu" onClick={() => setMenuOpen(false)}>
              {!hasSingleReturns && !jointReturn && (
                <button onClick={() => onAddReturnEntry('joint')}>Upload Joint Return</button>
              )}
              {!primaryReturn && (
                <button onClick={() => onAddReturnEntry('primary')}>Upload {primaryName}'s Return (Single)</button>
              )}
              {hasPartner && !partnerReturn && (
                <button onClick={() => onAddReturnEntry('partner')}>Upload {partnerName}'s Return (Single)</button>
              )}
            </div>
          )}
        </div>
      </div>

      {!jointReturn && !hasSingleReturns && <p className="tax-empty">No return uploaded yet. Use the menu to add.</p>}

      {[jointReturn, primaryReturn, partnerReturn].filter(Boolean).map(item => (
        <div
          key={item!.id}
          className={`tax-item${item!.files.length > 0 ? ' tax-item--done' : ''}`}
          data-done={item!.files.length > 0 ? 'true' : 'false'}
        >
          <div
            className="tax-item-check"
            role="img"
            aria-label={`${item!.label}${item!.files.length > 0 ? ' (complete)' : ' (not started)'}`}
          >
            {item!.files.length > 0 ? <span className="tax-item-tick">✓</span> : <span className="tax-item-empty" />}
          </div>
          <div className="tax-item-body">
            <div className="tax-item-label">
              <OwnerBadge
                owner={item!.owner}
                primaryName={primaryName}
                partnerName={partnerName}
                primaryAvatar={primaryAvatar}
                partnerAvatar={partnerAvatar}
              />
              <span className="tax-item-label-text">{item!.label}</span>
            </div>
            {item!.files.length > 0 && (
              <div className="tax-item-files">
                {item!.files.map(f => (
                  <span key={f.id} className="tax-file-chip">
                    <span className="tax-file-name">{f.name}</span>
                    <button className="tax-file-remove" onClick={() => onRemoveFile(item!.id, f.id)} title="Remove">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="tax-item-actions">
            <button className="tax-btn tax-btn--sm" onClick={() => inputRefs.current[item!.id]?.click()}>
              {item!.files.length > 0 ? 'Replace' : 'Upload'}
            </button>
            <input
              ref={el => {
                inputRefs.current[item!.id] = el
              }}
              type="file"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files?.length) {
                  onUpload(item!.id, e.target.files)
                  e.target.value = ''
                }
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default TaxReturnSection
