/**
 * Universal search index — reads all app data from localStorage,
 * builds a flat list of searchable items, and filters/ranks by query.
 */

import type { FinancialGoal, GwGoal } from '../types'
import type { Account } from '../pages/data/types'
import type { CategoryGroup } from '../pages/budget/types'

/* ─── Types ─── */

export type SearchCategory =
  | 'page'
  | 'command'
  | 'goal'
  | 'account'
  | 'budget'
  | 'tax'
  | 'allocation'
  | 'tool'
  | 'settings'

export interface SearchItem {
  id: string
  category: SearchCategory
  label: string
  hint: string
  icon: string
  keywords: string[]
  /** Navigation path, or empty for action-only items */
  route: string
  /** For action-only items (e.g., toggle dark mode) */
  actionId?: string
}

export interface SearchGroup {
  category: SearchCategory
  label: string
  items: SearchItem[]
  total: number
}

/* ─── Category display order & labels ─── */

const CATEGORY_ORDER: SearchCategory[] = [
  'page', 'command', 'goal', 'account', 'budget', 'tax', 'allocation', 'tool', 'settings',
]

const CATEGORY_LABELS: Record<SearchCategory, string> = {
  page: 'Pages',
  command: 'Commands',
  goal: 'Goals',
  account: 'Accounts',
  budget: 'Budget',
  tax: 'Taxes',
  allocation: 'Allocation',
  tool: 'Tools',
  settings: 'Settings',
}

export const getCategoryLabel = (cat: SearchCategory): string => CATEGORY_LABELS[cat]

/* ─── Static items (always available) ─── */

const STATIC_PAGES: SearchItem[] = [
  { id: 'page-home', category: 'page', label: 'Home', hint: 'Dashboard overview', icon: 'home', keywords: ['home', 'dashboard', 'overview'], route: '/' },
  { id: 'page-goals', category: 'page', label: 'Goals', hint: 'FI goal plans', icon: 'target', keywords: ['goals', 'fi', 'financial independence', 'fire'], route: '/goal' },
  { id: 'page-net-worth', category: 'page', label: 'Net Worth', hint: 'Accounts & balances', icon: 'chart', keywords: ['data', 'accounts', 'balances', 'net worth'], route: '/net-worth' },
  { id: 'page-budget', category: 'page', label: 'Budget', hint: 'Monthly spending', icon: 'dollar', keywords: ['budget', 'spending', 'expenses', 'income'], route: '/budget' },
  { id: 'page-allocation', category: 'page', label: 'Allocation', hint: 'Asset allocation & rebalance', icon: 'scale', keywords: ['allocation', 'rebalance', 'asset', 'portfolio'], route: '/net-worth/allocation' },
  { id: 'page-taxes', category: 'page', label: 'Taxes', hint: 'Tax document checklist', icon: 'clipboard', keywords: ['taxes', 'tax', 'checklist', 'w2', '1099'], route: '/taxes' },
  { id: 'page-tools', category: 'page', label: 'Tools', hint: 'Calculators & utilities', icon: 'wrench', keywords: ['tools', 'calculator', 'utilities'], route: '/tools' },
  { id: 'page-drive', category: 'page', label: 'Drive', hint: 'Uploaded files', icon: 'folder', keywords: ['drive', 'files', 'uploads', 'documents'], route: '/drive' },
]

const STATIC_COMMANDS: SearchItem[] = [
  { id: 'cmd-dark-mode', category: 'command', label: 'Toggle Dark Mode', hint: 'Switch between light and dark', icon: 'moon', keywords: ['dark mode', 'light mode', 'theme', 'appearance'], route: '', actionId: 'toggle-dark-mode' },
  { id: 'cmd-settings', category: 'command', label: 'Open Settings', hint: 'App preferences', icon: 'gear', keywords: ['settings', 'preferences', 'config'], route: '', actionId: 'open-settings' },
  { id: 'cmd-profile', category: 'command', label: 'Open Profile', hint: 'Edit name & avatar', icon: 'user', keywords: ['profile', 'name', 'avatar'], route: '', actionId: 'open-profile' },
  { id: 'cmd-new-goal', category: 'command', label: 'New Goal', hint: 'Create a new FI goal', icon: 'plus', keywords: ['new goal', 'add goal', 'create goal'], route: '/goal', actionId: 'new-goal' },
  { id: 'cmd-demo', category: 'command', label: 'Toggle Demo Mode', hint: 'Show sample data for demos', icon: 'play', keywords: ['demo', 'sample data', 'demo mode'], route: '', actionId: 'toggle-demo' },
  { id: 'cmd-export', category: 'command', label: 'Export Data', hint: 'Download a JSON backup', icon: 'download', keywords: ['export', 'backup', 'download'], route: '', actionId: 'export-data' },
]

