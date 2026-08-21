import { buildIndex, search, findMatchRange, getCategoryLabel } from './searchIndex'
import type { SearchItem, SearchCategory, SearchIndexData } from './searchIndex'
import type { FinancialGoal, GwGoal } from '../types'
import type { Account } from '../pages/data/types'

const goalsOf = (...goals: { id: number; goalName: string; progress?: number }[]) =>
  goals as unknown as FinancialGoal[]
const gwOf = (...gwGoals: { id: number; fiGoalId: number; label: string }[]) => gwGoals as unknown as GwGoal[]
const accountsOf = (...accounts: Partial<Account>[]) => accounts as Account[]

/* ─── buildIndex ─── */

describe('buildIndex', () => {
  it('returns static pages, commands, tools and settings when no data is supplied', () => {
    const items = buildIndex()

    const pages = items.filter(i => i.category === 'page')
    const commands = items.filter(i => i.category === 'command')
    const tools = items.filter(i => i.category === 'tool')
    const settings = items.filter(i => i.category === 'settings')

    expect(pages.length).toBeGreaterThan(0)
    expect(commands.length).toBeGreaterThan(0)
    expect(tools.length).toBeGreaterThan(0)
    expect(settings.length).toBeGreaterThan(0)

    // Verify known static pages — exhaustive list (no Tools page)
    expect(pages.map(p => p.label).sort()).toEqual([
      'Allocation',
      'Budget',
      'Drive',
      'Goals',
      'Growth',
      'Home',
      'Net Worth',
      'Taxes',
      'Transactions',
      'User Guide',
    ])

    // No dynamic items without supplied data
    expect(items.filter(i => i.category === 'goal')).toHaveLength(0)
    expect(items.filter(i => i.category === 'account')).toHaveLength(0)
    expect(items.filter(i => i.category === 'budget')).toHaveLength(0)
    expect(items.filter(i => i.category === 'tax')).toHaveLength(0)
    expect(items.filter(i => i.category === 'allocation')).toHaveLength(0)
  })

  it('includes the FI goals it is given', () => {
    const items = buildIndex({
      goals: goalsOf({ id: 1, goalName: 'Retire Early', progress: 42 }, { id: 2, goalName: 'Coast FI', progress: 80 }),
    })
    const goals = items.filter(i => i.category === 'goal')

    expect(goals).toHaveLength(2)
    expect(goals[0]).toMatchObject({
      id: 'goal-1',
      label: 'Retire Early',
      hint: 'FI Goal · 42% progress',
      route: '/goal',
    })
    expect(goals[1]).toMatchObject({
      id: 'goal-2',
      label: 'Coast FI',
      hint: 'FI Goal · 80% progress',
      route: '/goal',
    })
  })

  it('shows 0% progress when the progress field is missing', () => {
    const items = buildIndex({ goals: goalsOf({ id: 1, goalName: 'No Progress' }) })
    const goal = items.find(i => i.id === 'goal-1')
    expect(goal?.hint).toBe('FI Goal · 0% progress')
  })

  it('includes GW goals with parent goal hints', () => {
    const items = buildIndex({
      goals: goalsOf({ id: 10, goalName: 'Main Plan', progress: 50 }),
      gwGoals: gwOf({ id: 100, fiGoalId: 10, label: 'New Car Fund' }, { id: 101, fiGoalId: 999, label: 'Orphan GW' }),
    })
    const gwItems = items.filter(i => i.id.startsWith('gw-'))

    expect(gwItems).toHaveLength(2)

    const linked = gwItems.find(i => i.id === 'gw-100')!
    expect(linked.hint).toBe('GW under Main Plan')
    expect(linked.route).toBe('/goal')
    expect(linked.icon).toBe('flag')

    const orphan = gwItems.find(i => i.id === 'gw-101')!
    expect(orphan.hint).toBe('Glide-path withdrawal')
    expect(orphan.route).toBe('/goal')
  })

  it('includes accounts', () => {
    const items = buildIndex({
      accounts: accountsOf(
        { id: 1, name: 'Vanguard 401k', institution: 'Vanguard', group: 'Retirement', type: 'retirement' },
        { id: 2, name: 'Chase Checking', institution: '', group: '', type: undefined },
      ),
    })
    const accounts = items.filter(i => i.category === 'account')

    expect(accounts).toHaveLength(2)
    expect(accounts[0]).toMatchObject({
      id: 'account-1',
      label: 'Vanguard 401k',
      hint: 'Vanguard · Retirement · retirement',
      route: '/net-worth',
    })
    // Empty strings are filtered from the hint
    expect(accounts[1].hint).toBe('')
  })

  it('includes budget categories and groups', () => {
    const items = buildIndex({
      categoryGroups: [
        { id: 'housing', name: 'Housing', categories: ['Rent', 'Utilities'] },
        { id: 'food', name: 'Food', categories: ['Groceries'] },
        { id: 'removed', name: 'Removed', categories: ['Deleted Stuff'] },
      ],
    })
    const budgetItems = items.filter(i => i.category === 'budget')

    // Should have 2 groups + 3 categories (removed group is skipped)
    const groups = budgetItems.filter(i => i.id.startsWith('budget-group-'))
    const cats = budgetItems.filter(i => i.id.startsWith('budget-cat-'))

    expect(groups).toHaveLength(2)
    expect(cats).toHaveLength(3)

    expect(groups[0]).toMatchObject({
      label: 'Housing',
      hint: 'Budget group · 2 categories',
    })
    expect(cats.map(c => c.label)).toEqual(expect.arrayContaining(['Rent', 'Utilities', 'Groceries']))

    // Categories reference their parent group in hint
    const rent = cats.find(c => c.label === 'Rent')!
    expect(rent.hint).toBe('in Housing')

    // "removed" group should be excluded
    expect(budgetItems.find(i => i.label === 'Removed')).toBeUndefined()
  })

  it('includes tax items and templates', () => {
    const items = buildIndex({
      taxYears: {
        '2025': {
          items: [
            { id: 'w2-main', label: 'W-2 from Employer', owner: 'primary' },
            { id: '1099-div', label: '1099-DIV Dividends' },
          ],
        },
      },
      taxTemplates: [{ id: 'tpl-1', name: 'Basic Filing' }],
    })
    const taxItems = items.filter(i => i.category === 'tax')

    expect(taxItems).toHaveLength(3) // 2 items + 1 template

    const w2 = taxItems.find(i => i.id === 'tax-2025-w2-main')!
    expect(w2).toMatchObject({
      label: 'W-2 from Employer',
      hint: '2025 · primary',
    })

    const div = taxItems.find(i => i.id === 'tax-2025-1099-div')!
    expect(div.hint).toBe('2025 · joint') // default owner

    const tpl = taxItems.find(i => i.id === 'tax-tpl-tpl-1')!
    expect(tpl).toMatchObject({
      label: 'Basic Filing',
      hint: 'Tax template',
    })
    expect(tpl.keywords).toContain('template')
  })

  it('includes allocation custom ratios', () => {
    const items = buildIndex({
      allocationRatios: [
        { id: 'r1', name: 'Aggressive Growth', scope: 'retirement' },
        { id: 'r2', name: 'Conservative', scope: undefined },
      ],
    })
    const allocs = items.filter(i => i.category === 'allocation')

    expect(allocs).toHaveLength(2)
    expect(allocs[0]).toMatchObject({
      id: 'ratio-r1',
      label: 'Aggressive Growth',
      hint: 'Custom ratio · retirement',
    })
    // Undefined scope falls back to 'total'
    expect(allocs[1].hint).toBe('Custom ratio · total')
  })

  it('tolerates partially-supplied data without throwing', () => {
    const partial: SearchIndexData = { goals: goalsOf(), taxYears: { '2025': {} } }

    expect(() => buildIndex(partial)).not.toThrow()

    const items = buildIndex(partial)
    // Static items still returned
    expect(items.filter(i => i.category === 'page').length).toBeGreaterThan(0)
    // Dynamic items are empty (corrupt data ignored)
    expect(items.filter(i => i.category === 'goal')).toHaveLength(0)
    expect(items.filter(i => i.category === 'account')).toHaveLength(0)
    expect(items.filter(i => i.category === 'budget')).toHaveLength(0)
    expect(items.filter(i => i.category === 'tax')).toHaveLength(0)
    expect(items.filter(i => i.category === 'allocation')).toHaveLength(0)
  })

  it('does not include a page-tools entry (Tools page removed)', () => {
    const items = buildIndex()
    expect(items.find(i => i.id === 'page-tools')).toBeUndefined()

    // 'tool' category still exists for FI Calc, Growth Tracker, PDF→CSV
    const tools = items.filter(i => i.category === 'tool')
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.map(t => t.id)).not.toContain('page-tools')
  })
})

