import { render, screen, fireEvent } from '@testing-library/react'
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
    expect(screen.queryByLabelText(/pre-60/i)).not.toBeInTheDocument()
  })

  it('expands on toggle click', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))
    expect(screen.getByRole('dialog', { name: /goal parameters/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/pre-60/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/post-60/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/switch to conservative/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/gw/i)).toBeInTheDocument()
  })

  it('renders inflation and allocation inputs when the growth settings panel is expanded', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))

    expect(screen.getByLabelText(/inflation/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/retirement cap/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/non-retirement minimum/i)).toBeInTheDocument()
  })

  it('closes the growth settings modal when the user clicks the backdrop', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: /goal parameters/i })
    fireEvent.click(toggle)
    expect(screen.getByLabelText(/pre-60/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/pre-60/i)).not.toBeInTheDocument()
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
    const preInput = screen.getByLabelText(/pre-60/i)
    fireEvent.change(preInput, { target: { value: '10' } })
    fireEvent.blur(preInput)
    expect(onUpdate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ preBoundaryGrowth: 10 }))
  })

  it('preserves a decimal value while editing and commits on save', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))

    const preInput = screen.getByLabelText(/pre-60/i)
    fireEvent.change(preInput, { target: { value: '7.5' } })

    expect(preInput).toHaveValue(7.5)
    expect(onUpdate).not.toHaveBeenCalled()

    fireEvent.blur(preInput)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ preBoundaryGrowth: 7.5 }))
  })

  it('commits multiple field changes on save', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))

    const inflationInput = screen.getByLabelText(/inflation/i)
    fireEvent.change(inflationInput, { target: { value: '4' } })
    fireEvent.blur(inflationInput)

    const retirementCapInput = screen.getByLabelText(/retirement cap/i)
    fireEvent.change(retirementCapInput, { target: { value: '7000' } })
    fireEvent.blur(retirementCapInput)

    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ inflation: 4, retirementCap: 7000 }))
  })

  it('does not call onUpdate when cancel is clicked after changes', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))

    const boundaryInput = screen.getByLabelText(/switch to conservative/i)
    fireEvent.change(boundaryInput, { target: { value: '' } })
    fireEvent.blur(boundaryInput)

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shows correct labels based on age boundary', () => {
    render(<GrowthSettingsPanel settings={{ ...defaults, ageBoundary: 55 }} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /goal parameters/i }))
    expect(screen.getByLabelText(/pre-55/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/post-55/i)).toBeInTheDocument()
  })
})
