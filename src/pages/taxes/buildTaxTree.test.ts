import { describe, it, expect } from 'vitest'
import { buildTaxTree } from './buildTaxTree'
import type { TaxStore, TaxYear } from './types'
import type { Account } from '../data/types'

// buildTaxTree is now a pure function: buildTaxTree(store, accounts, profile)

const EMPTY_STORE: TaxStore = { years: {} }

describe('buildTaxTree', () => {
  it('returns empty tree when no tax data stored', () => {
    const tree = buildTaxTree(EMPTY_STORE, [], {})
    expect(tree.name).toBe('Taxes')
    expect(tree.slug).toBe('taxes')
    expect(tree.folders).toEqual([])
    expect(tree.files).toEqual([])
  })

  it('returns empty tree when tax store has no years', () => {
    const tree = buildTaxTree({ years: {} }, [], {})
    expect(tree.folders).toEqual([])
  })

  it('builds year folders with files from checklist items', () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            {
              id: '1',
              label: 'W-2',
              owner: 'primary',
              category: 'paystub',
              accountIds: [],
              files: [{ id: 'f1', name: 'w2-2024.pdf', content: 'base64data', ext: 'pdf', uploadedAt: '2025-01-15' }],
            },
          ],
        } as TaxYear,
      },
    }
    const tree = buildTaxTree(store, [], { name: 'Jane' })
    expect(tree.folders).toHaveLength(1)
    expect(tree.folders[0].name).toBe('2024')
    expect(tree.folders[0].files).toHaveLength(1)
    expect(tree.folders[0].files[0].name).toBe('w2-2024.pdf')
    expect(tree.folders[0].files[0].ext).toBe('pdf')
    expect(tree.folders[0].files[0].meta?.owner).toBe('Jane')
    expect(tree.folders[0].files[0].meta?.category).toBe('Paystub')
  })

  it('includes account names in file meta', () => {
    const accounts = [
      { id: 1, name: 'Fidelity 401k' },
      { id: 2, name: 'Vanguard IRA' },
    ] as Account[]
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            {
              id: '1',
              label: 'Statements',
              owner: 'primary',
              category: 'account',
              accountIds: [1, 2],
              files: [{ id: 'f1', name: 'stmt.pdf', content: 'data', ext: 'pdf', uploadedAt: '2025-01-01' }],
            },
          ],
        },
      },
    }
    const tree = buildTaxTree(store, accounts, {})
    const file = tree.folders[0].files[0]
    expect(file.meta?.accounts).toBe('Fidelity 401k, Vanguard IRA')
  })

  it('sorts year folders in descending order', () => {
    const store: TaxStore = {
      years: {
        2022: {
          items: [
            { id: '1', label: 'A', owner: 'primary', category: 'custom', accountIds: [],
              files: [{ id: 'f1', name: 'a', content: 'x', ext: 'csv', uploadedAt: 't' }] },
          ],
        },
        2024: {
          items: [
            { id: '2', label: 'B', owner: 'primary', category: 'custom', accountIds: [],
              files: [{ id: 'f2', name: 'b', content: 'x', ext: 'csv', uploadedAt: 't' }] },
          ],
        },
        2023: {
          items: [
            { id: '3', label: 'C', owner: 'primary', category: 'custom', accountIds: [],
              files: [{ id: 'f3', name: 'c', content: 'x', ext: 'csv', uploadedAt: 't' }] },
          ],
        },
      },
    }
    const tree = buildTaxTree(store, [], {})
    expect(tree.folders.map(f => f.name)).toEqual(['2024', '2023', '2022'])
  })

  it('skips years with no files (only empty checklist items)', () => {
    const store: TaxStore = {
      years: {
        2024: { items: [{ id: '1', label: 'Empty', owner: 'primary', category: 'custom', accountIds: [], files: [] }] },
        2025: {
          items: [
            { id: '2', label: 'Has File', owner: 'primary', category: 'custom', accountIds: [],
              files: [{ id: 'f1', name: 'doc.pdf', content: 'x', ext: 'pdf', uploadedAt: 't' }] },
          ],
        },
      },
    }
    const tree = buildTaxTree(store, [], {})
    expect(tree.folders).toHaveLength(1)
    expect(tree.folders[0].name).toBe('2025')
  })

  it('maps partner owner correctly', () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            { id: '1', label: 'W-2', owner: 'partner', category: 'paystub', accountIds: [],
              files: [{ id: 'f1', name: 'w2.pdf', content: 'x', ext: 'pdf', uploadedAt: 't' }] },
          ],
        },
      },
    }
    const tree = buildTaxTree(store, [], { name: 'Jane', partner: { name: 'John' } })
    expect(tree.folders[0].files[0].meta?.owner).toBe('John')
  })

  it('falls back to "Primary" if profile has no name', () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            { id: '1', label: 'Doc', owner: 'primary', category: 'custom', accountIds: [],
              files: [{ id: 'f1', name: 'x.pdf', content: 'x', ext: 'pdf', uploadedAt: 't' }] },
          ],
        },
      },
    }
    const tree = buildTaxTree(store, [], {})
    expect(tree.folders[0].files[0].meta?.owner).toBe('Primary')
  })

  it('returns undefined category for unknown category values', () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            { id: '1', label: 'Doc', owner: 'primary', category: 'unknown-category' as never, accountIds: [],
              files: [{ id: 'f1', name: 'x.pdf', content: 'x', ext: 'pdf', uploadedAt: 't' }] },
          ],
        },
      },
    }
    const tree = buildTaxTree(store, [], {})
    expect(tree.folders[0].files[0].meta?.category).toBeUndefined()
  })

  it('returns "Joint" for owner values that are neither primary nor partner', () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            { id: '1', label: 'Joint Doc', owner: 'joint', category: 'paystub', accountIds: [],
              files: [{ id: 'f1', name: 'joint.pdf', content: 'x', ext: 'pdf', uploadedAt: 't' }] },
          ],
        },
      },
    }
    const tree = buildTaxTree(store, [], { name: 'Test' })
    expect(tree.folders[0].files[0].meta?.owner).toBe('Joint')
  })

  it('falls back to "Partner" when partner name is empty', () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            { id: '1', label: 'Doc', owner: 'partner', category: 'paystub', accountIds: [],
              files: [{ id: 'f1', name: 'a.pdf', content: 'x', ext: 'pdf', uploadedAt: 't' }] },
          ],
        },
      },
    }
    const tree = buildTaxTree(store, [], { partner: { name: '' } })
    expect(tree.folders[0].files[0].meta?.owner).toBe('Partner')
  })

  it('defaults content to empty string when file.content is undefined', () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            {
              id: '1',
              label: 'Doc',
              owner: 'primary',
              category: 'paystub',
              accountIds: [],
              files: [
                { id: 'f1', name: 'a.pdf', ext: 'pdf', uploadedAt: 't', content: undefined as unknown as string },
              ],
            },
          ],
        },
      },
    }
    const tree = buildTaxTree(store, [], { name: 'Me' })
    expect(tree.folders[0].files[0].content).toBe('')
  })

  it('handles year with no items array (falsy branch)', () => {
    const store = { years: { 2024: {} as TaxYear } }
    const tree = buildTaxTree(store, [], { name: 'Me' })
    expect(tree.folders).toHaveLength(0)
  })
})
