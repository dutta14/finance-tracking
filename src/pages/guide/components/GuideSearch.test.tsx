import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GuideSearch from './GuideSearch'

describe('GuideSearch', () => {
  it('announces the default section count and debounces trimmed query updates', async () => {
    const onQueryChange = vi.fn()
    render(<GuideSearch matchCount={4} totalCount={12} onQueryChange={onQueryChange} />)

    expect(screen.getByText('12 sections in the guide.')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search this guide' }), { target: { value: '  taxes  ' } })

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenLastCalledWith('taxes')
    })
  })

  it('supports keyboard shortcuts to focus the search box and escape to clear it', async () => {
    const onQueryChange = vi.fn()
    render(<GuideSearch matchCount={1} totalCount={9} onQueryChange={onQueryChange} />)

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const search = screen.getByRole('searchbox', { name: 'Search this guide' })
    expect(search).toHaveFocus()

    fireEvent.change(search, { target: { value: 'retirement' } })
    await waitFor(() => expect(onQueryChange).toHaveBeenLastCalledWith('retirement'))
    expect(screen.getByText('1 section matches “retirement”.')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(search).not.toHaveFocus()
    expect(search).toHaveValue('')
    expect(onQueryChange).toHaveBeenLastCalledWith('')
  })

  it('focuses on slash only when the event target is not editable', async () => {
    const onQueryChange = vi.fn()
    render(
      <div>
        <textarea aria-label="Notes" />
        <GuideSearch matchCount={0} totalCount={5} onQueryChange={onQueryChange} />
      </div>,
    )

    const notes = screen.getByLabelText('Notes')
    notes.focus()
    fireEvent.keyDown(notes, { key: '/' })
    expect(notes).toHaveFocus()

    const search = screen.getByRole('searchbox', { name: 'Search this guide' })
    ;(document.body as HTMLBodyElement).focus()
    fireEvent.keyDown(window, { key: '/' })
    expect(search).toHaveFocus()
  })
})
