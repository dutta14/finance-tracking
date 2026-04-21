import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WelcomeGuide from './WelcomeGuide'

const renderGuide = () =>
  render(
    <MemoryRouter>
      <WelcomeGuide greeting="Good morning" />
    </MemoryRouter>,
  )

describe('WelcomeGuide', () => {
  it('renders the expected steps (no Tools step)', () => {
    renderGuide()

    const steps = screen.getAllByRole('heading', { level: 2 })
    const titles = steps.map(h => h.textContent)

    expect(titles).toEqual(['Net Worth', 'Goals', 'Allocation', 'Budget', 'Drive'])
    expect(titles).not.toContain('Tools')
  })

  it('does not render a Tools CTA button', () => {
    renderGuide()

    const buttons = screen.getAllByRole('button')
    const labels = buttons.map(b => b.textContent)

    expect(labels.some(l => l?.toLowerCase().includes('tool'))).toBe(false)
  })
})
