import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseCsvImport } from './csvImport'

describe('parseCsvImport', () => {
  it('parses a valid 3-row CSV into accounts and balances', () => {
    const csv = [',Vanguard,Fidelity', ',401k,IRA', '2025-01,50000,30000', '2025-02,52000,31000'].join('\n')

    const result = parseCsvImport(csv, [], [])
    expect(result.accounts).toHaveLength(2)
    expect(result.accounts[0].name).toBe('401k')
    expect(result.accounts[0].institution).toBe('Vanguard')
    expect(result.accounts[1].name).toBe('IRA')
    expect(result.balances).toHaveLength(4) // 2 months × 2 accounts
  })

  it('assigns sequential account IDs starting from 1', () => {
    const csv = ',Inst\n,Acct\n2025-01,100'
    const result = parseCsvImport(csv, [], [])
    expect(result.accounts[0].id).toBe(1)
  })

  it('continues IDs from existing accounts', () => {
    const csv = ',Inst\n,NewAcct\n2025-01,100'
    const existing = [
      {
        id: 5,
        name: 'Old',
        type: 'retirement' as const,
        owner: 'primary' as const,
        status: 'active' as const,
        goalType: 'fi' as const,
        nature: 'asset' as const,
        allocation: 'cash' as const,
      },
    ]
    const result = parseCsvImport(csv, existing, [])
    expect(result.accounts).toHaveLength(2)
    expect(result.accounts[1].id).toBe(6)
  })

  it('handles MM/YYYY month format', () => {
    const csv = ',Inst\n,Acct\n1/2025,100'
    const result = parseCsvImport(csv, [], [])
    expect(result.balances[0].month).toBe('2025-01')
  })

  it('handles "Jan 2025" month format', () => {
    const csv = ',Inst\n,Acct\nJan 2025,100'
    const result = parseCsvImport(csv, [], [])
    expect(result.balances[0].month).toBe('2025-01')
  })

  it('returns existing data when CSV has fewer than 3 lines', () => {
    const existing = [
      {
        id: 1,
        name: 'A',
        type: 'retirement' as const,
        owner: 'primary' as const,
        status: 'active' as const,
        goalType: 'fi' as const,
        nature: 'asset' as const,
        allocation: 'cash' as const,
      },
    ]
    const result = parseCsvImport('only,one\nline,here', existing, [])
    expect(result.accounts).toBe(existing)
  })

  it('returns existing data when no account columns found', () => {
    const csv = 'Inst\n\n2025-01'
    const result = parseCsvImport(csv, [], [])
    expect(result.accounts).toEqual([])
  })

  it('skips rows with empty month cell', () => {
    const csv = ',Inst\n,Acct\n,100\n2025-01,200'
    const result = parseCsvImport(csv, [], [])
    expect(result.balances).toHaveLength(1)
    expect(result.balances[0].balance).toBe(200)
  })

  it('handles quoted fields with commas', () => {
    const csv = ',"Vanguard, Inc."\n,"My 401k"\n2025-01,"1,500"'
    const result = parseCsvImport(csv, [], [])
    expect(result.accounts[0].institution).toBe('Vanguard, Inc.')
    expect(result.balances[0].balance).toBe(1500)
  })
})