const STATIC_TOOLS: SearchItem[] = [
  { id: 'tool-fi-calc', category: 'tool', label: 'FI Calculator', hint: 'Estimate FI readiness', icon: 'calculator', keywords: ['fi calculator', 'financial independence', 'fire', 'retirement'], route: '/goal/calculator' },
  { id: 'tool-savings-growth', category: 'tool', label: 'Growth Tracker', hint: 'Break down savings vs. capital gains', icon: 'trending', keywords: ['savings', 'growth', 'tracker', 'capital gains'], route: '/net-worth/growth' },
  { id: 'tool-pdf-csv', category: 'tool', label: 'PDF → CSV', hint: 'Extract tables from PDFs', icon: 'file', keywords: ['pdf', 'csv', 'extract', 'convert'], route: '/budget' },
]

const STATIC_SETTINGS: SearchItem[] = [
  { id: 'settings-profile', category: 'settings', label: 'Profile Settings', hint: 'Name, avatar, birthday', icon: 'user', keywords: ['profile', 'name', 'avatar', 'birthday'], route: '', actionId: 'open-settings-profile' },
  { id: 'settings-github', category: 'settings', label: 'GitHub Sync', hint: 'Backup & sync to GitHub', icon: 'cloud', keywords: ['github', 'sync', 'backup', 'cloud'], route: '', actionId: 'open-settings-github' },
  { id: 'settings-appearance', category: 'settings', label: 'Appearance', hint: 'Theme, accent color', icon: 'palette', keywords: ['appearance', 'theme', 'color', 'accent'], route: '', actionId: 'open-settings-appearance' },
  { id: 'settings-advanced', category: 'settings', label: 'Advanced Settings', hint: 'Import, export, factory reset', icon: 'sliders', keywords: ['advanced', 'import', 'reset', 'csv import'], route: '', actionId: 'open-settings-advanced' },
  { id: 'settings-labs', category: 'settings', label: 'Labs', hint: 'Experimental features', icon: 'flask', keywords: ['labs', 'experimental', 'beta', 'demo mode'], route: '', actionId: 'open-settings-labs' },
]

/* ─── Dynamic index builders ─── */

function indexGoals(): SearchItem[] {
  const items: SearchItem[] = []
  try {
    const goals: FinancialGoal[] = JSON.parse(localStorage.getItem('financialGoals') || '[]')
    for (const g of goals) {
      items.push({
        id: `goal-${g.id}`,
        category: 'goal',
        label: g.goalName,
        hint: `FI Goal · ${g.progress ?? 0}% progress`,
        icon: 'target',
        keywords: [g.goalName.toLowerCase()],
        route: '/goal',
      })
    }

    const gwGoals: GwGoal[] = JSON.parse(localStorage.getItem('gw-goals') || '[]')
    for (const gw of gwGoals) {
      const parentGoal = goals.find(g => g.id === gw.fiGoalId)
      items.push({
        id: `gw-${gw.id}`,
        category: 'goal',
        label: gw.label,
        hint: parentGoal ? `GW under ${parentGoal.goalName}` : 'Glide-path withdrawal',
        icon: 'flag',
        keywords: [gw.label.toLowerCase()],
        route: '/goal',
      })
    }
  } catch { /* ignore corrupt data */ }
  return items
}

function indexAccounts(): SearchItem[] {
  const items: SearchItem[] = []
  try {
    const accounts: Account[] = JSON.parse(localStorage.getItem('data-accounts') || '[]')
    for (const a of accounts) {
      items.push({
        id: `account-${a.id}`,
        category: 'account',
        label: a.name,
        hint: [a.institution, a.group, a.type].filter(Boolean).join(' · '),
        icon: 'bank',
        keywords: [a.name, a.institution || '', a.group || '', a.type || ''].map(s => s.toLowerCase()),
        route: '/net-worth',
      })
    }
  } catch { /* ignore */ }
  return items
}

