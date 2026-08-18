import { FC, RefObject } from 'react'
import { CustomRatio, RatioPreset } from '../types'
import { PRESETS } from '../constants'

interface RatioTabsProps {
  customRatios: CustomRatio[]
  activeRatioId: string | null
  confirmDeleteId: string | null
  createMenuOpen: boolean
  createMenuRef: RefObject<HTMLDivElement | null>
  onSelectRatio: (id: string) => void
  onRequestDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
  onCreateBlank: () => void
  onCreateFromPreset: (preset: RatioPreset) => void
  onToggleCreateMenu: () => void
}

const RatioTabs: FC<RatioTabsProps> = ({
  customRatios,
  activeRatioId,
  confirmDeleteId,
  createMenuOpen,
  createMenuRef,
  onSelectRatio,
  onRequestDelete: _onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onCreateBlank,
  onCreateFromPreset,
  onToggleCreateMenu,
}) => (
  <>
    <div className="alloc-ratio-toolbar">
      <div className="tab-bar alloc-ratio-tabs">
        {customRatios.map(r => (
          <button
            key={r.id}
            className={`tab-btn${r.id === activeRatioId ? ' active' : ''}`}
            onClick={() => onSelectRatio(r.id)}
          >
            {r.name}
          </button>
        ))}
        <div className="alloc-ratio-create-wrap" ref={createMenuRef}>
          <button className="tab-btn alloc-ratio-tab--add" onClick={onToggleCreateMenu}>
            +
          </button>
          {createMenuOpen && (
            <div className="alloc-ratio-create-menu">
              <button className="alloc-ratio-create-option" onClick={onCreateBlank}>
                Blank
              </button>
              {PRESETS.map(p => (
                <button key={p.id} className="alloc-ratio-create-option" onClick={() => onCreateFromPreset(p)}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

    {confirmDeleteId &&
      (() => {
        const r = customRatios.find(cr => cr.id === confirmDeleteId)
        if (!r) return null
        const scopes = Object.keys(r.goals ?? {})
          .map(s => (s === 'total' ? 'Total' : s.toUpperCase()))
          .join(', ')
        return (
          <div className="alloc-ratio-confirm-bar">
            <span>
              Delete <strong>{r.name}</strong>? Goals for {scopes} will also be removed.
            </span>
            <button className="alloc-ratio-confirm-yes" onClick={() => onConfirmDelete(confirmDeleteId)}>
              Delete
            </button>
            <button className="alloc-ratio-confirm-no" onClick={onCancelDelete}>
              Cancel
            </button>
          </div>
        )
      })()}

    {customRatios.length === 0 && (
      <div className="alloc-page-empty">No allocations yet. Click “+ New Ratio” to get started.</div>
    )}
  </>
)

export default RatioTabs
