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
    expect(screen.getByRole('button', { name: /growth settings/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/pre-60/i)).not.toBeInTheDocument()
  })

  it('expands on toggle click', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /growth settings/i }))
    expect(screen.getByLabelText(/pre-60/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/post-60/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/boundary/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/gw/i)).toBeInTheDocument()
  })

  it('calls onUpdate when a value changes', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('button', { name: /growth settings/i }))
    const preInput = screen.getByLabelText(/pre-60/i)
    fireEvent.change(preInput, { target: { value: '10' } })
    fireEvent.blur(preInput)
    expect(onUpdate).toHaveBeenCalledWith({ preBoundaryGrowth: 10 })
  })

  it('shows correct labels based on age boundary', () => {
    render(<GrowthSettingsPanel settings={{ ...defaults, ageBoundary: 55 }} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /growth settings/i }))
    expect(screen.getByLabelText(/pre-55/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/post-55/i)).toBeInTheDocument()
  })
})
