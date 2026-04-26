import { describe, it, expect, beforeEach } from 'vitest'
import { getLatestGoalTotals } from './types'
import type { Account, BalanceEntry } from './types'

beforeEach(() => {
  localStorage.clear()
})

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 1,
  name: 'Test Account',
  type: 'retirement',
  owner: 'primary',
  status: 'active',
  goalType: 'fi',
  nature: 'asset',
  allocation: 'us-stock',
  ...overrides,
})

const makeBalance = (accountId: number, month: string, balance: number): BalanceEntry => ({
  id: accountId * 1000 + parseInt(month.replace('-', '')),
  accountId,
  month,
  balance,
})

describe('getLatestGoalTotals', () => {
  it('returns zeros when no data stored', () => {
    expect(getLatestGoalTotals()).toEqual({ fiTotal: 0, gwTotal: 0 })
  })

  it('returns zeros when accounts exist but no balances', () => {
    localStorage.setItem('data-accounts', JSON.stringify([makeAccount()]))
    localStorage.setItem('data-balances', '[]')
    expect(getLatestGoalTotals()).toEqual({ fiTotal: 0, gwTotal: 0 })
  })

  it('computes FI total from latest month balances', () => {
    const accounts = [makeAccount({ id: 1, goalType: 'fi' }), makeAccount({ id: 2, goalType: 'fi' })]
    const balances = [
      makeBalance(1, '2025-01', 50000),
      makeBalance(2, '2025-01', 30000),
      makeBalance(1, '2025-02', 55000),
      makeBalance(2, '2025-02', 32000),
    ]
    localStorage.setItem('data-accounts', JSON.stringify(accounts))
    localStorage.setItem('data-balances', JSON.stringify(balances))

    const result = getLatestGoalTotals()
    // Latest month is 2025-02
    expect(result.fiTotal).toBe(87000) // 55000 + 32000
    expect(result.gwTotal).toBe(0)
  })

  it('computes GW total separately', () => {
    const accounts = [makeAccount({ id: 1, goalType: 'fi' }), makeAccount({ id: 2, goalType: 'gw', type: 'liquid' })]
    const balances = [makeBalance(1, '2025-03', 100000), makeBalance(2, '2025-03', 20000)]
    localStorage.setItem('data-accounts', JSON.stringify(accounts))
    localStorage.setItem('data-balances', JSON.stringify(balances))

    const result = getLatestGoalTotals()
    expect(result.fiTotal).toBe(100000)
    expect(result.gwTotal).toBe(20000)
  })

  it('skips inactive accounts', () => {
    const accounts = [
      makeAccount({ id: 1, goalType: 'fi', status: 'active' }),
      makeAccount({ id: 2, goalType: 'fi', status: 'inactive' }),
    ]
    const balances = [makeBalance(1, '2025-01', 50000), makeBalance(2, '2025-01', 999999)]
    localStorage.setItem('data-accounts', JSON.stringify(accounts))
    localStorage.setItem('data-balances', JSON.stringify(balances))

    expect(getLatestGoalTotals().fiTotal).toBe(50000)
  })

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem('data-accounts', '{broken')
    expect(getLatestGoalTotals()).toEqual({ fiTotal: 0, gwTotal: 0 })
  })

  it('uses only the latest month when multiple months exist', () => {
    const accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    const balances = [
      makeBalance(1, '2024-12', 40000),
      makeBalance(1, '2025-01', 45000),
      makeBalance(1, '2025-02', 50000),
    ]
    localStorage.setItem('data-accounts', JSON.stringify(accounts))
    localStorage.setItem('data-balances', JSON.stringify(balances))

    expect(getLatestGoalTotals().fiTotal).toBe(50000)
  })
})
