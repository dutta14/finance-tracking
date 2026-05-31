import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RatioTabs from './RatioTabs'
import type { CustomRatio } from '../types'
import { createRef } from 'react'

const noop = vi.fn()

const makeProps = (overrides = {}) => ({
  customRatios: [] as CustomRatio[],
  activeRatioId: null as string | null,
  confirmDeleteId: null as string | null,
  createMenuOpen: false,
  createMenuRef: createRef<HTMLDivElement>(),
  onSelectRatio: noop,
  onRequestDelete: noop,
  onConfirmDelete: noop,
  onCancelDelete: noop,
  onCreateBlank: noop,
  onCreateFromPreset: noop,
  onToggleCreateMenu: noop,
  ...overrides,
})

describe('RatioTabs', () => {
  it('shows empty state when no ratios exist', () => {
    render(<RatioTabs {...makeProps()} />)
    expect(screen.getByText(/No allocations yet/)).toBeInTheDocument()
  })

  it('renders tab for each custom ratio', () => {
    const ratios: CustomRatio[] = [
      { id: 'a', name: 'Stock Bond', scope: 'total', groups: [] },
      { id: 'b', name: 'US Intl', scope: 'fi', groups: [] },
    ]
    render(<RatioTabs {...makeProps({ customRatios: ratios, activeRatioId: 'a' })} />)
    expect(screen.getByText('Stock Bond')).toBeInTheDocument()
    expect(screen.getByText('US Intl')).toBeInTheDocument()
  })

  it('shows preset options when create menu is open', () => {
    render(<RatioTabs {...makeProps({ createMenuOpen: true })} />)
    expect(screen.getByText('Blank')).toBeInTheDocument()
    expect(screen.getByText('Stock vs Bond')).toBeInTheDocument()
    expect(screen.getByText('US vs International')).toBeInTheDocument()
  })

  it('shows delete confirmation when confirmDeleteId matches a ratio', () => {
    const ratios: CustomRatio[] = [
      { id: 'a', name: 'MyRatio', scope: 'total', groups: [], goals: { total: { type: 'constant', pcts: [50, 50] } } },
    ]
    render(<RatioTabs {...makeProps({ customRatios: ratios, confirmDeleteId: 'a' })} />)
    expect(screen.getByText(/Goals for.*will also be removed/)).toBeInTheDocument()
  })

  it('calls onSelectRatio when a ratio tab is clicked', async () => {
    const user = userEvent.setup()
    const onSelectRatio = vi.fn()
    const ratios: CustomRatio[] = [
      { id: 'a', name: 'Stock Bond', scope: 'total', groups: [] },
      { id: 'b', name: 'US Intl', scope: 'fi', groups: [] },
    ]
    render(<RatioTabs {...makeProps({ customRatios: ratios, activeRatioId: 'a', onSelectRatio })} />)
    await user.click(screen.getByText('US Intl'))
    expect(onSelectRatio).toHaveBeenCalledWith('b')
  })

  it('calls onRequestDelete when delete button on a tab is clicked', async () => {
    const user = userEvent.setup()
    const onRequestDelete = vi.fn()
    const ratios: CustomRatio[] = [{ id: 'a', name: 'Stock Bond', scope: 'total', groups: [] }]
    render(<RatioTabs {...makeProps({ customRatios: ratios, activeRatioId: 'a', onRequestDelete })} />)
    await user.click(screen.getByTitle('Delete ratio'))
    expect(onRequestDelete).toHaveBeenCalledWith('a')
  })

  it('calls onConfirmDelete when Delete button in confirm bar is clicked', async () => {
    const user = userEvent.setup()
    const onConfirmDelete = vi.fn()
    const ratios: CustomRatio[] = [
      { id: 'a', name: 'MyRatio', scope: 'total', groups: [], goals: { total: { type: 'constant', pcts: [50, 50] } } },
    ]
    render(<RatioTabs {...makeProps({ customRatios: ratios, confirmDeleteId: 'a', onConfirmDelete })} />)
    await user.click(screen.getByText('Delete'))
    expect(onConfirmDelete).toHaveBeenCalledWith('a')
  })

  it('calls onCancelDelete when Cancel button in confirm bar is clicked', async () => {
    const user = userEvent.setup()
    const onCancelDelete = vi.fn()
    const ratios: CustomRatio[] = [
      { id: 'a', name: 'MyRatio', scope: 'total', groups: [], goals: { total: { type: 'constant', pcts: [50, 50] } } },
    ]
    render(<RatioTabs {...makeProps({ customRatios: ratios, confirmDeleteId: 'a', onCancelDelete })} />)
    await user.click(screen.getByText('Cancel'))
    expect(onCancelDelete).toHaveBeenCalled()
  })
})
