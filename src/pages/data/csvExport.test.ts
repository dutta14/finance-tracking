import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportCsv } from './csvExport'
import type { Account, BalanceEntry } from './types'

// We can't test the actual download trigger, but we can spy on the
// DOM methods and verify the CSV content that gets created.

let createdUrl: string
let downloadedFilename: string
let clickCalled: boolean
let capturedBlob: Blob | null

beforeEach(() => {
  createdUrl = ''
  downloadedFilename = ''
  clickCalled = false
  capturedBlob = null

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
    createdUrl = 'blob:mock-url'
    capturedBlob = blob
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
      return el as unknown as HTMLAnchorElement
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

  it('CSV content matches expected data', async () => {
    const accounts = [makeAccount(1, 'Fidelity 401k', 'Fidelity'), makeAccount(2, 'Roth IRA')]
    const balances = [makeBalance(1, '2025-01', 50000), makeBalance(2, '2025-01', 12000)]
    exportCsv(accounts, balances)

    expect(capturedBlob).not.toBeNull()
    const csv = await capturedBlob!.text()
    const rows = csv.split('\n')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toBe(',Fidelity,')
    expect(rows[1]).toBe(',Fidelity 401k,Roth IRA')
    expect(rows[2]).toBe('2025-01,50000,12000')
  })

  it('calls URL.revokeObjectURL after download', async () => {
    const accounts = [makeAccount(1, 'Test')]
    const balances = [makeBalance(1, '2025-01', 100)]
    exportCsv(accounts, balances)
    expect(URL.revokeObjectURL).toHaveBeenCalled()

    // Verify CSV content via capturedBlob
    expect(capturedBlob).not.toBeNull()
    const csvContent = await capturedBlob!.text()
    expect(csvContent).toContain('Test')
    expect(csvContent).toContain('2025-01')
    expect(csvContent).toContain('100')
  })
})
