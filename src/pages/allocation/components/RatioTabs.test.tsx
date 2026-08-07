import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RatioTabs from './RatioTabs'
import type { CustomRatio } from '../types'
import { createRef } from 'react'
import { PRESETS } from '../constants'

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

  it('calls the create-menu callbacks when the add button and options are clicked', async () => {
    const user = userEvent.setup()
    const onToggleCreateMenu = vi.fn()
    const onCreateBlank = vi.fn()
    const onCreateFromPreset = vi.fn()

    render(
      <RatioTabs
        {...makeProps({
          createMenuOpen: true,
          onToggleCreateMenu,
          onCreateBlank,
          onCreateFromPreset,
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: '+' }))
    await user.click(screen.getByText('Blank'))
    await user.click(screen.getByText(PRESETS[0].name))

    expect(onToggleCreateMenu).toHaveBeenCalledTimes(1)
    expect(onCreateBlank).toHaveBeenCalledTimes(1)
    expect(onCreateFromPreset).toHaveBeenCalledWith(PRESETS[0])
  })

  it('shows delete confirmation when confirmDeleteId matches a ratio', () => {
    const ratios: CustomRatio[] = [
      { id: 'a', name: 'MyRatio', scope: 'total', groups: [], goals: { total: { type: 'constant', pcts: [50, 50] } } },
    ]
    render(<RatioTabs {...makeProps({ customRatios: ratios, confirmDeleteId: 'a' })} />)
    expect(screen.getByText(/Goals for.*will also be removed/)).toBeInTheDocument()
  })

  it('does not render the delete confirmation bar when the target ratio does not exist', () => {
    const ratios: CustomRatio[] = [{ id: 'a', name: 'MyRatio', scope: 'total', groups: [] }]
    render(<RatioTabs {...makeProps({ customRatios: ratios, confirmDeleteId: 'missing' })} />)
    expect(screen.queryByText(/will also be removed/)).not.toBeInTheDocument()
  })

  it('lists all goal scopes in the delete confirmation message', () => {
    const ratios: CustomRatio[] = [
      {
        id: 'a',
        name: 'MyRatio',
        scope: 'total',
        groups: [],
        goals: {
          total: { type: 'constant', pcts: [50, 50] },
          gw: { type: 'constant', pcts: [40, 60] },
        },
      },
    ]

    render(<RatioTabs {...makeProps({ customRatios: ratios, confirmDeleteId: 'a' })} />)

    expect(screen.getByText(/Goals for Total, GW will also be removed/)).toBeInTheDocument()
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

  // Delete button removed from tabs — delete is now inside builder details

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