function indexBudgetCategories(): SearchItem[] {
  const items: SearchItem[] = []
  try {
    const config = JSON.parse(localStorage.getItem('budget-config') || '{}')
    const groups: CategoryGroup[] = config.categoryGroups || []
    for (const g of groups) {
      if (g.id === 'removed') continue
      items.push({
        id: `budget-group-${g.id}`,
        category: 'budget',
        label: g.name,
        hint: `Budget group · ${g.categories.length} categories`,
        icon: 'folder',
        keywords: [g.name.toLowerCase()],
        route: '/budget',
      })
      for (const cat of g.categories) {
        items.push({
          id: `budget-cat-${g.id}-${cat}`,
          category: 'budget',
          label: cat,
          hint: `in ${g.name}`,
          icon: 'tag',
          keywords: [cat.toLowerCase()],
          route: '/budget',
        })
      }
    }
  } catch { /* ignore */ }
  return items
}

function indexTaxItems(): SearchItem[] {
  const items: SearchItem[] = []
  try {
    const store = JSON.parse(localStorage.getItem('tax-store') || '{}')
    const years = store.years || {}
    for (const [year, data] of Object.entries(years)) {
      const yearData = data as { items?: { id: string; label: string; owner?: string }[] }
      for (const item of yearData.items || []) {
        items.push({
          id: `tax-${year}-${item.id}`,
          category: 'tax',
          label: item.label,
          hint: `${year} · ${item.owner || 'joint'}`,
          icon: 'clipboard',
          keywords: [item.label.toLowerCase(), year],
          route: '/taxes',
        })
      }
    }

    const templates = JSON.parse(localStorage.getItem('tax-templates') || '[]')
    for (const tpl of templates) {
      items.push({
        id: `tax-tpl-${tpl.id}`,
        category: 'tax',
        label: tpl.name,
        hint: 'Tax template',
        icon: 'file-text',
        keywords: [tpl.name.toLowerCase(), 'template'],
        route: '/taxes',
      })
    }
  } catch { /* ignore */ }
  return items
}

function indexAllocationRatios(): SearchItem[] {
  const items: SearchItem[] = []
  try {
    const ratios = JSON.parse(localStorage.getItem('allocation-custom-ratios') || '[]')
    for (const r of ratios) {
      items.push({
        id: `ratio-${r.id}`,
        category: 'allocation',
        label: r.name,
        hint: `Custom ratio · ${r.scope || 'total'}`,
        icon: 'pie-chart',
        keywords: [r.name.toLowerCase(), 'ratio'],
        route: '/net-worth/allocation',
      })
    }
  } catch { /* ignore */ }
  return items
}

/* ─── Build & Search ─── */

export function buildIndex(): SearchItem[] {
  return [
    ...STATIC_PAGES,
    ...STATIC_COMMANDS,
    ...indexGoals(),
    ...indexAccounts(),
    ...indexBudgetCategories(),
    ...indexTaxItems(),
    ...indexAllocationRatios(),
    ...STATIC_TOOLS,
    ...STATIC_SETTINGS,
  ]
}

export function search(items: SearchItem[], query: string, maxPerGroup = 5): SearchGroup[] {
  if (!query.trim()) {
    // Show pages + commands when empty
    return groupItems(
      [...STATIC_PAGES, ...STATIC_COMMANDS],
      Infinity,
    )
  }

  const q = query.toLowerCase().trim()
  const scored: { item: SearchItem; score: number }[] = []

  for (const item of items) {
    const score = scoreMatch(item, q)
    if (score > 0) scored.push({ item, score })
  }

  // Sort by score desc, then alphabetically
  scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))

  return groupItems(scored.map(s => s.item), maxPerGroup)
}

function scoreMatch(item: SearchItem, query: string): number {
  const label = item.label.toLowerCase()

  // Exact match
  if (label === query) return 100

  // Starts with
  if (label.startsWith(query)) return 80

  // Label contains
  if (label.includes(query)) return 60

  // Hint contains
  if (item.hint.toLowerCase().includes(query)) return 40

  // Keywords match
  for (const kw of item.keywords) {
    if (kw.includes(query)) return 30
  }

  return 0
}

function groupItems(items: SearchItem[], maxPerGroup: number): SearchGroup[] {
  const map = new Map<SearchCategory, SearchItem[]>()

  for (const item of items) {
    const list = map.get(item.category) || []
    list.push(item)
    map.set(item.category, list)
  }

  const groups: SearchGroup[] = []
  for (const cat of CATEGORY_ORDER) {
    const all = map.get(cat)
    if (!all || all.length === 0) continue
    groups.push({
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: all.slice(0, maxPerGroup),
      total: all.length,
    })
  }

  return groups
}

/** Returns indices [start, end] of the match in text for highlighting, or null */
export function findMatchRange(text: string, query: string): [number, number] | null {
  if (!query) return null
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return null
  return [idx, idx + query.length]
}
