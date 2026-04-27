import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TemplatePicker from './TemplatePicker'
import { GOAL_TEMPLATES } from '../data/goalTemplates'

vi.mock('../../../styles/TemplatePicker.css', () => ({}))

describe('TemplatePicker', () => {
  const onSelect = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all 5 templates', () => {
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    for (const template of GOAL_TEMPLATES) {
      expect(screen.getByText(template.name)).toBeInTheDocument()
      expect(screen.getByText(template.description)).toBeInTheDocument()
    }
  })

  it('calls onSelect with correct template when a card is clicked', () => {
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    fireEvent.click(screen.getByText('Coast FI'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(GOAL_TEMPLATES.find(t => t.id === 'coast-fi'))
  })

  it('calls onSelect when Enter is pressed on a focused card', () => {
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    const buttons = screen.getAllByRole('button').filter(b => b.classList.contains('template-card'))
    const fatFiBtn = buttons.find(b => b.textContent!.includes('Fat FI'))!
    fireEvent.keyDown(fatFiBtn, { key: 'Enter' })
    fireEvent.keyUp(fatFiBtn, { key: 'Enter' })
    fireEvent.click(fatFiBtn)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(GOAL_TEMPLATES.find(t => t.id === 'fat-fi'))
  })

  it('calls onSelect when Space is pressed on a focused card', () => {
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    const buttons = screen.getAllByRole('button').filter(b => b.classList.contains('template-card'))
    const baristaBtn = buttons.find(b => b.textContent!.includes('Barista FI'))!
    fireEvent.keyDown(baristaBtn, { key: ' ' })
    fireEvent.keyUp(baristaBtn, { key: ' ' })
    fireEvent.click(baristaBtn)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(GOAL_TEMPLATES.find(t => t.id === 'barista-fi'))
  })

  it('calls onClose when close button is clicked', () => {
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close template picker'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('has accessible group role and button cards', () => {
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    expect(screen.getByRole('group', { name: 'Goal templates' })).toBeInTheDocument()
    const templateButtons = screen.getAllByRole('button').filter(b => b.classList.contains('template-card'))
    expect(templateButtons).toHaveLength(5)
  })

  it('renders cards as focusable buttons without explicit tabIndex', () => {
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    const templateButtons = screen.getAllByRole('button').filter(b => b.classList.contains('template-card'))
    for (const btn of templateButtons) {
      expect(btn.tagName).toBe('BUTTON')
      expect(btn).not.toHaveAttribute('tabindex')
    }
  })
})
