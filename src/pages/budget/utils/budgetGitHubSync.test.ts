import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  uploadBudgetCSV,
  listBudgetCSVs,
  downloadBudgetCSV,
  downloadAllBudgetCSVs,
  syncAllBudgetCSVs,
  uploadBudgetConfig,
  downloadBudgetConfig,
} from './budgetGitHubSync'
import type { GitHubSyncConfig } from '../../../hooks/useGitHubSync'
import type { BudgetConfigData } from '../types'

const mockConfig: GitHubSyncConfig = {
  owner: 'testuser',
  repo: 'finance-data',
  filePath: 'data.json',
  autoSync: false,
}
const mockToken = 'ghp_test123'

const toBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  global.fetch = fetchMock
  vi.clearAllMocks()
})

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response
}

function errorResponse(status: number, message = 'Error'): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
    text: () => Promise.resolve(message),
  } as Response
}

describe('uploadBudgetCSV', () => {
  it('creates file at correct GitHub path with base64 content', async () => {
    // First call: getFileSha returns 404
    fetchMock.mockResolvedValueOnce(errorResponse(404))
    // Second call: PUT succeeds
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: {} }, 201))

    const result = await uploadBudgetCSV(mockConfig, mockToken, '2025-05', 'Date,Category,Amount\n...')

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Verify PUT call
    const putCall = fetchMock.mock.calls[1]
    expect(putCall[0]).toBe('https://api.github.com/repos/testuser/finance-data/contents/budget/2025-05.csv')
    const body = JSON.parse(putCall[1].body)
    expect(body.content).toBeTruthy()
    // Verify base64 content decodes to the original CSV
    const decoded = atob(body.content)
    expect(decoded).toBe('Date,Category,Amount\n...')
    expect(body.message).toBe('Budget: 2025-05')
    expect(body.sha).toBeUndefined()
  })

  it('includes SHA when updating existing file', async () => {
    // getFileSha returns existing sha
    fetchMock.mockResolvedValueOnce(jsonResponse({ sha: 'abc123' }))
    // PUT succeeds
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: {} }, 200))

    const result = await uploadBudgetCSV(mockConfig, mockToken, '2025-05', 'csv data')

    expect(result.ok).toBe(true)
    const putBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(putBody.sha).toBe('abc123')
  })

  it('retries up to 3 times on 409 conflict', async () => {
    // Attempt 1: getFileSha ok, PUT 409
    fetchMock.mockResolvedValueOnce(jsonResponse({ sha: 'sha1' }))
    fetchMock.mockResolvedValueOnce(errorResponse(409, 'Conflict'))
    // Attempt 2: getFileSha ok, PUT 409
    fetchMock.mockResolvedValueOnce(jsonResponse({ sha: 'sha2' }))
    fetchMock.mockResolvedValueOnce(errorResponse(409, 'Conflict'))
    // Attempt 3: getFileSha ok, PUT succeeds
    fetchMock.mockResolvedValueOnce(jsonResponse({ sha: 'sha3' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: {} }, 200))

    const result = await uploadBudgetCSV(mockConfig, mockToken, '2025-05', 'csv data')

    expect(result.ok).toBe(true)
    // 3 attempts x 2 calls each = 6 fetch calls
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('fails after 3 conflict retries', async () => {
    // All 3 attempts fail with 409
    for (let i = 0; i < 3; i++) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ sha: `sha${i}` }))
      fetchMock.mockResolvedValueOnce(errorResponse(409, 'Conflict'))
    }

    const result = await uploadBudgetCSV(mockConfig, mockToken, '2025-05', 'csv')

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('handles network errors gracefully', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network failure'))

    const result = await uploadBudgetCSV(mockConfig, mockToken, '2025-05', 'csv')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Network failure')
  })

  it('passes authorization header on all requests', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404))
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: {} }, 201))

    await uploadBudgetCSV(mockConfig, mockToken, '2025-05', 'csv')

    for (const call of fetchMock.mock.calls) {
      expect(call[1]?.headers?.Authorization).toBe(`Bearer ${mockToken}`)
    }
  })
})