/* ─── search ─── */

describe('search', () => {
  let index: SearchItem[]

  beforeEach(() => {
    index = buildIndex({
      goals: goalsOf({ id: 1, goalName: 'Retire Early', progress: 50 }, { id: 2, goalName: 'Coast FI', progress: 80 }),
      accounts: accountsOf({
        id: 1,
        name: 'Vanguard 401k',
        institution: 'Vanguard',
        group: 'Retirement',
        type: 'retirement',
      }),
    })
  })

  it('returns pages + commands for empty query', () => {
    const groups = search(index, '')
    const categories = groups.map(g => g.category)

    expect(categories).toContain('page')
    expect(categories).toContain('command')
    expect(categories).not.toContain('goal')
    expect(categories).not.toContain('account')
  })

  it('returns pages + commands for whitespace-only query', () => {
    const groups = search(index, '   ')
    const categories = groups.map(g => g.category)

    expect(categories).toContain('page')
    expect(categories).toContain('command')
  })

  it('exact match scores highest', () => {
    const groups = search(index, 'Home')
    const pageGroup = groups.find(g => g.category === 'page')!
    expect(pageGroup.items[0].label).toBe('Home')
  })

  it('starts-with ranks higher than contains', () => {
    // "Budget" starts with "bud"; other items may contain "bud" in hints/keywords
    const groups = search(index, 'bud')
    const pageGroup = groups.find(g => g.category === 'page')!
    expect(pageGroup.items[0].label).toBe('Budget')
  })

  it('keyword matches work (e.g., searching "fire" matches Goals page)', () => {
    const groups = search(index, 'fire')
    const allItems = groups.flatMap(g => g.items)

    // Goals page has 'fire' in keywords
    const goalsPage = allItems.find(i => i.id === 'page-goals')
    expect(goalsPage).toBeDefined()
  })

  it('returns empty groups array for no matches', () => {
    const groups = search(index, 'zzzzxyznonexistent')
    expect(groups).toHaveLength(0)
  })

  it('respects maxPerGroup cap', () => {
    // Add many goals to test the cap
    const bigIndex = buildIndex({
      goals: goalsOf(...Array.from({ length: 10 }, (_, i) => ({ id: i + 100, goalName: `TestGoal ${i}`, progress: i * 10 }))),
    })
    const groups = search(bigIndex, 'TestGoal', 3)
    const goalGroup = groups.find(g => g.category === 'goal')!

    expect(goalGroup.items).toHaveLength(3)
    expect(goalGroup.total).toBe(10) // total reflects all matches
  })

  it('is case insensitive', () => {
    const lower = search(index, 'home')
    const upper = search(index, 'HOME')
    const mixed = search(index, 'hOmE')

    const getPageLabels = (groups: ReturnType<typeof search>) =>
      groups.find(g => g.category === 'page')?.items.map(i => i.label) ?? []

    expect(getPageLabels(lower)).toContain('Home')
    expect(getPageLabels(upper)).toContain('Home')
    expect(getPageLabels(mixed)).toContain('Home')
  })

  it('groups results in correct category order', () => {
    // Search for something that hits multiple categories
    // "retirement" appears in FI calculator keywords and in account hint
    const multiIndex = buildIndex({ goals: goalsOf({ id: 1, goalName: 'Retirement Plan', progress: 30 }) })
    const groups = search(multiIndex, 'retirement')
    const categories = groups.map(g => g.category)

    // Verify order matches CATEGORY_ORDER: page, command, goal, account, ...tool, settings
    const ORDER: SearchCategory[] = [
      'page',
      'command',
      'goal',
      'account',
      'budget',
      'tax',
      'allocation',
      'tool',
      'settings',
    ]
    const filtered = ORDER.filter(c => categories.includes(c))
    expect(categories).toEqual(filtered)
  })

  it('matches on hint text', () => {
    const groups = search(index, 'dashboard')
    const allItems = groups.flatMap(g => g.items)
    // Home page has hint 'Dashboard overview'
    expect(allItems.find(i => i.id === 'page-home')).toBeDefined()
  })

  it('maxPerGroup defaults to 5', () => {
    const bigIndex = buildIndex({
      goals: goalsOf(...Array.from({ length: 10 }, (_, i) => ({ id: i + 200, goalName: `Alpha ${i}`, progress: 0 }))),
    })
    const groups = search(bigIndex, 'Alpha')
    const goalGroup = groups.find(g => g.category === 'goal')!

    expect(goalGroup.items).toHaveLength(5)
    expect(goalGroup.total).toBe(10)
  })
})

