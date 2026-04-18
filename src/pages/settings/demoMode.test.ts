import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isDemoActive, enterDemoMode, exitDemoMode } from './demoMode'

// Stub window.location.reload
const reloadStub = vi.fn()

beforeEach(() => {
  localStorage.clear()
  reloadStub.mockReset()
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, reload: reloadStub },
  })
})

describe('isDemoActive', () => {
  it('returns false when no backup key exists', () => {
    expect(isDemoActive()).toBe(false)
  })

  it('returns true when backup key exists', () => {
    localStorage.setItem('_demo-backup', '{}')
    expect(isDemoActive()).toBe(true)
  })
})

describe('enterDemoMode', () => {
  it('backs up existing data and seeds demo data', () => {
    // Put some real data in
    localStorage.setItem('financialGoals', JSON.stringify([{ id: 99, goalName: 'Real Goal' }]))
    localStorage.setItem('data-accounts', JSON.stringify([{ id: 1, name: 'Real Account' }]))
    localStorage.setItem('darkMode', '1') // settings key — should not be touched

    enterDemoMode()

    // Backup should exist and contain original data
    const backup = JSON.parse(localStorage.getItem('_demo-backup')!)
    expect(backup['financialGoals']).toContain('Real Goal')
    expect(backup['data-accounts']).toContain('Real Account')

    // Settings key untouched
    expect(localStorage.getItem('darkMode')).toBe('1')

    // Demo data seeded
    const goals = JSON.parse(localStorage.getItem('financialGoals')!)
    expect(goals.length).toBe(3)
    expect(goals[0].goalName).toBe('Early Retirement')

    const accounts = JSON.parse(localStorage.getItem('data-accounts')!)
    expect(accounts.length).toBe(5)
    expect(accounts[0].name).toBe('401(k)')

    const balances = JSON.parse(localStorage.getItem('data-balances')!)
    expect(balances.length).toBeGreaterThan(100) // ~10 years × 12 months × 5 accounts

    const budgetStore = JSON.parse(localStorage.getItem('budget-store')!)
    expect(Object.keys(budgetStore.csvs).length).toBeGreaterThan(12) // at least 2 years

    const gwGoals = JSON.parse(localStorage.getItem('gw-goals')!)
    expect(gwGoals.length).toBe(4)

    const taxStore = JSON.parse(localStorage.getItem('tax-store')!)
    expect(Object.keys(taxStore.years).length).toBe(2)

    const profile = JSON.parse(localStorage.getItem('user-profile')!)
    expect(profile.name).toBe('Alex')
    expect(profile.partner.name).toBe('Sam')

    const ratios = JSON.parse(localStorage.getItem('allocation-custom-ratios')!)
    expect(ratios.length).toBe(2)

    // Reloaded
    expect(reloadStub).toHaveBeenCalledOnce()
  })

  it('is idempotent — does nothing if already active', () => {
    enterDemoMode()
    reloadStub.mockReset()
    const backupBefore = localStorage.getItem('_demo-backup')

    enterDemoMode()

    expect(localStorage.getItem('_demo-backup')).toBe(backupBefore)
    expect(reloadStub).not.toHaveBeenCalled()
  })
})

describe('exitDemoMode', () => {
  it('restores original data and removes backup', () => {
    // Set up real data, enter demo, then exit
    localStorage.setItem('financialGoals', JSON.stringify([{ id: 99, goalName: 'Real Goal' }]))
    localStorage.setItem('data-accounts', JSON.stringify([{ id: 1, name: 'My Checking' }]))

    enterDemoMode()
    reloadStub.mockReset()

    // Verify demo data is active
    expect(JSON.parse(localStorage.getItem('financialGoals')!)[0].goalName).toBe('Early Retirement')

    exitDemoMode()

    // Original data restored
    const goals = JSON.parse(localStorage.getItem('financialGoals')!)
    expect(goals[0].goalName).toBe('Real Goal')

    const accounts = JSON.parse(localStorage.getItem('data-accounts')!)
    expect(accounts[0].name).toBe('My Checking')

    // Backup removed
    expect(localStorage.getItem('_demo-backup')).toBeNull()
    expect(isDemoActive()).toBe(false)

    // Reloaded
    expect(reloadStub).toHaveBeenCalledOnce()
  })

  it('clears demo data for keys that had no original value', () => {
    // Start empty — no pre-existing data
    enterDemoMode()
    reloadStub.mockReset()

    exitDemoMode()

    // All demo data should be gone
    expect(localStorage.getItem('financialGoals')).toBeNull()
    expect(localStorage.getItem('data-accounts')).toBeNull()
    expect(localStorage.getItem('data-balances')).toBeNull()
    expect(localStorage.getItem('budget-store')).toBeNull()
    expect(localStorage.getItem('gw-goals')).toBeNull()
    expect(localStorage.getItem('tax-store')).toBeNull()
    expect(localStorage.getItem('allocation-custom-ratios')).toBeNull()
  })

  it('does nothing if demo mode is not active', () => {
    exitDemoMode()
    expect(reloadStub).not.toHaveBeenCalled()
  })

  it('handles corrupt backup gracefully', () => {
    localStorage.setItem('_demo-backup', 'not-valid-json')
    exitDemoMode()
    expect(localStorage.getItem('_demo-backup')).toBeNull()
    expect(reloadStub).toHaveBeenCalledOnce()
  })
})

describe('demo data quality', () => {
  beforeEach(() => {
    enterDemoMode()
  })

  it('generates balance entries with increasing trend', () => {
    const balances = JSON.parse(localStorage.getItem('data-balances')!)
    // Check 401k entries (accountId: 1) — last balance should be larger than first
    const account1 = balances.filter((b: { accountId: number }) => b.accountId === 1)
    expect(account1[account1.length - 1].balance).toBeGreaterThan(account1[0].balance)
  })

  it('generates budget CSVs with valid CSV format', () => {
    const store = JSON.parse(localStorage.getItem('budget-store')!)
    const firstKey = Object.keys(store.csvs)[0]
    const csv = store.csvs[firstKey].csv
    expect(csv).toContain('Date,Category,Amount')
    expect(csv).toContain('Salary')
    expect(csv).toContain('Rent')
  })

  it('generates tax store with items for two years', () => {
    const taxStore = JSON.parse(localStorage.getItem('tax-store')!)
    const years = Object.keys(taxStore.years)
    expect(years.length).toBe(2)
    const firstYear = taxStore.years[years[0]]
    expect(firstYear.items.length).toBeGreaterThan(0)
  })

  it('generates fi-simulations', () => {
    const sims = JSON.parse(localStorage.getItem('fi-simulations')!)
    expect(sims.length).toBe(1)
    expect(sims[0].name).toBe('Base Case')
  })

  it('uses consistent goal IDs between fi goals and gw goals', () => {
    const goals = JSON.parse(localStorage.getItem('financialGoals')!)
    const gwGoals = JSON.parse(localStorage.getItem('gw-goals')!)
    const goalIds = new Set(goals.map((g: { id: number }) => g.id))
    for (const gw of gwGoals) {
      expect(goalIds.has(gw.fiGoalId)).toBe(true)
    }
  })

  it('uses consistent account IDs between accounts and balances', () => {
    const accounts = JSON.parse(localStorage.getItem('data-accounts')!)
    const balances = JSON.parse(localStorage.getItem('data-balances')!)
    const accountIds = new Set(accounts.map((a: { id: number }) => a.id))
    for (const b of balances) {
      expect(accountIds.has(b.accountId)).toBe(true)
    }
  })
})
