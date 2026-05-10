import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TermAbbr from './TermAbbr'

describe('TermAbbr', () => {
  it('renders the term text and accessible label for FI', () => {
    render(<TermAbbr term="FI" />)

    const abbr = screen.getByText('FI')
    expect(abbr).toBeInTheDocument()
    expect(abbr.tagName).toBe('ABBR')
    expect(abbr).toHaveAttribute('aria-label', 'Financial Independence')
  })

  it('renders the term text and accessible label for GW', () => {
    render(<TermAbbr term="GW" />)

    const abbr = screen.getByText('GW')
    expect(abbr).toBeInTheDocument()
    expect(abbr).toHaveAccessibleName('Generational Wealth')
  })

  it('shows tooltip on hover and hides on mouse leave', async () => {
    const user = userEvent.setup()
    render(<TermAbbr term="FI" />)

    const abbr = screen.getByText('FI')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await user.hover(abbr)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Financial Independence — the portfolio size needed so investment returns cover your living expenses.',
    )

    await user.unhover(abbr)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows tooltip on focus and hides on blur', async () => {
    const user = userEvent.setup()
    render(<TermAbbr term="GW" />)

    const abbr = screen.getByText('GW')

    await user.tab()
    expect(document.activeElement).toBe(abbr)
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      "Generational Wealth — assets earmarked for legacy goals like children's education or inheritance.",
    )

    await user.tab()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
