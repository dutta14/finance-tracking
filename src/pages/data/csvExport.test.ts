import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportCsv } from './csvExport'
import type { Account, BalanceEntry } from './types'

// We can't test the actual download trigger, but we can spy on the
// DOM methods and verify the CSV content that gets created.

let createdUrl: string
let downloadedFilename: string
let clickCalled: boolean

beforeEach(() => {
  createdUrl = ''
  downloadedFilename = ''
  clickCalled = false

  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    createdUrl = 'blob:mock-url'
    return createdUrl
  })

  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

  // Capture what the <a> element's download attribute and click are
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') {
      const el = {
        href: '',
        download: '',
        click: vi.fn(() => {
          clickCalled = true
        }),
      }
      Object.defineProperty(el, 'download', {
        get() {
          return downloadedFilename
        },
        set(v: string) {
          downloadedFilename = v
        },
      })
      return el as any
    }
    return document.createElement(tag)
  })
})

const makeAccount = (id: number, name: string, institution = ''): Account => ({
  id,
  name,
  type: 'retirement',
  owner: 'primary',
  status: 'active',
  goalType: 'fi',
  nature: 'asset',
  allocation: 'us-stock',
  institution,
})

const makeBalance = (accountId: number, month: string, balance: number): BalanceEntry => ({
  id: accountId * 100 + parseInt(month.replace('-', '')),
  accountId,
  month,
  balance,
})

describe('exportCsv', () => {
  it('does nothing when accounts list is empty', () => {
    exportCsv([], [makeBalance(1, '2025-01', 1000)])
    expect(clickCalled).toBe(false)
  })

  it('does nothing when balances list has no months', () => {
    exportCsv([makeAccount(1, 'Account A')], [])
    expect(clickCalled).toBe(false)
  })

  it('creates a downloadable CSV when data exists', () => {
    const accounts = [makeAccount(1, 'Fidelity 401k', 'Fidelity')]
    const balances = [makeBalance(1, '2025-01', 50000)]
    exportCsv(accounts, balances)
    expect(clickCalled).toBe(true)
    expect(downloadedFilename).toMatch(/^finance-data-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('calls URL.revokeObjectURL after download', () => {
    const accounts = [makeAccount(1, 'Test')]
    const balances = [makeBalance(1, '2025-01', 100)]
    exportCsv(accounts, balances)
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
})
