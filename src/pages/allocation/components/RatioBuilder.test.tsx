import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RatioBuilder from './RatioBuilder'
import type { CustomRatio } from '../types'

const makeRatio = (overrides: Partial<CustomRatio> = {}): CustomRatio => ({
  id: 'r1',
  name: 'My Ratio',
  scope: 'total',
  groups: [
    { label: 'Group A', classes: ['us-stock'] },
    { label: 'Group B', classes: ['bonds'] },
  ],
  ...overrides,
})

const noop = vi.fn()

describe('RatioBuilder', () => {
  it('renders the ratio name input with current value', () => {
    render(
      <RatioBuilder
        activeRatio={makeRatio()}
        onUpdateName={noop}
        onUpdateScope={noop}
        onUpdateGroupLabel={noop}
        onToggleClass={noop}
        onAddGroup={noop}
        onRemoveGroup={noop}
        goalSection={null}
      />,
    )
    const input = screen.getByDisplayValue('My Ratio')
    expect(input).toBeInTheDocument()
  })

  it('renders group labels and asset class pills', () => {
    render(
      <RatioBuilder
        activeRatio={makeRatio()}
        onUpdateName={noop}
        onUpdateScope={noop}
        onUpdateGroupLabel={noop}
        onToggleClass={noop}
        onAddGroup={noop}
        onRemoveGroup={noop}
        goalSection={null}
      />,
    )
    expect(screen.getByDisplayValue('Group A')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Group B')).toBeInTheDocument()
    // Asset class pills
    expect(screen.getAllByText('US Stock').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Bonds').length).toBeGreaterThanOrEqual(1)
  })

  it('shows Add Group button when fewer than 6 groups', () => {
    render(
      <RatioBuilder
        activeRatio={makeRatio()}
        onUpdateName={noop}
        onUpdateScope={noop}
        onUpdateGroupLabel={noop}
        onToggleClass={noop}
        onAddGroup={noop}
        onRemoveGroup={noop}
        goalSection={null}
      />,
    )
    expect(screen.getByText('+ Add Group')).toBeInTheDocument()
  })

  it('hides Add Group button when 6 groups exist', () => {
    const ratio = makeRatio({
      groups: Array.from({ length: 6 }, (_, i) => ({ label: `G${i}`, classes: [] })),
    })
    render(
      <RatioBuilder
        activeRatio={ratio}
        onUpdateName={noop}
        onUpdateScope={noop}
        onUpdateGroupLabel={noop}
        onToggleClass={noop}
        onAddGroup={noop}
        onRemoveGroup={noop}
        goalSection={null}
      />,
    )
    expect(screen.queryByText('+ Add Group')).not.toBeInTheDocument()
  })

  it('calls onToggleClass when an asset class pill is clicked', async () => {
    const user = userEvent.setup()
    const onToggleClass = vi.fn()
    render(
      <RatioBuilder
        activeRatio={makeRatio()}
        onUpdateName={noop}
        onUpdateScope={noop}
        onUpdateGroupLabel={noop}
        onToggleClass={onToggleClass}
        onAddGroup={noop}
        onRemoveGroup={noop}
        goalSection={null}
      />,
    )
    const cashPills = screen.getAllByText('Cash')
    await user.click(cashPills[0])
    expect(onToggleClass).toHaveBeenCalledWith(0, 'cash')
  })

  it('calls onUpdateName when the name input changes', async () => {
    const user = userEvent.setup()
    const onUpdateName = vi.fn()
    render(
      <RatioBuilder
        activeRatio={makeRatio()}
        onUpdateName={onUpdateName}
        onUpdateScope={noop}
        onUpdateGroupLabel={noop}
        onToggleClass={noop}
        onAddGroup={noop}
        onRemoveGroup={noop}
        goalSection={null}
      />,
    )
    const input = screen.getByDisplayValue('My Ratio')
    await user.clear(input)
    await user.type(input, 'New Name')
    expect(onUpdateName).toHaveBeenCalled()
  })

  it('calls onUpdateScope when a scope tab is clicked', async () => {
    const user = userEvent.setup()
    const onUpdateScope = vi.fn()
    render(
      <RatioBuilder
        activeRatio={makeRatio()}
        onUpdateName={noop}
        onUpdateScope={onUpdateScope}
        onUpdateGroupLabel={noop}
        onToggleClass={noop}
        onAddGroup={noop}
        onRemoveGroup={noop}
        goalSection={null}
      />,
    )
    await user.click(screen.getByText('FI'))
    expect(onUpdateScope).toHaveBeenCalledWith('fi')
  })

  it('calls onRemoveGroup when remove button is clicked on a group with more than 2 groups', async () => {
    const user = userEvent.setup()
    const onRemoveGroup = vi.fn()
    const ratio = makeRatio({
      groups: [
        { label: 'A', classes: ['us-stock'] },
        { label: 'B', classes: ['bonds'] },
        { label: 'C', classes: ['cash'] },
      ],
    })
    render(
      <RatioBuilder
        activeRatio={ratio}
        onUpdateName={noop}
        onUpdateScope={noop}
        onUpdateGroupLabel={noop}
        onToggleClass={noop}
        onAddGroup={noop}
        onRemoveGroup={onRemoveGroup}
        goalSection={null}
      />,
    )
    const removeButtons = screen.getAllByTitle('Remove group')
    await user.click(removeButtons[0])
    expect(onRemoveGroup).toHaveBeenCalledWith(0)
  })

  it('calls onUpdateGroupLabel when a group label input changes', async () => {
    const user = userEvent.setup()
    const onUpdateGroupLabel = vi.fn()
    render(
      <RatioBuilder
        activeRatio={makeRatio()}
        onUpdateName={noop}
        onUpdateScope={noop}
        onUpdateGroupLabel={onUpdateGroupLabel}
        onToggleClass={noop}
        onAddGroup={noop}
        onRemoveGroup={noop}
        goalSection={null}
      />,
    )
    const groupInput = screen.getByDisplayValue('Group A')
    await user.clear(groupInput)
    await user.type(groupInput, 'Equities')
    expect(onUpdateGroupLabel).toHaveBeenCalled()
  })
})
