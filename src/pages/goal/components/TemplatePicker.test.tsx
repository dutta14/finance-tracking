import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('calls onSelect with correct template when a card is clicked', async () => {
    const user = userEvent.setup()
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    await user.click(screen.getByText('Coast FI'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(GOAL_TEMPLATES.find(t => t.id === 'coast-fi'))
  })

  it('calls onSelect when Enter is pressed on a focused card', async () => {
    const user = userEvent.setup()
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    const buttons = screen.getAllByRole('button').filter(b => b.classList.contains('template-card'))
    const fatFiBtn = buttons.find(b => b.textContent!.includes('Fat FI'))!
    fatFiBtn.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(GOAL_TEMPLATES.find(t => t.id === 'fat-fi'))
  })

  it('calls onSelect when Space is pressed on a focused card', async () => {
    const user = userEvent.setup()
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    const buttons = screen.getAllByRole('button').filter(b => b.classList.contains('template-card'))
    const baristaBtn = buttons.find(b => b.textContent!.includes('Barista FI'))!
    baristaBtn.focus()
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(GOAL_TEMPLATES.find(t => t.id === 'barista-fi'))
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<TemplatePicker onSelect={onSelect} onClose={onClose} />)
    await user.click(screen.getByLabelText('Close template picker'))
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

describe('TemplatePicker motion', () => {
  it('TemplatePicker.css uses picker-reveal animation, not wizard-fade', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const cssPath = path.resolve(__dirname, '..', '..', '..', 'styles', 'TemplatePicker.css')
    const source = fs.readFileSync(cssPath, 'utf-8')
    expect(source).toMatch(/\.template-picker\s*\{[^}]*animation:\s*picker-reveal\s+0\.2s\s+ease/)
    expect(source).not.toContain('wizard-fade')
  })

  it('Goal.css declares the picker-reveal keyframes with vertical translation', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const cssPath = path.resolve(__dirname, '..', '..', '..', 'styles', 'Goal.css')
    const source = fs.readFileSync(cssPath, 'utf-8')
    expect(source).toMatch(/@keyframes\s+picker-reveal\s*\{[\s\S]*translateY\(-4px\)[\s\S]*translateY\(0\)[\s\S]*\}/)
  })

  it('Goal.css disables the picker animation under prefers-reduced-motion', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const cssPath = path.resolve(__dirname, '..', '..', '..', 'styles', 'Goal.css')
    const source = fs.readFileSync(cssPath, 'utf-8')
    const reducedMotionBlock = source.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/)
    expect(reducedMotionBlock).not.toBeNull()
    const block = reducedMotionBlock![0]
    const coversPicker =
      /\*\s*\{[^}]*animation:\s*none/.test(block) || /\.template-picker[\s\S]*animation:\s*none/.test(block)
    expect(coversPicker).toBe(true)
  })

  it('Goal.css preserves wizard-fade for wizard step transitions', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const cssPath = path.resolve(__dirname, '..', '..', '..', 'styles', 'Goal.css')
    const source = fs.readFileSync(cssPath, 'utf-8')
    expect(source).toMatch(/@keyframes\s+wizard-fade/)
  })
})
