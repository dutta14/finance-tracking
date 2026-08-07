import { FC, ReactNode } from 'react'
import { AssetAllocation, ALLOCATION_LABELS } from '../../data/types'
import { CustomRatio } from '../types'
import { ALL_CLASSES, GROUP_COLORS } from '../constants'

interface RatioBuilderProps {
  activeRatio: CustomRatio
  onUpdateGroupLabel: (idx: number, label: string) => void
  onToggleClass: (groupIdx: number, cls: AssetAllocation) => void
  onAddGroup: () => void
  onRemoveGroup: (idx: number) => void
  goalSection: ReactNode
}

const RatioBuilder: FC<RatioBuilderProps> = ({
  activeRatio,
  onUpdateGroupLabel,
  onToggleClass,
  onAddGroup,
  onRemoveGroup,
  goalSection,
}) => (
  <div className="alloc-ratio-builder">
    <div className="alloc-ratio-groups">
      {activeRatio.groups.map((group, gi) => (
        <div key={gi} className="alloc-ratio-group">
          <div className="alloc-ratio-group-header">
            <span className="alloc-ratio-group-dot" style={{ background: GROUP_COLORS[gi % GROUP_COLORS.length] }} />
            <input
              className="alloc-ratio-group-name"
              value={group.label}
              onChange={e => onUpdateGroupLabel(gi, e.target.value)}
              aria-label={`Group ${gi + 1} name`}
            />
            {activeRatio.groups.length > 2 && (
              <button className="alloc-ratio-group-remove" onClick={() => onRemoveGroup(gi)} title="Remove group">
                ×
              </button>
            )}
          </div>
          <div className="alloc-ratio-class-pills">
            {ALL_CLASSES.map(cls => {
              const isSelected = group.classes.includes(cls)
              const usedElsewhere =
                !isSelected && activeRatio.groups.some((g, i) => i !== gi && g.classes.includes(cls))
              return (
                <button
                  key={cls}
                  className={`alloc-ratio-pill${isSelected ? ' active' : ''}${usedElsewhere ? ' used' : ''}`}
                  onClick={() => onToggleClass(gi, cls)}
                  disabled={usedElsewhere}
                  style={
                    isSelected
                      ? {
                          background: GROUP_COLORS[gi % GROUP_COLORS.length],
                          borderColor: GROUP_COLORS[gi % GROUP_COLORS.length],
                        }
                      : undefined
                  }
                >
                  {ALLOCATION_LABELS[cls]}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>

    {activeRatio.groups.length < 6 && (
      <button className="alloc-ratio-add-group" onClick={onAddGroup}>
        + Add Group
      </button>
    )}

    <div className="alloc-ratio-divider">
      <span className="alloc-ratio-divider-label">Goal</span>
    </div>

    {goalSection}
  </div>
)

export default RatioBuilder
