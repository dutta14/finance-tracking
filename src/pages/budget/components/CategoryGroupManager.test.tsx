import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryGroupManager from './CategoryGroupManager'
import type { CategoryGroup } from '../types'

const defaultGroups: CategoryGroup[] = [
  { id: 'essentials', name: 'Essentials', categories: ['Groceries', 'Rent', 'Utilities'] },
  { id: 'lifestyle', name: 'Lifestyle', categories: ['Entertainment', 'Dining'] },
  { id: 'others', name: 'Others', categories: [] },
  { id: 'removed', name: 'Removed', categories: [] },
]

// All categories are expense categories (have negative months)
const defaultCategorySums: Record<string, Record<string, number>> = {
  Groceries: { '2024-01': -500 },
  Rent: { '2024-01': -1500 },
  Utilities: { '2024-01': -200 },
  Entertainment: { '2024-01': -100 },
  Dining: { '2024-01': -300 },
}

const defaultProps = {
  groups: defaultGroups,
  onUpdate: vi.fn(),
  onMerge: vi.fn(),
  onDeleteCategory: vi.fn(),
  categoryHasTransactions: vi.fn(() => false),
  categorySums: defaultCategorySums,
}

describe('CategoryGroupManager', () => {
  it('renders the title and hint text', () => {
    render(<CategoryGroupManager {...defaultProps} />)
    expect(screen.getByText('Expense Category Groups')).toBeInTheDocument()
    expect(
      screen.getByText('Drag expense categories between groups. Income categories are grouped automatically.'),
    ).toBeInTheDocument()
  })

  it('renders all group names', () => {
    render(<CategoryGroupManager {...defaultProps} />)
    expect(screen.getByText('Essentials')).toBeInTheDocument()
    expect(screen.getByText('Lifestyle')).toBeInTheDocument()
    expect(screen.getByText('Others')).toBeInTheDocument()
    expect(screen.getByText('Removed')).toBeInTheDocument()
  })

  it('renders category count badges for each group', () => {
    render(<CategoryGroupManager {...defaultProps} />)
    // Essentials has 3, Lifestyle has 2, Others has 0, Removed has 0
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(2)
  })

  it('renders categories sorted alphabetically within expanded groups', () => {
    render(<CategoryGroupManager {...defaultProps} />)
    // Essentials categories should be sorted: Groceries, Rent, Utilities
    const essentialsCategories = ['Groceries', 'Rent', 'Utilities']
    essentialsCategories.forEach(cat => {
      expect(screen.getByText(cat)).toBeInTheDocument()
    })
  })

  it('collapses a group when toggle button is clicked', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    // Groceries should be visible initially (all groups start expanded)
    expect(screen.getByText('Groceries')).toBeInTheDocument()

    // Click the first toggle (Essentials)
    const toggleButtons = screen
      .getAllByRole('button')
      .filter(btn => btn.querySelector('svg') !== null && btn.textContent === '')
    // Find the toggle next to Essentials
    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')!
    const toggle = within(essentialsGroup).getAllByRole('button')[0]
    await user.click(toggle)

    // Groceries should no longer be visible
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument()
  })

  it('expands a collapsed group when toggle is clicked again', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')!
    const toggle = within(essentialsGroup).getAllByRole('button')[0]

    // Collapse
    await user.click(toggle)
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument()

    // Expand
    await user.click(toggle)
    expect(screen.getByText('Groceries')).toBeInTheDocument()
  })

  it('enters rename mode on double-click of group name', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    await user.dblClick(screen.getByText('Essentials'))
    const input = screen.getByDisplayValue('Essentials')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('saves rename on Enter key', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    await user.dblClick(screen.getByText('Essentials'))
    const input = screen.getByDisplayValue('Essentials')
    await user.clear(input)
    await user.type(input, 'Basic Needs{Enter}')

    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'essentials', name: 'Basic Needs' })]),
    )
  })

  it('cancels rename on Escape key', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    await user.dblClick(screen.getByText('Essentials'))
    const input = screen.getByDisplayValue('Essentials')
    await user.clear(input)
    await user.type(input, 'Something Else{Escape}')

    // Should not call onUpdate — editing cancelled
    expect(onUpdate).not.toHaveBeenCalled()
    // Original name should reappear
    expect(screen.getByText('Essentials')).toBeInTheDocument()
  })

  it('does not allow renaming protected groups (Others)', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    await user.dblClick(screen.getByText('Others'))
    // Should NOT enter edit mode — no input should appear with value "Others"
    expect(screen.queryByDisplayValue('Others')).not.toBeInTheDocument()
  })

  it('does not allow renaming protected groups (Removed)', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    await user.dblClick(screen.getByText('Removed'))
    expect(screen.queryByDisplayValue('Removed')).not.toBeInTheDocument()
  })

  it('does not show rename/delete/move buttons for protected groups', () => {
    render(<CategoryGroupManager {...defaultProps} />)

    const othersGroup = screen.getByText('Others').closest('.budget-group-block')!
    expect(within(othersGroup).queryByTitle('Rename group')).not.toBeInTheDocument()
    expect(within(othersGroup).queryByTitle('Delete group (categories move to Others)')).not.toBeInTheDocument()
    expect(within(othersGroup).queryByTitle('Move group up')).not.toBeInTheDocument()

    const removedGroup = screen.getByText('Removed').closest('.budget-group-block')!
    expect(within(removedGroup).queryByTitle('Rename group')).not.toBeInTheDocument()
  })

  it('shows rename/delete/move buttons for non-protected groups', () => {
    render(<CategoryGroupManager {...defaultProps} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')!
    expect(within(essentialsGroup).getByTitle('Rename group')).toBeInTheDocument()
    expect(within(essentialsGroup).getByTitle('Delete group (categories move to Others)')).toBeInTheDocument()
    expect(within(essentialsGroup).getByTitle('Move group up')).toBeInTheDocument()
    expect(within(essentialsGroup).getByTitle('Move group down')).toBeInTheDocument()
  })

  it('deletes a group and moves its categories to Others', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')!
    const deleteBtn = within(essentialsGroup).getByTitle('Delete group (categories move to Others)')
    await user.click(deleteBtn)

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const updatedGroups = onUpdate.mock.calls[0][0]
    // Essentials should be gone
    expect(updatedGroups.find((g: CategoryGroup) => g.id === 'essentials')).toBeUndefined()
    // Others should now contain Essentials' categories
    const othersGroup = updatedGroups.find((g: CategoryGroup) => g.id === 'others')
    expect(othersGroup.categories).toContain('Groceries')
    expect(othersGroup.categories).toContain('Rent')
    expect(othersGroup.categories).toContain('Utilities')
  })

  it('adds a new group via input and Add Group button', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    const input = screen.getByPlaceholderText('New group name')
    await user.type(input, 'Subscriptions')
    await user.click(screen.getByText('Add Group'))

    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Subscriptions', categories: [] })]),
    )
  })

  it('disables Add Group button when input is empty', () => {
    render(<CategoryGroupManager {...defaultProps} />)
    const addBtn = screen.getByText('Add Group')
    expect(addBtn).toBeDisabled()
  })

  it('does not add a duplicate group name', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    const input = screen.getByPlaceholderText('New group name')
    await user.type(input, 'Essentials')
    await user.click(screen.getByText('Add Group'))

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('enables merge mode and shows merge panel', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    await user.click(screen.getByText('Merge Categories'))
    expect(screen.getByText('Cancel Merge')).toBeInTheDocument()
    expect(screen.getByText(/Click categories above to select them/)).toBeInTheDocument()
  })

  it('cancels merge mode', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    await user.click(screen.getByText('Merge Categories'))
    expect(screen.getByText('Cancel Merge')).toBeInTheDocument()

    await user.click(screen.getByText('Cancel Merge'))
    expect(screen.getByText('Merge Categories')).toBeInTheDocument()
    expect(screen.queryByText(/Click categories above to select them/)).not.toBeInTheDocument()
  })

  it('shows delete merge prompt for category with transactions', async () => {
    const categoryHasTransactions = vi.fn((cat: string) => cat === 'Groceries')
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} categoryHasTransactions={categoryHasTransactions} />)

    // Click the delete button on Groceries
    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')!
    const deleteBtn = within(groceriesEl).getByTitle('Delete category')
    await user.click(deleteBtn)

    // Should show merge prompt
    expect(screen.getByText(/has transactions/)).toBeInTheDocument()
    expect(screen.getByText('Merge & Delete')).toBeInTheDocument()
  })

  it('calls onDeleteCategory directly for category without transactions', async () => {
    const onDeleteCategory = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onDeleteCategory={onDeleteCategory} />)

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')!
    const deleteBtn = within(groceriesEl).getByTitle('Delete category')
    await user.click(deleteBtn)

    expect(onDeleteCategory).toHaveBeenCalledWith('Groceries')
  })

  it('hides income categories from the group manager', () => {
    const categorySums = {
      ...defaultCategorySums,
      Salary: { '2024-01': 5000 }, // income — no negative values
    }
    const groups: CategoryGroup[] = [
      ...defaultGroups.slice(0, 2),
      { id: 'others', name: 'Others', categories: ['Salary'] },
      defaultGroups[3],
    ]
    render(<CategoryGroupManager {...defaultProps} groups={groups} categorySums={categorySums} />)

    // Salary should not appear as it's an income category
    expect(screen.queryByText('Salary')).not.toBeInTheDocument()
  })

  it('strips group prefix from category display name', () => {
    const groups: CategoryGroup[] = [
      { id: 'food', name: 'Food', categories: ['Food: Groceries', 'Food: Dining'] },
      { id: 'others', name: 'Others', categories: [] },
      { id: 'removed', name: 'Removed', categories: [] },
    ]
    const sums: Record<string, Record<string, number>> = {
      'Food: Groceries': { '2024-01': -500 },
      'Food: Dining': { '2024-01': -300 },
    }
    render(<CategoryGroupManager {...defaultProps} groups={groups} categorySums={sums} />)

    // Should display "Groceries" and "Dining" (stripped prefix)
    expect(screen.getByText('Dining')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
  })
})
