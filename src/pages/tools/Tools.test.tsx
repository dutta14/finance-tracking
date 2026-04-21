import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Tools from './Tools'

beforeEach(() => {
  localStorage.clear()
})

/* ─── Tools page ─── */

describe('Tools page', () => {
  it('renders the Tools heading', () => {
    render(<Tools />)
    expect(screen.getByRole('heading', { name: 'Tools' })).toBeInTheDocument()
  })

  it('does not render a PDF → CSV tool card', () => {
    render(<Tools />)
    expect(screen.queryByText('PDF → CSV')).not.toBeInTheDocument()
  })

  it('does not render a PDF → CSV tool card even when labs flag is on', () => {
    localStorage.setItem('lab-pdf-to-csv', '1')
    render(<Tools />)
    expect(screen.queryByText('PDF → CSV')).not.toBeInTheDocument()
  })
})
