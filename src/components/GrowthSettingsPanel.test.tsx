import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import GrowthSettingsPanel from './GrowthSettingsPanel'

const defaults = {
  preBoundaryGrowth: 8,
  postBoundaryGrowth: 6,
  ageBoundary: 60,
  gwGrowth: 8,
  inflation: 3,
  retirementCap: 6000,
  nonRetirementBase: 6000,
  primaryRetirementAccessAge: 60,
  partnerRetirementAccessAge: 60,
}

describe('GrowthSettingsPanel', () => {
  it('renders collapsed by default', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /goal parameters/i })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /pre-60/i })).not.toBeInTheDocument()
  })

  it('expands on toggle click', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))
    expect(screen.getByRole('dialog', { name: /goal parameters/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /pre-60/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /post-60/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /switch to conservative/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /gw growth/i })).toBeInTheDocument()
  })

  it('focuses the first input on open and restores focus to the trigger on close', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: /goal parameters/i })
    fireEvent.click(trigger)

    expect(screen.getByRole('spinbutton', { name: /inflation/i })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(trigger).toHaveFocus()
  })

  it('renders inflation and allocation inputs when the growth settings panel is expanded', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))

    expect(screen.getByRole('spinbutton', { name: /inflation/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /retirement cap/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /non-retirement minimum/i })).toBeInTheDocument()
  })

  it('closes the growth settings modal when the user clicks the backdrop', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: /goal parameters/i })
    fireEvent.click(toggle)
    expect(screen.getByRole('spinbutton', { name: /pre-60/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('spinbutton', { name: /pre-60/i })).not.toBeInTheDocument()
  })

  it('closes the growth settings modal when the user presses escape', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: /goal parameters/i })
    fireEvent.click(toggle)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the growth settings modal when the user clicks cancel', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: /goal parameters/i })
    fireEvent.click(toggle)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onUpdate with all settings when Save is clicked', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))
    // Use the + button to nudge preBoundaryGrowth from 8 to 10 (2 clicks × 0.1 step = wrong, use 20 clicks)
    // Actually, nudge changes by step (0.1). Let's just test the nudge.
    const preLabel = screen.getByText(/pre-60/i).closest('label')!
    const increaseBtn = within(preLabel)
      .getAllByRole('button')
      .find(b => b.textContent === '+')!
    // Nudge from 8.0 → 8.1
    fireEvent.click(increaseBtn)
    expect(onUpdate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ preBoundaryGrowth: 8.1 }))
  })

  it('preserves a decimal value while editing and commits on save', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))

    const preLabel = screen.getByText(/pre-60/i).closest('label')!
    const decreaseBtn = within(preLabel)
      .getAllByRole('button')
      .find(b => b.textContent === '−')!
    // Nudge from 8.0 → 7.5 (5 clicks × 0.1)
    for (let i = 0; i < 5; i++) fireEvent.click(decreaseBtn)

    expect(onUpdate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ preBoundaryGrowth: 7.5 }))
  })

  it('commits multiple field changes on save', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))

    // Nudge inflation from 3 → 4 (10 clicks × 0.1)
    const inflationIncrease = screen.getByRole('button', { name: /increase inflation/i })
    for (let i = 0; i < 10; i++) fireEvent.click(inflationIncrease)

    // Nudge retirementCap from 6000 → 7000 (2 clicks × 500)
    const retCapLabel = screen.getByText(/retirement cap/i).closest('label')!
    const retCapIncrease = within(retCapLabel)
      .getAllByRole('button')
      .find(b => b.textContent === '+')!
    for (let i = 0; i < 2; i++) fireEvent.click(retCapIncrease)

    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ inflation: 4, retirementCap: 7000 }))
  })

  it('does not call onUpdate when cancel is clicked after changes', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))

    const boundaryInput = screen.getByRole('spinbutton', { name: /switch to conservative/i })
    fireEvent.change(boundaryInput, { target: { value: '' } })
    fireEvent.blur(boundaryInput)

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shows correct labels based on age boundary', () => {
    render(<GrowthSettingsPanel settings={{ ...defaults, ageBoundary: 55 }} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))
    expect(screen.getByRole('spinbutton', { name: /pre-55/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /post-55/i })).toBeInTheDocument()
  })
})
