import { describe, it, expect } from 'vitest'
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

  it('skips rows with unrecognized date formats', () => {
    const csv = ',Inst\n,Acct\n2025-01,100\nxyz123,200'
    const result = parseCsvImport(csv, [], [])
    expect(result.balances).toHaveLength(1)
    expect(result.balances[0].balance).toBe(100)
  })

  it('updates balance when the same account+month appears twice', () => {
    const csv = ',Inst\n,Acct\n2025-01,100\n2025-01,250'
    const result = parseCsvImport(csv, [], [])
    expect(result.balances).toHaveLength(1)
    expect(result.balances[0].balance).toBe(250)
  })

  it('skips columns with empty account name', () => {
    const csv = ',Inst1,Inst2\n,Acct1,\n2025-01,100,200'
    const result = parseCsvImport(csv, [], [])
    expect(result.accounts).toHaveLength(1)
    expect(result.accounts[0].name).toBe('Acct1')
  })

  it('returns existing data when no valid columns found', () => {
    const existing = [
      {
        id: 1,
        name: 'Old',
        type: 'non-retirement' as const,
        owner: 'primary' as const,
        status: 'active' as const,
        goalType: 'fi' as const,
        nature: 'asset' as const,
        allocation: 'cash' as const,
      },
    ]
    const csv = ',\n,\n2025-01,100'
    const result = parseCsvImport(csv, existing, [])
    expect(result.accounts).toBe(existing)
  })

  it('skips balance cells that are NaN after parsing', () => {
    const csv = ',Inst\n,Acct\n2025-01,abc\n2025-02,200'
    const result = parseCsvImport(csv, [], [])
    expect(result.balances).toHaveLength(1)
    expect(result.balances[0].month).toBe('2025-02')
  })

  it('creates account without institution when institution cell is empty', () => {
    const csv = ',\n,MyAccount\n2025-01,500'
    const result = parseCsvImport(csv, [], [])
    expect(result.accounts[0].name).toBe('MyAccount')
    expect(result.accounts[0].institution).toBeUndefined()
  })
})
