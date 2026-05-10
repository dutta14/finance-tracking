import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { syncAllTaxFiles, downloadAllTaxFiles, stripDataUrl, filePath } from './taxGitHubSync'
import type { TaxStore } from './types'
import type { GitHubSyncConfig } from '../../hooks/useGitHubSync'

// stripDataUrl and filePath are now exported from the source module

describe('stripDataUrl', () => {
  it('strips data URL prefix from base64 content', () => {
    const input = 'data:application/pdf;base64,JVBERi0xLjQK'
    expect(stripDataUrl(input)).toBe('JVBERi0xLjQK')
  })

  it('strips image data URL prefix', () => {
    const input = 'data:image/png;base64,iVBORw0KGgo='
    expect(stripDataUrl(input)).toBe('iVBORw0KGgo=')
  })

  it('returns raw string if no comma present', () => {
    const input = 'rawbase64content'
    expect(stripDataUrl(input)).toBe('rawbase64content')
  })

  it('handles empty string', () => {
    expect(stripDataUrl('')).toBe('')
  })

  it('handles content with multiple commas (takes first split)', () => {
    const input = 'data:text/csv;base64,abc,def,ghi'
    expect(stripDataUrl(input)).toBe('abc,def,ghi')
  })
})

describe('filePath', () => {
  it('builds correct path with clean names', () => {
    const result = filePath(2024, 'Jane', 'W-2', { id: 'abc123', ext: 'pdf' } as any)
    expect(result).toBe('taxes/2024/Jane_W-2_abc123.pdf')
  })

  it('sanitizes special characters in names', () => {
    const result = filePath(2024, 'Jane', 'Tax Return (Federal)', { id: 'f1', ext: 'pdf' } as any)
    expect(result).toBe('taxes/2024/Jane_Tax_Return_Federal_f1.pdf')
  })

  it('collapses multiple spaces', () => {
    const result = filePath(2024, 'Jane  Doe', 'My  Document', { id: 'f1', ext: 'csv' } as any)
    expect(result).toBe('taxes/2024/Jane_Doe_My_Document_f1.csv')
  })

  it('handles minimal inputs', () => {
    const result = filePath(2025, 'A', 'B', { id: 'x', ext: 'txt' } as any)
    expect(result).toBe('taxes/2025/A_B_x.txt')
  })
})

/* ── Integration tests for syncAllTaxFiles / downloadAllTaxFiles ── */

vi.mock('../../utils/taxFileDB', () => ({
  getFileContent: vi.fn().mockResolvedValue('data:application/pdf;base64,SGVsbG8='),
  saveFileContent: vi.fn().mockResolvedValue(undefined),
  deleteFileContent: vi.fn().mockResolvedValue(undefined),
  deleteMultipleFiles: vi.fn().mockResolvedValue(undefined),
  getStorageEstimate: vi.fn().mockResolvedValue({ usedMB: 0, quotaMB: 100 }),
}))

