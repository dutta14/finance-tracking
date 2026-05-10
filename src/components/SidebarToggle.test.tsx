import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SidebarToggle from './SidebarToggle'

describe('SidebarToggle', () => {
  it('renders expand button when collapsed', () => {
    render(<SidebarToggle expanded={false} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('calls onToggle when clicked', async () => {
    const onToggle = vi.fn()
    render(<SidebarToggle expanded={true} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('renders collapse label when expanded is true', () => {
    render(<SidebarToggle expanded={true} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Expand sidebar' })).not.toBeInTheDocument()
  })
})
