import { FC } from 'react'
import { GoalTemplate, GOAL_TEMPLATES } from '../data/goalTemplates'
import '../../../styles/TemplatePicker.css'

interface TemplatePickerProps {
  onSelect: (template: GoalTemplate) => void
  onClose: () => void
}

const TemplatePicker: FC<TemplatePickerProps> = ({ onSelect, onClose }) => {
  const dollars = (n: number) => '$' + n.toLocaleString()

  return (
    <div className="template-picker">
      <div className="template-picker-header">
        <span className="template-picker-title">Choose a template</span>
        <button type="button" className="template-picker-close" onClick={onClose} aria-label="Close template picker">
          ✕
        </button>
      </div>
      <div role="group" aria-label="Goal templates" className="template-picker-grid">
        {GOAL_TEMPLATES.map(template => (
          <button key={template.id} type="button" className="template-card" onClick={() => onSelect(template)}>
            <span className="template-card-name">{template.name}</span>
            <span className="template-card-desc">{template.description}</span>
            <div className="template-card-stats">
              <span className="template-card-stat">
                <span aria-hidden="true">🎯</span> Age {template.retirementAge}
              </span>
              <span className="template-card-stat">
                <span aria-hidden="true">💰</span> {dollars(template.annualExpense)}/yr
              </span>
              <span className="template-card-stat">
                <span aria-hidden="true">📈</span> {template.growth}% growth
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default TemplatePicker
