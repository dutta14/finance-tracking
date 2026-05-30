import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SkipLink from './SkipLink'

describe('SkipLink', () => {
  it('renders with text "Skip to main content" and href="#main-content"', () => {
    render(<SkipLink />)
    const link = screen.getByRole('link', { name: 'Skip to main content' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '#main-content')
  })

  it('is the first focusable element when tabbing from document.body', async () => {
    const user = userEvent.setup()
    render(<SkipLink />)
    document.body.focus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus()
  })
})
