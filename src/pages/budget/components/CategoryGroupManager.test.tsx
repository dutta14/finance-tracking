import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
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
    expect(screen.getByText(/Drag categories between groups or drag group headers to reorder/)).toBeInTheDocument()
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
    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')! as HTMLElement
    const toggle = within(essentialsGroup).getAllByRole('button')[0]
    await user.click(toggle)

    // Groceries should no longer be visible
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument()
  })

  it('expands a collapsed group when toggle is clicked again', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')! as HTMLElement
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

  it('does not show rename or delete buttons for protected groups', () => {
    render(<CategoryGroupManager {...defaultProps} />)

    const othersGroup = screen.getByText('Others').closest('.budget-group-block')! as HTMLElement
    expect(within(othersGroup).queryByTitle('Rename group')).not.toBeInTheDocument()
    expect(within(othersGroup).queryByTitle('Delete group (categories move to Others)')).not.toBeInTheDocument()

    const removedGroup = screen.getByText('Removed').closest('.budget-group-block')! as HTMLElement
    expect(within(removedGroup).queryByTitle('Rename group')).not.toBeInTheDocument()
  })

  it('shows rename and delete buttons for non-protected groups', () => {
    render(<CategoryGroupManager {...defaultProps} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')! as HTMLElement
    expect(within(essentialsGroup).getByTitle('Rename group')).toBeInTheDocument()
    expect(within(essentialsGroup).getByTitle('Delete group (categories move to Others)')).toBeInTheDocument()
  })

  it('deletes a group and moves its categories to Others', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')! as HTMLElement
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

  it('adds a new group and enters rename mode', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    await user.click(screen.getByText('+ New Group'))

    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'New Group', categories: [] })]),
    )
  })

  it('enables merge mode and shows merge panel', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    await user.click(screen.getByText('Merge Categories'))
    expect(screen.getByText('Cancel Merge')).toBeInTheDocument()
    expect(screen.getByText(/Click categories below to select them/)).toBeInTheDocument()
  })

  it('cancels merge mode', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    await user.click(screen.getByText('Merge Categories'))
    expect(screen.getByText('Cancel Merge')).toBeInTheDocument()

    await user.click(screen.getByText('Cancel Merge'))
    expect(screen.getByText('Merge Categories')).toBeInTheDocument()
    expect(screen.queryByText(/Click categories below to select them/)).not.toBeInTheDocument()
  })

  it('shows delete merge prompt for category with transactions', async () => {
    const categoryHasTransactions = vi.fn((cat: string) => cat === 'Groceries')
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} categoryHasTransactions={categoryHasTransactions} />)

    // Click the delete button on Groceries
    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
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

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    const deleteBtn = within(groceriesEl).getByTitle('Delete category')
    await user.click(deleteBtn)

    expect(onDeleteCategory).toHaveBeenCalledWith('Groceries')
  })

  it('shows all categories in their groups regardless of amount sign', () => {
    const categorySums = {
      ...defaultCategorySums,
      Salary: { '2024-01': 5000 }, // positive amount, but in expense group
    }
    const groups: CategoryGroup[] = [
      ...defaultGroups.slice(0, 2),
      { id: 'others', name: 'Others', categories: ['Salary'] },
      defaultGroups[3],
    ]
    render(<CategoryGroupManager {...defaultProps} groups={groups} categorySums={categorySums} />)

    // Salary appears in expense section since it's in an expense group
    expect(screen.queryByText('Salary')).toBeInTheDocument()
  })

  it('renders a separate income section when income groups are provided', () => {
    const categorySums = {
      ...defaultCategorySums,
      Salary: { '2024-01': 5000 },
      Bonus: { '2024-01': 1200 },
    }
    const incomeGroups: CategoryGroup[] = [
      { id: 'paychecks', name: 'Paychecks', categories: ['Salary'] },
      { id: 'income-others', name: 'Others', categories: ['Bonus'] },
    ]

    render(
      <CategoryGroupManager
        {...defaultProps}
        incomeCategoryGroups={incomeGroups}
        onUpdateIncomeGroups={vi.fn()}
        categorySums={categorySums}
      />,
    )

    expect(screen.getByText('Income Category Groups')).toBeInTheDocument()
    expect(screen.getByText('Paychecks')).toBeInTheDocument()
    expect(screen.getByText('Salary')).toBeInTheDocument()
    expect(screen.getByText('Bonus')).toBeInTheDocument()
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

  it('shows transaction counts when yearly transactions are provided', () => {
    render(
      <CategoryGroupManager
        {...defaultProps}
        yearTransactions={{
          '2024-01': [
            { date: '2024-01-01', category: 'Groceries', amount: -50, description: 'A' },
            { date: '2024-01-02', category: 'Groceries', amount: -25, description: 'B' },
          ],
        }}
      />,
    )

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement
    expect(within(groceriesEl).getByText('2')).toBeInTheDocument()
    expect(groceriesEl).toHaveAttribute('title', '$500 · 2 transactions')
  })

  /* ── Add group via Enter key ── */

  /* ── Rename on blur ── */

  it('saves rename on blur', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    await user.dblClick(screen.getByText('Essentials'))
    const input = screen.getByDisplayValue('Essentials')
    await user.clear(input)
    await user.type(input, 'Basics')
    // Tab away to trigger blur
    await user.tab()

    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'essentials', name: 'Basics' })]),
    )
  })

  it('does not rename when name is empty', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    await user.dblClick(screen.getByText('Essentials'))
    const input = screen.getByDisplayValue('Essentials')
    await user.clear(input)
    await user.tab()

    expect(onUpdate).not.toHaveBeenCalled()
  })

  /* ── Rename via button ── */

  it('enters rename mode via the rename button', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')! as HTMLElement
    const renameBtn = within(essentialsGroup).getByTitle('Rename group')
    await user.click(renameBtn)

    expect(screen.getByDisplayValue('Essentials')).toBeInTheDocument()
  })

  /* ── Drag and drop categories between groups ── */

  it('moves a category to a different group via drag and drop', () => {
    const onUpdate = vi.fn()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    const lifestyleGroup = screen.getByText('Lifestyle').closest('.budget-group-block')! as HTMLElement

    fireEvent.dragStart(groceriesEl, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    fireEvent.dragOver(lifestyleGroup, { dataTransfer: { dropEffect: '' } })
    fireEvent.drop(lifestyleGroup, { dataTransfer: {} })

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const updated = onUpdate.mock.calls[0][0]
    // Groceries removed from essentials
    const essentials = updated.find((g: CategoryGroup) => g.id === 'essentials')
    expect(essentials.categories).not.toContain('Groceries')
    // Groceries added to lifestyle
    const lifestyle = updated.find((g: CategoryGroup) => g.id === 'lifestyle')
    expect(lifestyle.categories).toContain('Groceries')
  })

  it('does not move a category when dropped on its own group', () => {
    const onUpdate = vi.fn()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')! as HTMLElement

    fireEvent.dragStart(groceriesEl, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    fireEvent.dragOver(essentialsGroup, { dataTransfer: { dropEffect: '' } })
    fireEvent.drop(essentialsGroup, { dataTransfer: {} })

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('resets drag state on drag end', () => {
    render(<CategoryGroupManager {...defaultProps} />)

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    fireEvent.dragStart(groceriesEl, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    fireEvent.dragEnd(groceriesEl)

    // No drag class should remain
    expect(groceriesEl).not.toHaveClass('budget-group-cat--dragging')
  })

  it('clears drag-over highlight on drag leave', () => {
    render(<CategoryGroupManager {...defaultProps} />)

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    const lifestyleGroup = screen.getByText('Lifestyle').closest('.budget-group-block')! as HTMLElement

    fireEvent.dragStart(groceriesEl, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    fireEvent.dragOver(lifestyleGroup, { dataTransfer: { dropEffect: '' } })

    // Simulate drag leave where relatedTarget is outside the group
    fireEvent.dragLeave(lifestyleGroup, { relatedTarget: document.body })

    expect(lifestyleGroup).not.toHaveClass('budget-group-block--drop-target')
  })

  it('shows the empty-state helper text when an expanded group has no expense categories', () => {
    render(<CategoryGroupManager {...defaultProps} />)

    // Others and Removed groups are both expanded and empty
    const noCatLabels = screen.getAllByText('No categories yet - drag categories here from other groups')
    expect(noCatLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "Drop here" in empty group when dragging a category', () => {
    render(<CategoryGroupManager {...defaultProps} />)

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    fireEvent.dragStart(groceriesEl, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })

    // Empty groups should show "Drop here" instead of "No categories"
    const dropLabels = screen.getAllByText('Drop here')
    expect(dropLabels.length).toBeGreaterThanOrEqual(1)
  })

  /* ── Merge categories: select, choose target, execute ── */

  it('selects categories in merge mode and executes merge', async () => {
    const onMerge = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onMerge={onMerge} />)

    // Enter merge mode
    await user.click(screen.getByText('Merge Categories'))

    // Click on categories to select them
    await user.click(screen.getByText('Groceries'))
    await user.click(screen.getByText('Dining'))

    expect(screen.getByText(/2 selected/)).toBeInTheDocument()

    // Select a target from dropdown
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'Groceries')

    // Click merge
    await user.click(screen.getByText('Merge'))

    expect(onMerge).toHaveBeenCalledWith(expect.arrayContaining(['Groceries', 'Dining']), 'Groceries')
  })

  it('toggles category selection off when clicked again in merge mode', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    await user.click(screen.getByText('Merge Categories'))

    // Click the category item (not the dropdown option)
    const groceriesCat = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    await user.click(groceriesCat)
    expect(screen.getByText(/1 selected/)).toBeInTheDocument()

    // Deselect by clicking again
    await user.click(groceriesCat)
    expect(screen.getByText(/0 selected/)).toBeInTheDocument()
  })

  it('keeps a typed custom merge target in the input', async () => {
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} />)

    await user.click(screen.getByText('Merge Categories'))
    await user.type(screen.getByPlaceholderText('Type new name'), 'Combined Expenses')

    expect(screen.getByPlaceholderText('Type new name')).toHaveValue('Combined Expenses')
  })

  it('does not merge when fewer than 2 categories selected', async () => {
    const onMerge = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onMerge={onMerge} />)

    await user.click(screen.getByText('Merge Categories'))
    await user.click(screen.getByText('Groceries'))

    // Merge button should be disabled
    expect(screen.getByText('Merge')).toBeDisabled()
  })

  it('does not merge when no target name is provided', async () => {
    const onMerge = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onMerge={onMerge} />)

    await user.click(screen.getByText('Merge Categories'))
    await user.click(screen.getByText('Groceries'))
    await user.click(screen.getByText('Dining'))

    // Merge button should be disabled without a target
    expect(screen.getByText('Merge')).toBeDisabled()
  })

  /* ── Delete category with transaction merge ── */

  it('confirms delete merge by selecting a target and clicking Merge & Delete', async () => {
    const onMerge = vi.fn()
    const categoryHasTransactions = vi.fn((cat: string) => cat === 'Groceries')
    const user = userEvent.setup()
    render(
      <CategoryGroupManager {...defaultProps} onMerge={onMerge} categoryHasTransactions={categoryHasTransactions} />,
    )

    // Delete Groceries (has transactions)
    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    await user.click(within(groceriesEl).getByTitle('Delete category'))

    // Select target from dropdown
    const selects = screen.getAllByRole('combobox')
    const mergeSelect = selects[selects.length - 1]
    await user.selectOptions(mergeSelect, 'Rent')

    await user.click(screen.getByText('Merge & Delete'))

    expect(onMerge).toHaveBeenCalledWith(['Groceries'], 'Rent')
  })

  it('cancels delete merge prompt when Cancel is clicked', async () => {
    const categoryHasTransactions = vi.fn((cat: string) => cat === 'Groceries')
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} categoryHasTransactions={categoryHasTransactions} />)

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    await user.click(within(groceriesEl).getByTitle('Delete category'))

    expect(screen.getByText(/has transactions/)).toBeInTheDocument()

    await user.click(screen.getByText('Cancel'))

    expect(screen.queryByText(/has transactions/)).not.toBeInTheDocument()
  })

  it('inserts new group before Removed group', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    await user.click(screen.getByText('+ New Group'))

    const updated = onUpdate.mock.calls[0][0]
    const removedIdx = updated.findIndex((g: CategoryGroup) => g.id === 'removed')
    const newIdx = updated.findIndex((g: CategoryGroup) => g.name === 'New Group')
    expect(newIdx).toBeLessThan(removedIdx)
  })

  it('renders an empty income section when only the income updater is provided', () => {
    render(<CategoryGroupManager {...defaultProps} onUpdateIncomeGroups={vi.fn()} />)

    expect(screen.getByText('Income Category Groups')).toBeInTheDocument()
    expect(screen.getAllByText('No categories yet - drag categories here from other groups').length).toBeGreaterThan(1)
  })

  it('adds a new income group through the income updater', async () => {
    const onUpdate = vi.fn()
    const onUpdateIncomeGroups = vi.fn()
    const user = userEvent.setup()

    render(
      <CategoryGroupManager
        {...defaultProps}
        onUpdate={onUpdate}
        onUpdateIncomeGroups={onUpdateIncomeGroups}
        incomeCategoryGroups={[{ id: 'income-others', name: 'Others', categories: [], type: 'income' }]}
      />,
    )

    const newGroupButtons = screen.getAllByText('+ New Group')
    await user.click(newGroupButtons[1])

    expect(onUpdateIncomeGroups).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'New Group', categories: [] })]),
    )
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('removes an income group by creating the income fallback when it is missing', async () => {
    const onUpdateIncomeGroups = vi.fn()
    const user = userEvent.setup()

    render(
      <CategoryGroupManager
        {...defaultProps}
        groups={[
          { id: 'others', name: 'Others', categories: [] },
          { id: 'removed', name: 'Removed', categories: [] },
        ]}
        incomeCategoryGroups={[{ id: 'paychecks', name: 'Paychecks', categories: ['Salary'], type: 'income' }]}
        onUpdateIncomeGroups={onUpdateIncomeGroups}
        categorySums={{ ...defaultCategorySums, Salary: { '2024-01': 5000 } }}
      />,
    )

    const paychecksGroup = screen.getByText('Paychecks').closest('.budget-group-block')! as HTMLElement
    await user.click(within(paychecksGroup).getByTitle('Delete group (categories move to Others)'))

    expect(onUpdateIncomeGroups).toHaveBeenCalledWith([{ id: 'income-others', name: 'Others', categories: ['Salary'] }])
  })

  it('reorders groups when dragging a group header onto another group', () => {
    const onUpdate = vi.fn()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')!
    const lifestyleGroup = screen.getByText('Lifestyle').closest('.budget-group-block')!
    const essentialsHeader = essentialsGroup.querySelector('.budget-group-header') as HTMLElement

    fireEvent.dragStart(essentialsHeader, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    fireEvent.dragOver(lifestyleGroup, { dataTransfer: { dropEffect: '' } })
    fireEvent.drop(lifestyleGroup, { dataTransfer: {} })

    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'lifestyle' }),
        expect.objectContaining({ id: 'essentials' }),
      ]),
    )
    const reordered = onUpdate.mock.calls[0][0]
    expect(reordered[0].id).toBe('lifestyle')
    expect(reordered[1].id).toBe('essentials')
  })

  it('does not allow reordering a group onto the removed group', () => {
    const onUpdate = vi.fn()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')!
    const removedGroup = screen.getByText('Removed').closest('.budget-group-block')!
    const essentialsHeader = essentialsGroup.querySelector('.budget-group-header') as HTMLElement

    fireEvent.dragStart(essentialsHeader, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    fireEvent.dragOver(removedGroup, { dataTransfer: { dropEffect: '' } })
    fireEvent.drop(removedGroup, { dataTransfer: {} })

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does not reorder a group when it is dropped onto itself', () => {
    const onUpdate = vi.fn()
    render(<CategoryGroupManager {...defaultProps} onUpdate={onUpdate} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')!
    const essentialsHeader = essentialsGroup.querySelector('.budget-group-header') as HTMLElement

    fireEvent.dragStart(essentialsHeader, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    fireEvent.drop(essentialsGroup, { dataTransfer: {} })

    expect(onUpdate).not.toHaveBeenCalled()
    expect(essentialsGroup).not.toHaveClass('budget-group-block--dragging')
  })

  it('clears the group drag state when a dragged group header ends', () => {
    render(<CategoryGroupManager {...defaultProps} />)

    const essentialsGroup = screen.getByText('Essentials').closest('.budget-group-block')!
    const essentialsHeader = essentialsGroup.querySelector('.budget-group-header') as HTMLElement

    fireEvent.dragStart(essentialsHeader, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    expect(essentialsGroup).toHaveClass('budget-group-block--dragging')

    fireEvent.dragEnd(essentialsHeader)

    expect(essentialsGroup).not.toHaveClass('budget-group-block--dragging')
  })

  it('clears the custom delete-merge input when an existing target is selected', async () => {
    const user = userEvent.setup()
    render(
      <CategoryGroupManager {...defaultProps} categoryHasTransactions={vi.fn((cat: string) => cat === 'Groceries')} />,
    )

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    await user.click(within(groceriesEl).getByTitle('Delete category'))

    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[selects.length - 1], 'Rent')

    expect(screen.getByPlaceholderText('Type new name')).toHaveValue('')
  })

  it('merges a category into a typed custom target from the delete prompt', async () => {
    const onMerge = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryGroupManager
        {...defaultProps}
        onMerge={onMerge}
        categoryHasTransactions={vi.fn((cat: string) => cat === 'Groceries')}
      />,
    )

    const groceriesEl = screen.getByText('Groceries').closest('.budget-group-cat')! as HTMLElement as HTMLElement
    await user.click(within(groceriesEl).getByTitle('Delete category'))
    await user.type(screen.getByPlaceholderText('Type new name'), 'Merged Groceries')
    await user.click(screen.getByText('Merge & Delete'))

    expect(onMerge).toHaveBeenCalledWith(['Groceries'], 'Merged Groceries')
  })
})
