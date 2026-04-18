import { describe, it, expect, beforeEach } from 'vitest'
import { buildDriveTree } from './buildBudgetTree'

beforeEach(() => {
  localStorage.clear()
})

describe('buildDriveTree', () => {
  it('returns root Drive folder with Budget subfolder when no data', () => {
    const tree = buildDriveTree()
    expect(tree.name).toBe('Drive')
    expect(tree.slug).toBe('')
    expect(tree.files).toEqual([])
    // Should have at least Budget folder
    const budget = tree.folders.find(f => f.slug === 'budget')
    expect(budget).toBeTruthy()
    expect(budget!.name).toBe('Budget')
  })

  it('builds year folders from budget CSVs', () => {
    const store = {
      csvs: {
        '2025-01': { month: '2025-01', csv: 'date,amount\na,1', uploadedAt: '2025-01-15' },
        '2025-02': { month: '2025-02', csv: 'date,amount\nb,2', uploadedAt: '2025-02-15' },
        '2024-12': { month: '2024-12', csv: 'date,amount\nc,3', uploadedAt: '2024-12-20' },
      },
      configs: {},
      years: [2024, 2025],
    }
    localStorage.setItem('budget-store', JSON.stringify(store))
    // Need budget-config too to avoid migration side effects
    localStorage.setItem('budget-config', JSON.stringify({
      version: 1, years: [2024, 2025],
      categoryGroups: [
        { id: 'others', name: 'Others', categories: [] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
      ],
    }))

    const tree = buildDriveTree()
    const budget = tree.folders.find(f => f.slug === 'budget')!
    
    // Should have year folders sorted descending
    expect(budget.folders.length).toBeGreaterThanOrEqual(2)
    expect(budget.folders[0].name).toBe('2025')
    expect(budget.folders[1].name).toBe('2024')

    // 2025 should have 2 files
    const yr2025 = budget.folders.find(f => f.slug === '2025')!
    expect(yr2025.files).toHaveLength(2)
    // Files should be sorted by slug (month key)
    expect(yr2025.files[0].slug).toBe('2025-01')
    expect(yr2025.files[1].slug).toBe('2025-02')

    // 2024 should have 1 file
    const yr2024 = budget.folders.find(f => f.slug === '2024')!
    expect(yr2024.files).toHaveLength(1)
  })

  it('includes tax folder only when tax data has files', () => {
    // No tax data → should not include taxes folder
    const tree = buildDriveTree()
    const taxes = tree.folders.find(f => f.slug === 'taxes')
    expect(taxes).toBeUndefined()
  })

  it('includes tax folder when tax store has files', () => {
    const taxStore = {
      years: {
        2024: {
          items: [{
            id: '1', label: 'W-2', owner: 'primary', category: 'paystub', accountIds: [],
            files: [{ id: 'f1', name: 'w2.pdf', content: 'data', ext: 'pdf', uploadedAt: '2025-01-01' }],
          }],
        },
      },
    }
    localStorage.setItem('tax-store', JSON.stringify(taxStore))

    const tree = buildDriveTree()
    const taxes = tree.folders.find(f => f.slug === 'taxes')
    expect(taxes).toBeTruthy()
    expect(taxes!.folders).toHaveLength(1)
  })
})
