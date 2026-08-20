import { describe, it, expect } from 'vitest'
import { MemoryFileStore } from '../../utils/memoryFileStore'
import { buildDriveTree } from './buildBudgetTree'

const EMPTY_PROFILE = {}
const NO_ACCOUNTS: never[] = []

describe('buildDriveTree', () => {
  it('returns empty root Drive folder when no budget or tax data', async () => {
    const fs = new MemoryFileStore()
    const tree = await buildDriveTree(fs, NO_ACCOUNTS, EMPTY_PROFILE)
    expect(tree.name).toBe('Drive')
    expect(tree.slug).toBe('')
    expect(tree.files).toEqual([])
    expect(tree.folders.find(f => f.slug === 'budget')).toBeUndefined()
    expect(tree.folders).toHaveLength(0)
  })

  it('builds year folders from budget CSVs', async () => {
    const fs = new MemoryFileStore()
    await fs.writeJSON('budget/categories.json', {
      version: 1,
      years: [2024, 2025],
      categoryGroups: [
        { id: 'others', name: 'Others', categories: [] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
      ],
    })
    await fs.writeCSV('transactions/2025/2025-01.csv', [['date', 'amount'], ['a', '1']])
    await fs.writeCSV('transactions/2025/2025-02.csv', [['date', 'amount'], ['b', '2']])
    await fs.writeCSV('transactions/2024/2024-12.csv', [['date', 'amount'], ['c', '3']])

    const tree = await buildDriveTree(fs, NO_ACCOUNTS, EMPTY_PROFILE)
    const budget = tree.folders.find(f => f.slug === 'budget')!

    expect(budget.folders).toHaveLength(2)
    expect(budget.folders[0].name).toBe('2025')
    expect(budget.folders[1].name).toBe('2024')

    const yr2025 = budget.folders.find(f => f.slug === '2025')!
    expect(yr2025.files).toHaveLength(2)
    expect(yr2025.files[0].slug).toBe('2025-01')
    expect(yr2025.files[1].slug).toBe('2025-02')

    const yr2024 = budget.folders.find(f => f.slug === '2024')!
    expect(yr2024.files).toHaveLength(1)
  })

  it('includes tax folder only when tax data has files', async () => {
    const fs = new MemoryFileStore()
    const tree = await buildDriveTree(fs, NO_ACCOUNTS, EMPTY_PROFILE)
    expect(tree.folders.find(f => f.slug === 'taxes')).toBeUndefined()
  })

  it('includes tax folder when tax store has files', async () => {
    const fs = new MemoryFileStore()
    await fs.writeJSON('taxes/2024.json', {
      items: [
        {
          id: '1',
          label: 'W-2',
          owner: 'primary',
          category: 'paystub',
          accountIds: [],
          files: [{ id: 'f1', name: 'w2.pdf', content: 'data', ext: 'pdf', uploadedAt: '2025-01-01' }],
        },
      ],
    })

    const tree = await buildDriveTree(fs, NO_ACCOUNTS, EMPTY_PROFILE)
    const taxes = tree.folders.find(f => f.slug === 'taxes')
    expect(taxes).toBeTruthy()
    expect(taxes!.folders).toHaveLength(1)
  })

  it('includes Budget folder only when budget files exist', async () => {
    const fs = new MemoryFileStore()
    const tree1 = await buildDriveTree(fs, NO_ACCOUNTS, EMPTY_PROFILE)
    expect(tree1.folders.find(f => f.slug === 'budget')).toBeUndefined()

    await fs.writeJSON('budget/categories.json', {
      version: 1,
      years: [2025],
      categoryGroups: [
        { id: 'others', name: 'Others', categories: [] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
      ],
    })
    await fs.writeCSV('transactions/2025/2025-01.csv', [['date', 'amount'], ['a', '1']])

    const tree2 = await buildDriveTree(fs, NO_ACCOUNTS, EMPTY_PROFILE)
    const budget = tree2.folders.find(f => f.slug === 'budget')
    expect(budget).toBeTruthy()
    expect(budget!.folders).toHaveLength(1)
  })
})
