import { FC, RefObject } from 'react'
import { CustomRatio, RatioPreset } from '../types'
import { PRESETS } from '../constants'

interface RatioTabsProps {
  customRatios: CustomRatio[]
  activeRatioId: string | null
  createMenuOpen: boolean
  createMenuRef: RefObject<HTMLDivElement | null>
  onSelectRatio: (id: string) => void
  onCreateBlank: () => void
  onCreateFromPreset: (preset: RatioPreset) => void
  onToggleCreateMenu: () => void
}

const RatioTabs: FC<RatioTabsProps> = ({
  customRatios,
  activeRatioId,
  createMenuOpen,
  createMenuRef,
  onSelectRatio,
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

    {customRatios.length === 0 && (
      <div className="alloc-page-empty">No allocations yet. Click “+ New Ratio” to get started.</div>
    )}
  </>
)

export default RatioTabs