/* ─── findMatchRange ─── */

describe('findMatchRange', () => {
  it('returns correct indices for a match at the start', () => {
    expect(findMatchRange('Hello World', 'Hello')).toEqual([0, 5])
  })

  it('returns correct indices for a match in the middle', () => {
    expect(findMatchRange('Hello World', 'lo Wo')).toEqual([3, 8])
  })

  it('returns correct indices for a match at the end', () => {
    expect(findMatchRange('Hello World', 'World')).toEqual([6, 11])
  })

  it('is case insensitive', () => {
    expect(findMatchRange('Hello World', 'hello')).toEqual([0, 5])
    expect(findMatchRange('Hello World', 'WORLD')).toEqual([6, 11])
  })

  it('returns null for no match', () => {
    expect(findMatchRange('Hello World', 'xyz')).toBeNull()
  })

  it('returns null for empty query', () => {
    expect(findMatchRange('Hello World', '')).toBeNull()
  })

  it('handles single character match', () => {
    expect(findMatchRange('abc', 'b')).toEqual([1, 2])
  })

  it('returns first occurrence for repeated text', () => {
    expect(findMatchRange('abcabc', 'abc')).toEqual([0, 3])
  })
})

/* ─── getCategoryLabel ─── */

describe('getCategoryLabel', () => {
  it.each([
    ['page', 'Pages'],
    ['command', 'Commands'],
    ['goal', 'Goals'],
    ['account', 'Accounts'],
    ['budget', 'Budget'],
    ['tax', 'Taxes'],
    ['allocation', 'Allocation'],
    ['tool', 'Tools'],
    ['settings', 'Settings'],
  ] as const)('returns "%s" → "%s"', (cat, expected) => {
    expect(getCategoryLabel(cat)).toBe(expected)
  })
})

/* ─── PDF → CSV search item ─── */

describe('PDF → CSV search index entry', () => {
  it('routes tool-pdf-csv to /budget', () => {
    const items = buildIndex()
    const pdfTool = items.find(i => i.id === 'tool-pdf-csv')
    expect(pdfTool).toBeDefined()
    expect(pdfTool!.route).toBe('/budget')
  })

  it('has correct label and category for PDF → CSV', () => {
    const items = buildIndex()
    const pdfTool = items.find(i => i.id === 'tool-pdf-csv')!
    expect(pdfTool.label).toBe('PDF → CSV')
    expect(pdfTool.category).toBe('tool')
  })
})