describe('listBudgetCSVs', () => {
  it('returns file list from GitHub', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { name: '2025-01.csv', path: 'budget/2025-01.csv', sha: 'sha1', type: 'file' },
        { name: '2025-02.csv', path: 'budget/2025-02.csv', sha: 'sha2', type: 'file' },
        { name: 'readme.md', path: 'budget/readme.md', sha: 'sha3', type: 'file' },
      ]),
    )

    const result = await listBudgetCSVs(mockConfig, mockToken)

    expect(result.ok).toBe(true)
    expect(result.files).toHaveLength(2)
    expect(result.files![0].name).toBe('2025-01.csv')
    expect(result.files![1].name).toBe('2025-02.csv')
  })

  it('handles 404 when budget dir does not exist', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404))

    const result = await listBudgetCSVs(mockConfig, mockToken)

    expect(result.ok).toBe(true)
    expect(result.files).toEqual([])
  })

  it('handles network errors gracefully', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'))

    const result = await listBudgetCSVs(mockConfig, mockToken)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Network error')
  })

  it('passes authorization header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))

    await listBudgetCSVs(mockConfig, mockToken)

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${mockToken}`)
  })
})

describe('downloadBudgetCSV', () => {
  it('fetches and decodes base64 content', async () => {
    const csvContent = 'Date,Category,Amount\n2025-01-01,Salary,5000'
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        content: toBase64(csvContent),
        encoding: 'base64',
      }),
    )

    const result = await downloadBudgetCSV(mockConfig, mockToken, '2025-01')

    expect(result.ok).toBe(true)
    expect(result.csv).toBe(csvContent)
  })

  it('returns error on 404', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404))

    const result = await downloadBudgetCSV(mockConfig, mockToken, '2025-01')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('File not found')
  })

  it('returns error for unexpected file format', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: null, encoding: 'none' }))

    const result = await downloadBudgetCSV(mockConfig, mockToken, '2025-01')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Unexpected file format')
  })

  it('handles network errors gracefully', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Timeout'))

    const result = await downloadBudgetCSV(mockConfig, mockToken, '2025-01')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Timeout')
  })

  it('passes authorization header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: toBase64('csv'), encoding: 'base64' }))

    await downloadBudgetCSV(mockConfig, mockToken, '2025-01')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${mockToken}`)
  })
})

describe('downloadAllBudgetCSVs', () => {
  it('downloads all listed CSVs keyed by month', async () => {
    // listBudgetCSVs call
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { name: '2025-01.csv', path: 'budget/2025-01.csv', sha: 'sha1', type: 'file' },
        { name: '2025-02.csv', path: 'budget/2025-02.csv', sha: 'sha2', type: 'file' },
      ]),
    )
    // downloadBudgetCSV calls
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: toBase64('jan data'), encoding: 'base64' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: toBase64('feb data'), encoding: 'base64' }))

    const result = await downloadAllBudgetCSVs(mockConfig, mockToken)

    expect(result.ok).toBe(true)
    expect(result.csvs!['2025-01']).toBe('jan data')
    expect(result.csvs!['2025-02']).toBe('feb data')
  })

  it('returns error when listing fails', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'Server error'))

    const result = await downloadAllBudgetCSVs(mockConfig, mockToken)

    expect(result.ok).toBe(false)
  })

  it('returns partial data when one month download fails', async () => {
    // listBudgetCSVs call
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { name: '2025-01.csv', path: 'budget/2025-01.csv', sha: 'sha1', type: 'file' },
        { name: '2025-02.csv', path: 'budget/2025-02.csv', sha: 'sha2', type: 'file' },
      ]),
    )
    // First download succeeds
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: toBase64('jan data'), encoding: 'base64' }))
    // Second download fails with 404
    fetchMock.mockResolvedValueOnce(errorResponse(404))

    const result = await downloadAllBudgetCSVs(mockConfig, mockToken)

    // Should still contain the successful download
    expect(result.csvs!['2025-01']).toBe('jan data')
    // Failed month should not be present
    expect(result.csvs!['2025-02']).toBeUndefined()
  })
})

