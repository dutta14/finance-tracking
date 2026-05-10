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
})