vi.mock('../../utils/appStorage', () => ({
  appStorage: {
    getJSON: vi.fn(() => ({ name: 'Alice', partner: { name: 'Bob' } })),
    setJSON: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}))

const config: GitHubSyncConfig = { owner: 'testowner', repo: 'testrepo', filePath: 'data.json', autoSync: false }
const token = 'ghp_test123'

describe('syncAllTaxFiles', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uploads file with correct path and base64 content', async () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            {
              id: 'item1',
              label: 'W-2',
              owner: 'primary',
              category: 'paystub',
              accountIds: [],
              files: [
                {
                  id: 'f1',
                  name: 'W2.pdf',
                  content: 'data:application/pdf;base64,SGVsbG8=',
                  ext: 'pdf',
                  uploadedAt: '2024-01-01',
                },
              ],
            },
          ],
        },
      },
    }
    const putBodies: Record<string, string>[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (init?.method === 'PUT') {
        putBodies.push(JSON.parse(init.body as string))
        return new Response(JSON.stringify({ content: {} }), { status: 201 })
      }
      // GET for SHA check returns 404 (no existing file)
      return new Response('Not Found', { status: 404 })
    })
    const result = await syncAllTaxFiles(config, token, store)
    expect(result.synced).toBe(1)
    expect(result.ok).toBe(true)
    expect(putBodies.length).toBe(1)
    expect(putBodies[0].content).toBe('SGVsbG8=')
  })

  it('includes SHA for updates when file already exists', async () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            {
              id: 'item1',
              label: 'W-2',
              owner: 'primary',
              category: 'paystub',
              accountIds: [],
              files: [
                {
                  id: 'f1',
                  name: 'W2.pdf',
                  content: 'data:application/pdf;base64,SGVsbG8=',
                  ext: 'pdf',
                  uploadedAt: '2024-01-01',
                },
              ],
            },
          ],
        },
      },
    }
    const putBodies: Record<string, string>[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        putBodies.push(JSON.parse(init.body as string))
        return new Response(JSON.stringify({ content: {} }), { status: 200 })
      }
      // GET for SHA check returns existing SHA
      return new Response(JSON.stringify({ sha: 'existingsha123' }), { status: 200 })
    })
    const result = await syncAllTaxFiles(config, token, store)
    expect(result.synced).toBe(1)
    expect(putBodies[0].sha).toBe('existingsha123')
  })

  it('includes Authorization header on all requests', async () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            {
              id: 'item1',
              label: 'W-2',
              owner: 'primary',
              category: 'paystub',
              accountIds: [],
              files: [
                {
                  id: 'f1',
                  name: 'W2.pdf',
                  content: 'data:application/pdf;base64,SGVsbG8=',
                  ext: 'pdf',
                  uploadedAt: '2024-01-01',
                },
              ],
            },
          ],
        },
      },
    }
    const capturedHeaders: Record<string, string>[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.headers) capturedHeaders.push(init.headers as Record<string, string>)
      if (init?.method === 'PUT') {
        return new Response(JSON.stringify({ content: {} }), { status: 201 })
      }
      return new Response('Not Found', { status: 404 })
    })
    await syncAllTaxFiles(config, token, store)
    expect(capturedHeaders.length).toBeGreaterThan(0)
    for (const headers of capturedHeaders) {
      expect(headers.Authorization).toBe(`Bearer ${token}`)
    }
  })

  it('skips files without content', async () => {
    const { getFileContent } = await import('../../utils/taxFileDB')
    vi.mocked(getFileContent).mockResolvedValueOnce(null)
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            {
              id: 'item1',
              label: 'W-2',
              owner: 'primary',
              category: 'paystub',
              accountIds: [],
              files: [{ id: 'f1', name: 'W2.pdf', content: undefined, ext: 'pdf', uploadedAt: '2024-01-01' }],
            },
          ],
        },
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const result = await syncAllTaxFiles(config, token, store)
    expect(result.synced).toBe(0)
    expect(result.ok).toBe(true)
  })

  it('retries on 409 conflict and succeeds on second attempt', async () => {
    const store: TaxStore = {
      years: {
        2024: {
          items: [
            {
              id: 'item1',
              label: 'W-2',
              owner: 'primary',
              category: 'paystub',
              accountIds: [],
              files: [
                {
                  id: 'f1',
                  name: 'W2.pdf',
                  content: 'data:application/pdf;base64,SGVsbG8=',
                  ext: 'pdf',
                  uploadedAt: '2024-01-01',
                },
              ],
            },
          ],
        },
      },
    }
    let putAttempts = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        putAttempts++
        if (putAttempts === 1) {
          return new Response(JSON.stringify({ message: 'Conflict' }), { status: 409 })
        }
        return new Response(JSON.stringify({ content: {} }), { status: 201 })
      }
      return new Response('Not Found', { status: 404 })
    })
    const result = await syncAllTaxFiles(config, token, store)
    expect(result.synced).toBe(1)
    expect(result.ok).toBe(true)
    expect(putAttempts).toBe(2)
  })
})

describe('downloadAllTaxFiles', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns files from taxes directory with decoded base64', async () => {
    let callIndex = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      callIndex++
      // First call: list years
      if (url.endsWith('/contents/taxes')) {
        return new Response(JSON.stringify([{ name: '2024', type: 'dir' }]), { status: 200 })
      }
      // Second call: list files in 2024
      if (url.endsWith('/contents/taxes/2024')) {
        return new Response(JSON.stringify([{ name: 'Alice_W-2_f1.pdf', type: 'file', sha: 'abc' }]), { status: 200 })
      }
      // Third call: get file content
      if (url.includes('Alice_W-2_f1.pdf')) {
        return new Response(JSON.stringify({ content: 'SGVs\nbG8=', encoding: 'base64' }), { status: 200 })
      }
      return new Response('Not Found', { status: 404 })
    })
    const result = await downloadAllTaxFiles(config, token)
    expect(result.ok).toBe(true)
    expect(result.files).toBeDefined()
    expect(result.files!.get('f1')).toBe('SGVsbG8=')
  })

  it('returns empty map when taxes directory does not exist (404)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }))
    const result = await downloadAllTaxFiles(config, token)
    expect(result.ok).toBe(true)
    expect(result.files!.size).toBe(0)
  })

  it('returns error for non-404 failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Server Error', { status: 500 }))
    const result = await downloadAllTaxFiles(config, token)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('500')
  })

  it('handles network error gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'))
    const result = await downloadAllTaxFiles(config, token)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Network failure')
  })

  it('downloads successful files even when some file downloads fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.endsWith('/contents/taxes')) {
        return new Response(JSON.stringify([{ name: '2024', type: 'dir' }]), { status: 200 })
      }
      if (url.endsWith('/contents/taxes/2024')) {
        return new Response(
          JSON.stringify([
            { name: 'Alice_W-2_f1.pdf', type: 'file', sha: 'abc' },
            { name: 'Alice_1099_f2.pdf', type: 'file', sha: 'def' },
          ]),
          { status: 200 },
        )
      }
      if (url.includes('Alice_W-2_f1.pdf')) {
        return new Response(JSON.stringify({ content: 'SGVsbG8=', encoding: 'base64' }), { status: 200 })
      }
      if (url.includes('Alice_1099_f2.pdf')) {
        return new Response('Server Error', { status: 500 })
      }
      return new Response('Not Found', { status: 404 })
    })
    const result = await downloadAllTaxFiles(config, token)
    expect(result.ok).toBe(true)
    expect(result.files).toBeDefined()
    expect(result.files!.get('f1')).toBe('SGVsbG8=')
    expect(result.files!.has('f2')).toBe(false)
  })
})
