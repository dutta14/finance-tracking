import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import GrowthSettingsPanel from './GrowthSettingsPanel'

const defaults = { preBoundaryGrowth: 8, postBoundaryGrowth: 6, ageBoundary: 60, gwGrowth: 8 }

describe('GrowthSettingsPanel', () => {
  it('renders collapsed by default', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /growth assumptions/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/pre-60 growth/i)).not.toBeInTheDocument()
  })

  it('expands on toggle click', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /growth assumptions/i }))
    expect(screen.getByLabelText(/pre-60 growth/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/post-60 growth/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/age boundary/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/gw growth/i)).toBeInTheDocument()
  })

  it('calls onUpdate when a value changes', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('button', { name: /growth assumptions/i }))
    const preInput = screen.getByLabelText(/pre-60 growth/i)
    fireEvent.change(preInput, { target: { value: '10' } })
    expect(onUpdate).toHaveBeenCalledWith({ preBoundaryGrowth: 10 })
  })

  it('shows correct labels based on age boundary', () => {
    render(<GrowthSettingsPanel settings={{ ...defaults, ageBoundary: 55 }} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /growth assumptions/i }))
    expect(screen.getByLabelText(/pre-55 growth/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/post-55 growth/i)).toBeInTheDocument()
  })
})
