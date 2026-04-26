import { FC, useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useProfile } from '../../hooks/useProfile'
import { useData } from '../../contexts/DataContext'
import { useTaxStore } from './useTaxStore'
import type { TaxChecklistItem, TaxDocFile, TaxDocOwner, ChecklistCategory, TaxTemplate } from './types'
import type { Account } from '../data/types'
import { getStorageEstimate } from '../../utils/taxFileDB'
import '../../styles/Taxes.css'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function nextFileId(): string {
  return `f${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const CURRENT_YEAR = new Date().getFullYear()
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/* ── owner badge ──────────────────────────────────────────── */
const OwnerBadge: FC<{
  owner: TaxDocOwner
  primaryName: string
  partnerName: string
  primaryAvatar?: string
  partnerAvatar?: string
}> = ({ owner, primaryName, partnerName, primaryAvatar, partnerAvatar }) => {
  const pi = (primaryName || 'P')[0].toUpperCase()
  const si = (partnerName || 'S')[0].toUpperCase()
  if (owner === 'joint') {
    return (
      <span className="tax-owner-group" title="Joint">
        <span className="tax-owner-avatar tax-owner-primary">
          {primaryAvatar ? <img src={primaryAvatar} alt="" /> : pi}
        </span>
        <span className="tax-owner-avatar tax-owner-partner">
          {partnerAvatar ? <img src={partnerAvatar} alt="" /> : si}
        </span>
      </span>
    )
  }
  const isPartner = owner === 'partner'
  return (
    <span
      className={`tax-owner-avatar ${isPartner ? 'tax-owner-partner' : 'tax-owner-primary'}`}
      title={isPartner ? partnerName : primaryName}
    >
      {isPartner ? (
        partnerAvatar ? (
          <img src={partnerAvatar} alt="" />
        ) : (
          si
        )
      ) : primaryAvatar ? (
        <img src={primaryAvatar} alt="" />
      ) : (
        pi
      )}
    </span>
  )
}

/* ── checklist item row ──────────────────────────────────── */
const ChecklistRow: FC<{
  item: TaxChecklistItem
  year: number
  onUpload: (itemId: string, files: FileList) => void
  onRemoveFile: (itemId: string, fileId: string) => void
  onRemoveItem: (itemId: string) => void
  onRename: (itemId: string, newLabel: string) => void
  primaryName: string
  partnerName: string
  primaryAvatar?: string
  partnerAvatar?: string
  accounts: Account[]
}> = ({
  item,
  year: _year,
  onUpload,
  onRemoveFile,
  onRemoveItem,
  onRename,
  primaryName: _primaryName,
  partnerName: _partnerName,
  primaryAvatar: _primaryAvatar,
  partnerAvatar: _partnerAvatar,
  accounts,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.label)
  const hasFiles = item.files.length > 0
  const linkedAccts =
    item.accountIds.length > 0
      ? item.accountIds
          .map(id => accounts.find(a => a.id === id)?.name)
          .filter(Boolean)
          .join(', ')
      : null

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== item.label) onRename(item.id, trimmed)
    else setDraft(item.label)
    setEditing(false)
  }

  return (
    <div className={`tax-item${hasFiles ? ' tax-item--done' : ''}`}>
      <div className="tax-item-check">
        {hasFiles ? <span className="tax-item-tick">✓</span> : <span className="tax-item-empty" />}
      </div>
      <div className="tax-item-body">
        <div className="tax-item-label">
          {editing ? (
            <input
              className="tax-rename-input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setDraft(item.label)
                  setEditing(false)
                }
              }}
              autoFocus
            />
          ) : (
            <>
              <span
                className="tax-item-label-text"
                onDoubleClick={() => {
                  setDraft(item.label)
                  setEditing(true)
                }}
              >
                {item.label}
              </span>
              <button
                className="tax-rename-btn"
                onClick={() => {
                  setDraft(item.label)
                  setEditing(true)
                }}
                title="Rename"
              >
                ✎
              </button>
            </>
          )}
          {!editing && linkedAccts && <span className="tax-item-acct">{linkedAccts}</span>}
        </div>
        {item.files.length > 0 && (
          <div className="tax-item-files">
            {item.files.map(f => (
              <span key={f.id} className="tax-file-chip">
                <span className="tax-file-name">{f.name}</span>
                <button className="tax-file-remove" onClick={() => onRemoveFile(item.id, f.id)} title="Remove file">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="tax-item-actions">
        <button className="tax-btn tax-btn--sm" onClick={() => inputRef.current?.click()}>
          {hasFiles ? 'Add' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files?.length) {
              onUpload(item.id, e.target.files)
              e.target.value = ''
            }
          }}
        />
        <button
          className="tax-btn tax-btn--sm tax-btn--muted"
          onClick={() => onRemoveItem(item.id)}
          title="Remove item"
        >
          ×
        </button>
      </div>
    </div>
  )
}

/* ── section for an owner ─────────────────────────────────── */
const OwnerSection: FC<{
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
}> = ({
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

/* ── suggest modal ─────────────────────────────────────────── */
const SuggestModal: FC<{
  accounts: Account[]
  alreadyLinked: Set<number>
  owner: TaxDocOwner
  onAdd: (accountIds: number[], label: string) => void
  onClose: () => void
}> = ({ accounts, alreadyLinked, owner, onAdd, onClose }) => {
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

/* ── add custom item modal ─────────────────────────────────── */
const AddItemModal: FC<{
  owner: TaxDocOwner
  onAdd: (label: string, category: ChecklistCategory) => void
  onClose: () => void
}> = ({ owner: _owner, onAdd, onClose }) => {
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

/* ── save template modal ───────────────────────────────────── */
const SaveTemplateModal: FC<{
  templates: TaxTemplate[]
  onSaveNew: (name: string) => void
  onUpdate: (id: string) => void
  onClose: () => void
}> = ({ templates, onSaveNew, onUpdate, onClose }) => {
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

/* ── import template modal ─────────────────────────────────── */
const ImportTemplateModal: FC<{
  templates: TaxTemplate[]
  onImport: (template: TaxTemplate) => void
  onDelete: (id: string) => void
  onClose: () => void
}> = ({ templates, onImport, onDelete, onClose }) => {
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

/* ── tax return section ──────────────────────────────────── */
const TaxReturnSection: FC<{
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
}> = ({
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
        <div key={item!.id} className={`tax-item${item!.files.length > 0 ? ' tax-item--done' : ''}`}>
          <div className="tax-item-check">
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
              <span style={{ marginLeft: '0.5rem' }}>{item!.label}</span>
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

/* ══════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════ */
const Taxes: FC = () => {
  const { profile } = useProfile()
  const tax = useTaxStore()
  const { accounts } = useData()
  const hasPartner = !!profile.partner

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const yearData = tax.getYear(selectedYear)
  const exists = tax.yearExists(selectedYear)

  const primaryName = profile.name || 'Primary'
  const partnerName = profile.partner?.name || 'Partner'
  const primaryAvatar = profile.avatarDataUrl
  const partnerAvatar = profile.partner?.avatarDataUrl

  // Backfill missing default paystub items for existing years
  useEffect(() => {
    if (!exists) return
    const items = yearData.items
    const hasPrimaryPaystub = items.some(i => i.owner === 'primary' && i.category === 'paystub')
    if (!hasPrimaryPaystub) {
      tax.addItem(selectedYear, `${primaryName}'s Paystubs`, 'primary', 'paystub')
    }
    if (hasPartner) {
      const hasPartnerPaystub = items.some(i => i.owner === 'partner' && i.category === 'paystub')
      if (!hasPartnerPaystub) {
        tax.addItem(selectedYear, `${partnerName}'s Paystubs`, 'partner', 'paystub')
      }
    }
  }, [exists, selectedYear]) // eslint-disable-line react-hooks/exhaustive-deps

  // Modal state
  const [suggestModal, setSuggestModal] = useState<TaxDocOwner | null>(null)
  const [addModal, setAddModal] = useState<TaxDocOwner | null>(null)
  const [saveTemplateModal, setSaveTemplateModal] = useState(false)
  const [importTemplateModal, setImportTemplateModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Upload error + storage indicator
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [storageMB, setStorageMB] = useState<number | null>(null)

  // Auto-clear upload error after 5 seconds
  useEffect(() => {
    if (!uploadError) return
    const t = setTimeout(() => setUploadError(null), 5000)
    return () => clearTimeout(t)
  }, [uploadError])

  // Refresh storage estimate on mount
  const refreshStorage = useCallback(() => {
    getStorageEstimate()
      .then(est => setStorageMB(est.usedMB))
      .catch(() => {})
  }, [])
  useEffect(() => {
    refreshStorage()
  }, [refreshStorage])

  // Items by owner
  const primaryItems = yearData.items.filter(i => i.owner === 'primary' && i.category !== 'tax-return')
  const partnerItems = yearData.items.filter(i => i.owner === 'partner' && i.category !== 'tax-return')
  const jointItems = yearData.items.filter(i => i.owner === 'joint' && i.category !== 'tax-return')
  const returnItems = yearData.items.filter(i => i.category === 'tax-return')

  // Already-linked account IDs for this year
  const linkedAccountIds = useMemo(() => {
    const s = new Set<number>()
    for (const item of yearData.items) {
      for (const id of item.accountIds) s.add(id)
    }
    return s
  }, [yearData])

  const createYear = () => {
    const defaults: { label: string; owner: TaxDocOwner; category: ChecklistCategory }[] = [
      { label: `${primaryName}'s Paystubs`, owner: 'primary', category: 'paystub' },
    ]
    if (hasPartner) {
      defaults.push({ label: `${partnerName}'s Paystubs`, owner: 'partner', category: 'paystub' })
    }
    tax.createYearWithDefaults(selectedYear, defaults)
  }

  const handleUpload = useCallback(
    async (itemId: string, files: FileList) => {
      if (tax.migrating) {
        setUploadError('Please wait — migrating existing files to new storage…')
        return
      }
      const item = yearData.items.find(i => i.id === itemId)
      for (const file of Array.from(files)) {
        // File size guard
        if (file.size > MAX_FILE_SIZE) {
          setUploadError(`${file.name} exceeds the 10 MB limit and was not uploaded.`)
          continue
        }

        const content = await fileToBase64(file)
        const ext = file.name.split('.').pop() || ''

        // Build standardized name: Owner_Label.ext
        let displayName = file.name
        if (item) {
          const ownerLabel = item.owner === 'primary' ? primaryName : item.owner === 'partner' ? partnerName : 'Joint'
          displayName = `${ownerLabel}_${item.label}.${ext}`
        }

        const docFile: TaxDocFile = {
          id: nextFileId(),
          name: displayName,
          content,
          ext,
          uploadedAt: new Date().toISOString(),
        }
        try {
          await tax.addFileToItemAsync(selectedYear, itemId, docFile)
        } catch {
          setUploadError(`Failed to save ${file.name}. Storage may be unavailable in private browsing.`)
        }
      }
      refreshStorage()
    },
    [selectedYear, tax, yearData, primaryName, partnerName, refreshStorage],
  )

  const handleRemoveFile = useCallback(
    (itemId: string, fileId: string) => {
      tax.removeFileFromItem(selectedYear, itemId, fileId)
    },
    [selectedYear, tax],
  )

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      tax.removeItem(selectedYear, itemId)
    },
    [selectedYear, tax],
  )

  const handleRename = useCallback(
    (itemId: string, newLabel: string) => {
      tax.updateItem(selectedYear, itemId, { label: newLabel })
    },
    [selectedYear, tax],
  )

  const handleAddItem = (owner: TaxDocOwner) => setAddModal(owner)
  const handleSuggestAccounts = (owner: TaxDocOwner) => setSuggestModal(owner)

  const handleAddPaystub = (owner: TaxDocOwner) => {
    const name = owner === 'primary' ? primaryName : partnerName
    tax.addItem(selectedYear, `${name}'s Paystubs`, owner, 'paystub')
  }

  const handleAddCustom = (label: string, category: ChecklistCategory) => {
    if (!addModal) return
    tax.addItem(selectedYear, label, addModal, category)
  }

  const handleSuggestAdd = (accountIds: number[], label: string) => {
    if (!suggestModal) return
    tax.addItem(selectedYear, label, suggestModal, 'account', accountIds)
  }

  const handleAddReturnEntry = (owner: TaxDocOwner) => {
    const label =
      owner === 'joint'
        ? 'Joint Tax Return'
        : owner === 'primary'
          ? `${primaryName}'s Tax Return`
          : `${partnerName}'s Tax Return`
    tax.addItem(selectedYear, label, owner, 'tax-return')
  }

  const hasSuggestionsFor = (owner: TaxDocOwner): boolean => {
    const ownerAccts = accounts.filter(a => a.owner === owner)
    return ownerAccts.some(a => !linkedAccountIds.has(a.id))
  }

  return (
    <div className="tax-page">
      <div className="tax-header">
        <h1 className="tax-heading">Taxes</h1>
        {storageMB !== null && <span className="tax-storage-indicator">{storageMB} MB used</span>}
        <div className="tax-year-nav">
          <button className="tax-year-btn" onClick={() => setSelectedYear(y => y - 1)}>
            ←
          </button>
          <span className="tax-year-label">{selectedYear}</span>
          <button
            className="tax-year-btn"
            onClick={() => setSelectedYear(y => y + 1)}
            disabled={selectedYear >= CURRENT_YEAR}
          >
            →
          </button>
        </div>
      </div>

      {uploadError && <div className="tax-upload-error">{uploadError}</div>}

      {!exists ? (
        <div className="tax-empty-state">
          <h2>No tax prep for {selectedYear}</h2>
          <p>Create a checklist to start tracking documents for this tax year.</p>
          <div className="tax-empty-actions">
            <button className="tax-btn tax-btn--primary" onClick={createYear}>
              Create {selectedYear} Tax Prep
            </button>
            {tax.templates.length > 0 && (
              <button className="tax-btn tax-btn--outline" onClick={() => setImportTemplateModal(true)}>
                Import from Template
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="tax-body">
          {/* Save as Template / Delete year */}
          <div className="tax-template-bar">
            <button className="tax-btn tax-btn--outline tax-btn--template" onClick={() => setSaveTemplateModal(true)}>
              💾 Save as Template
            </button>
            <button className="tax-btn tax-btn--template tax-btn--danger" onClick={() => setConfirmDelete(true)}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ verticalAlign: '-1px' }}
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>{' '}
              Delete Year
            </button>
          </div>

          {/* Primary section */}
          <OwnerSection
            owner="primary"
            title={primaryName}
            items={primaryItems}
            year={selectedYear}
            onUpload={handleUpload}
            onRemoveFile={handleRemoveFile}
            onRemoveItem={handleRemoveItem}
            onRename={handleRename}
            onAddItem={handleAddItem}
            onAddPaystub={handleAddPaystub}
            onSuggestAccounts={handleSuggestAccounts}
            primaryName={primaryName}
            partnerName={partnerName}
            primaryAvatar={primaryAvatar}
            partnerAvatar={partnerAvatar}
            accounts={accounts}
            hasSuggestions={hasSuggestionsFor('primary')}
          />

          {/* Partner section */}
          {hasPartner && (
            <OwnerSection
              owner="partner"
              title={partnerName}
              items={partnerItems}
              year={selectedYear}
              onUpload={handleUpload}
              onRemoveFile={handleRemoveFile}
              onRemoveItem={handleRemoveItem}
              onRename={handleRename}
              onAddItem={handleAddItem}
              onAddPaystub={handleAddPaystub}
              onSuggestAccounts={handleSuggestAccounts}
              primaryName={primaryName}
              partnerName={partnerName}
              primaryAvatar={primaryAvatar}
              partnerAvatar={partnerAvatar}
              accounts={accounts}
              hasSuggestions={hasSuggestionsFor('partner')}
            />
          )}

          {/* Joint section */}
          <OwnerSection
            owner="joint"
            title="Joint"
            items={jointItems}
            year={selectedYear}
            onUpload={handleUpload}
            onRemoveFile={handleRemoveFile}
            onRemoveItem={handleRemoveItem}
            onRename={handleRename}
            onAddItem={handleAddItem}
            onAddPaystub={handleAddPaystub}
            onSuggestAccounts={handleSuggestAccounts}
            primaryName={primaryName}
            partnerName={partnerName}
            primaryAvatar={primaryAvatar}
            partnerAvatar={partnerAvatar}
            accounts={accounts}
            hasSuggestions={hasSuggestionsFor('joint')}
          />

          {/* Tax Returns */}
          <TaxReturnSection
            items={returnItems}
            year={selectedYear}
            onUpload={handleUpload}
            onRemoveFile={handleRemoveFile}
            onAddReturnEntry={handleAddReturnEntry}
            primaryName={primaryName}
            partnerName={partnerName}
            primaryAvatar={primaryAvatar}
            partnerAvatar={partnerAvatar}
            hasPartner={hasPartner}
          />
        </div>
      )}

      {suggestModal && (
        <SuggestModal
          accounts={accounts}
          alreadyLinked={linkedAccountIds}
          owner={suggestModal}
          onAdd={handleSuggestAdd}
          onClose={() => setSuggestModal(null)}
        />
      )}
      {addModal && <AddItemModal owner={addModal} onAdd={handleAddCustom} onClose={() => setAddModal(null)} />}
      {saveTemplateModal && (
        <SaveTemplateModal
          templates={tax.templates}
          onSaveNew={name => {
            tax.saveAsTemplate(name, selectedYear)
            setSaveTemplateModal(false)
          }}
          onUpdate={id => {
            tax.updateTemplate(id, selectedYear)
            setSaveTemplateModal(false)
          }}
          onClose={() => setSaveTemplateModal(false)}
        />
      )}
      {importTemplateModal && (
        <ImportTemplateModal
          templates={tax.templates}
          onImport={tpl => {
            tax.createYearFromTemplate(selectedYear, tpl)
            setImportTemplateModal(false)
          }}
          onDelete={id => tax.deleteTemplate(id)}
          onClose={() => setImportTemplateModal(false)}
        />
      )}
      {confirmDelete && (
        <div className="tax-modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="tax-modal tax-modal--sm" onClick={e => e.stopPropagation()}>
            <h3>Delete {selectedYear} Tax Prep?</h3>
            <p className="tax-modal-hint">
              This will remove all checklist items and uploaded documents for {selectedYear}. This cannot be undone.
            </p>
            <div className="tax-modal-actions">
              <button className="tax-btn tax-btn--outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                className="tax-btn tax-btn--danger"
                onClick={() => {
                  tax.deleteYear(selectedYear)
                  setConfirmDelete(false)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Taxes
