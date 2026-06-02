import { FC, useState, useMemo, useCallback, useEffect } from 'react'
import { useProfile } from '../../hooks/useProfile'
import { useData } from '../../contexts/DataContext'
import { useTaxStore } from './useTaxStore'
import type { TaxDocFile, TaxDocOwner, ChecklistCategory } from './types'
import { getStorageEstimate } from '../../utils/taxFileDB'
import { fileToBase64, nextFileId } from './utils/fileHelpers'
import OwnerSection from './components/OwnerSection'
import SuggestModal from './components/SuggestModal'
import AddItemModal from './components/AddItemModal'
import SaveTemplateModal from './components/SaveTemplateModal'
import ImportTemplateModal from './components/ImportTemplateModal'
import TaxReturnSection from './components/TaxReturnSection'
import '../../styles/Taxes.css'

const CURRENT_YEAR = new Date().getFullYear()
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

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

      {uploadError && (
        <div className="tax-upload-error" role="alert" aria-live="polite">
          {uploadError}
        </div>
      )}

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
                className="tax-icon-align"
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
