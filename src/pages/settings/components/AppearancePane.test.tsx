import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppearancePane from './AppearancePane'

const renderPane = (darkMode = false, onToggle = vi.fn()) => {
  const onToggleDarkMode = onToggle
  const utils = render(<AppearancePane darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />)
  return { ...utils, onToggleDarkMode }
}

describe('AppearancePane', () => {
  it('renders Light and Dark theme options', () => {
    renderPane()
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
  })

  it('marks Light as pressed when darkMode is false', () => {
    renderPane(false)
    const lightBtn = screen.getByRole('button', { name: /light/i })
    const darkBtn = screen.getByRole('button', { name: /dark/i })
    expect(lightBtn).toHaveAttribute('aria-pressed', 'true')
    expect(darkBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks Dark as pressed when darkMode is true', () => {
    renderPane(true)
    const lightBtn = screen.getByRole('button', { name: /light/i })
    const darkBtn = screen.getByRole('button', { name: /dark/i })
    expect(lightBtn).toHaveAttribute('aria-pressed', 'false')
    expect(darkBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onToggleDarkMode when clicking the inactive option', async () => {
    const user = userEvent.setup()
    const { onToggleDarkMode } = renderPane(false)
    await user.click(screen.getByRole('button', { name: /dark/i }))
    expect(onToggleDarkMode).toHaveBeenCalledTimes(1)
  })

  it('does not call onToggleDarkMode when clicking the already-active option', async () => {
    const user = userEvent.setup()
    const { onToggleDarkMode } = renderPane(false)
    await user.click(screen.getByRole('button', { name: /light/i }))
    expect(onToggleDarkMode).not.toHaveBeenCalled()
  })
})