describe('syncAllBudgetCSVs', () => {
  it('uploads only the provided local CSVs', async () => {
    const localCsvs = {
      '2025-01': { csv: 'jan csv' },
      '2025-02': { csv: 'feb csv' },
    }

    // Each upload: getFileSha (404) + PUT (success)
    fetchMock.mockResolvedValueOnce(errorResponse(404))
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 201))
    fetchMock.mockResolvedValueOnce(errorResponse(404))
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 201))

    const result = await syncAllBudgetCSVs(mockConfig, mockToken, localCsvs)

    expect(result.ok).toBe(true)
    expect(result.synced).toBe(2)
    expect(result.errors).toEqual([])
  })

  it('collects errors for failed uploads', async () => {
    const localCsvs = {
      '2025-01': { csv: 'jan csv' },
      '2025-02': { csv: 'feb csv' },
    }

    // First upload succeeds
    fetchMock.mockResolvedValueOnce(errorResponse(404))
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 201))
    // Second upload fails
    fetchMock.mockResolvedValueOnce(errorResponse(404))
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'Server error'))

    const result = await syncAllBudgetCSVs(mockConfig, mockToken, localCsvs)

    expect(result.ok).toBe(false)
    expect(result.synced).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('2025-02')
  })
})

describe('uploadBudgetConfig', () => {
  it('uploads config JSON to correct path', async () => {
    // getFileSha 404
    fetchMock.mockResolvedValueOnce(errorResponse(404))
    // PUT success
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 201))

    const configData: BudgetConfigData = {
      version: 1,
      years: [2024, 2025],
      categoryGroups: [{ id: 'others', name: 'Others', categories: [] }],
    }

    const result = await uploadBudgetConfig(mockConfig, mockToken, configData)

    expect(result.ok).toBe(true)
    const putCall = fetchMock.mock.calls[1]
    expect(putCall[0]).toContain('budget/budget-config.json')
    const body = JSON.parse(putCall[1].body)
    expect(body.message).toBe('Budget config update')
  })

  it('includes SHA when config file already exists', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ sha: 'configsha' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 200))

    const configData: BudgetConfigData = { version: 1, years: [], categoryGroups: [] }
    await uploadBudgetConfig(mockConfig, mockToken, configData)

    const putBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(putBody.sha).toBe('configsha')
  })

  it('handles upload failure', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404))
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'Internal error'))

    const result = await uploadBudgetConfig(mockConfig, mockToken, { version: 1, years: [], categoryGroups: [] })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('handles network exception', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network down'))

    const result = await uploadBudgetConfig(mockConfig, mockToken, { version: 1, years: [], categoryGroups: [] })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Network down')
  })
})

describe('downloadBudgetConfig', () => {
  it('downloads and parses config JSON', async () => {
    const configData: BudgetConfigData = {
      version: 1,
      years: [2024, 2025],
      categoryGroups: [{ id: 'food', name: 'Food', categories: ['Groceries'] }],
    }
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        content: toBase64(JSON.stringify(configData)),
        encoding: 'base64',
      }),
    )

    const result = await downloadBudgetConfig(mockConfig, mockToken)

    expect(result.ok).toBe(true)
    expect(result.data!.version).toBe(1)
    expect(result.data!.years).toEqual([2024, 2025])
    expect(result.data!.categoryGroups[0].id).toBe('food')
  })

  it('returns ok with undefined data when config does not exist (404)', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404))

    const result = await downloadBudgetConfig(mockConfig, mockToken)

    expect(result.ok).toBe(true)
    expect(result.data).toBeUndefined()
  })

  it('handles unexpected file format', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ content: null, encoding: 'none' }))

    const result = await downloadBudgetConfig(mockConfig, mockToken)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Unexpected file format')
  })

  it('handles network errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('DNS failure'))

    const result = await downloadBudgetConfig(mockConfig, mockToken)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('DNS failure')
  })

  it('passes authorization header', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        content: toBase64(JSON.stringify({ version: 1, years: [], categoryGroups: [] })),
        encoding: 'base64',
      }),
    )

    await downloadBudgetConfig(mockConfig, mockToken)

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${mockToken}`)
  })
})
