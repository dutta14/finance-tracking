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

  it('renders inflation and allocation inputs when the growth settings panel is expanded', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /growth settings/i }))

    expect(screen.getByLabelText(/inflation/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/retirement cap/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/non-retirement minimum/i)).toBeInTheDocument()
  })

  it('collapses the growth settings panel when the user clicks outside the panel', () => {
    render(<GrowthSettingsPanel settings={defaults} onUpdate={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: /growth settings/i })
    fireEvent.click(toggle)
    expect(screen.getByLabelText(/pre-60/i)).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/pre-60/i)).not.toBeInTheDocument()
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

  it('preserves a decimal value while editing and commits the exact decimal on blur', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /growth settings/i }))

    const preInput = screen.getByLabelText(/pre-60/i)
    fireEvent.change(preInput, { target: { value: '7.5' } })

    expect(preInput).toHaveValue(7.5)
    expect(onUpdate).not.toHaveBeenCalled()

    fireEvent.blur(preInput)

    expect(onUpdate).toHaveBeenCalledWith({ preBoundaryGrowth: 7.5 })
  })

  it('commits inflation, retirement cap, and non-retirement minimum changes on blur', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /growth settings/i }))

    const inflationInput = screen.getByLabelText(/inflation/i)
    fireEvent.change(inflationInput, { target: { value: '4' } })
    fireEvent.blur(inflationInput)
    expect(onUpdate).toHaveBeenNthCalledWith(1, { inflation: 4 })

    const retirementCapInput = screen.getByLabelText(/retirement cap/i)
    fireEvent.change(retirementCapInput, { target: { value: '7000' } })
    fireEvent.blur(retirementCapInput)
    expect(onUpdate).toHaveBeenNthCalledWith(2, { retirementCap: 7000 })

    const nonRetirementMinimumInput = screen.getByLabelText(/non-retirement minimum/i)
    fireEvent.change(nonRetirementMinimumInput, { target: { value: '5000' } })
    fireEvent.blur(nonRetirementMinimumInput)
    expect(onUpdate).toHaveBeenNthCalledWith(3, { nonRetirementBase: 5000 })
  })

  it('falls back to boundary age 60 when the boundary input is cleared and blurred', () => {
    const onUpdate = vi.fn()
    render(<GrowthSettingsPanel settings={defaults} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /growth settings/i }))

    const boundaryInput = screen.getByLabelText(/boundary/i)
    fireEvent.change(boundaryInput, { target: { value: '' } })
    fireEvent.blur(boundaryInput)

    expect(onUpdate).toHaveBeenCalledWith({ ageBoundary: 60 })
  })

  it('shows correct labels based on age boundary', () => {
    render(<GrowthSettingsPanel settings={{ ...defaults, ageBoundary: 55 }} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /growth settings/i }))
    expect(screen.getByLabelText(/pre-55/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/post-55/i)).toBeInTheDocument()
  })
})
