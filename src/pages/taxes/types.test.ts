import { describe, it, expect, beforeEach } from 'vitest'
import {
  EMPTY_STORE,
  getEmptyYear,
  loadTemplates,
  saveTemplates,
  loadTaxStore,
  loadTaxYear,
  loadTaxYears,
  saveTaxYear,
  deleteTaxYear,
  taxFilePath,
  taxYearPath,
  uniqueTaxFileName,
  TEMPLATES_PATH,
} from './types'
import type { TaxTemplate, TaxYear } from './types'
import { MemoryFileStore } from '../../utils/memoryFileStore'

let fileStore: MemoryFileStore

beforeEach(() => {
  fileStore = new MemoryFileStore()
})

describe('constants', () => {
  it('EMPTY_STORE has empty years object', () => {
    expect(EMPTY_STORE).toEqual({ years: {} })
  })

  it('getEmptyYear returns object with empty items array', () => {
    expect(getEmptyYear()).toEqual({ items: [] })
  })

  it('getEmptyYear returns a new object each call', () => {
    expect(getEmptyYear()).not.toBe(getEmptyYear())
  })
})

describe('paths', () => {
  it('builds the per-year JSON path', () => {
    expect(taxYearPath(2024)).toBe('taxes/2024.json')
  })

  it('builds the per-document path', () => {
    expect(taxFilePath(2024, 'W-2.pdf')).toBe('taxes/2024/files/W-2.pdf')
  })
})

describe('loadTemplates', () => {
  it('returns an empty array when nothing is stored', async () => {
    await expect(loadTemplates(fileStore)).resolves.toEqual([])
  })

  it('returns the templates written to taxes/templates.json', async () => {
    const templates: TaxTemplate[] = [
      { id: '1', name: 'Standard', items: [{ label: 'W-2', owner: 'primary', category: 'paystub' }] },
    ]
    await fileStore.writeJSON(TEMPLATES_PATH, templates)
    const result = await loadTemplates(fileStore)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Standard')
    expect(result[0].items[0].label).toBe('W-2')
  })

  it('returns an empty array when the template file is corrupt', async () => {
    await fileStore.writeCSV(TEMPLATES_PATH, [['{broken']])
    await expect(loadTemplates(fileStore)).resolves.toEqual([])
  })
})

describe('saveTemplates', () => {
  it('persists templates', async () => {
    await saveTemplates(fileStore, [{ id: '2', name: 'Custom', items: [] }])
    const raw = await fileStore.readJSON<Record<string, unknown>[]>(TEMPLATES_PATH, [])
    expect(raw).toHaveLength(1)
    expect(raw[0].name).toBe('Custom')
  })

  it('overwrites existing templates', async () => {
    await saveTemplates(fileStore, [{ id: '1', name: 'First', items: [] }])
    await saveTemplates(fileStore, [{ id: '2', name: 'Second', items: [] }])
    const raw = await fileStore.readJSON<Record<string, unknown>[]>(TEMPLATES_PATH, [])
    expect(raw).toHaveLength(1)
    expect(raw[0].name).toBe('Second')
  })
})

describe('year files', () => {
  const year: TaxYear = {
    items: [
      {
        id: 'i1',
        label: 'W-2',
        owner: 'primary',
        category: 'paystub',
        accountIds: [],
        files: [{ id: 'f1', name: 'W-2.pdf', content: undefined, ext: 'pdf', uploadedAt: '2024-01-01' }],
      },
    ],
  }

  it('writes and reads a single year', async () => {
    await saveTaxYear(fileStore, 2024, year)
    await expect(loadTaxYear(fileStore, 2024)).resolves.toEqual(year)
  })

  it('returns an empty year when the file is missing', async () => {
    await expect(loadTaxYear(fileStore, 1999)).resolves.toEqual({ items: [] })
  })

  it('returns an empty year when the file has the wrong shape', async () => {
    await fileStore.writeJSON(taxYearPath(2024), { nope: true })
    await expect(loadTaxYear(fileStore, 2024)).resolves.toEqual({ items: [] })
  })

  it('lists years newest first and ignores templates.json', async () => {
    await saveTaxYear(fileStore, 2023, year)
    await saveTaxYear(fileStore, 2024, year)
    await saveTemplates(fileStore, [])
    await expect(loadTaxYears(fileStore)).resolves.toEqual([2024, 2023])
  })

  it('loads every year into one store', async () => {
    await saveTaxYear(fileStore, 2023, year)
    await saveTaxYear(fileStore, 2024, year)
    const store = await loadTaxStore(fileStore)
    expect(Object.keys(store.years).sort()).toEqual(['2023', '2024'])
  })

  it('deletes the year file and its documents', async () => {
    await saveTaxYear(fileStore, 2024, year)
    await fileStore.writeBinary(taxFilePath(2024, 'W-2.pdf'), new Uint8Array([1]).buffer)
    await deleteTaxYear(fileStore, 2024, year)
    await expect(fileStore.exists(taxYearPath(2024))).resolves.toBe(false)
    await expect(fileStore.exists(taxFilePath(2024, 'W-2.pdf'))).resolves.toBe(false)
  })
})

describe('uniqueTaxFileName', () => {
  it('keeps the desired name when it is free', async () => {
    await expect(uniqueTaxFileName(fileStore, 2024, 'W-2.pdf')).resolves.toBe('W-2.pdf')
  })

  it('appends a counter when the name is taken', async () => {
    await fileStore.writeBinary(taxFilePath(2024, 'W-2.pdf'), new Uint8Array([1]).buffer)
    await expect(uniqueTaxFileName(fileStore, 2024, 'W-2.pdf')).resolves.toBe('W-2 (2).pdf')
  })

  it('keeps incrementing past existing duplicates', async () => {
    await fileStore.writeBinary(taxFilePath(2024, 'W-2.pdf'), new Uint8Array([1]).buffer)
    await fileStore.writeBinary(taxFilePath(2024, 'W-2 (2).pdf'), new Uint8Array([1]).buffer)
    await expect(uniqueTaxFileName(fileStore, 2024, 'W-2.pdf')).resolves.toBe('W-2 (3).pdf')
  })
})
