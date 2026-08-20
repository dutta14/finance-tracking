import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeId, loadCustomRatios, saveCustomRatios, makeDefaultRatio } from './utils'
import { ALLOCATION_PATH } from './constants'
import { MemoryFileStore } from '../../utils/memoryFileStore'

let fileStore: MemoryFileStore

beforeEach(() => {
  fileStore = new MemoryFileStore()
})

describe('makeId', () => {
  it('returns a non-empty string', () => {
    const id = makeId()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeId()))
    expect(ids.size).toBe(50)
  })
})

describe('loadCustomRatios', () => {
  it('returns an empty array when nothing is stored', async () => {
    await expect(loadCustomRatios(fileStore)).resolves.toEqual([])
  })

  it('returns the ratios written to allocation.json', async () => {
    const ratio = { id: 'test', name: 'Test', scope: 'total' as const, groups: [] }
    await fileStore.writeJSON(ALLOCATION_PATH, [ratio])
    const result = await loadCustomRatios(fileStore)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test')
  })

  it('returns an empty array when allocation.json is corrupt', async () => {
    await fileStore.writeCSV(ALLOCATION_PATH, [['broken{']])
    await expect(loadCustomRatios(fileStore)).resolves.toEqual([])
  })
})

describe('saveCustomRatios', () => {
  it('dispatches allocation-changed event', async () => {
    const spy = vi.fn()
    window.addEventListener('allocation-changed', spy)
    await saveCustomRatios(fileStore, [{ id: 'a', name: 'R1', scope: 'fi' as const, groups: [] }])
    expect(spy).toHaveBeenCalledTimes(1)
    window.removeEventListener('allocation-changed', spy)
  })

  it('persists ratios to allocation.json', async () => {
    await saveCustomRatios(fileStore, [{ id: 'a', name: 'R1', scope: 'fi' as const, groups: [] }])
    const raw = await fileStore.readJSON<Record<string, unknown>[]>(ALLOCATION_PATH, [])
    expect(raw).toHaveLength(1)
    expect(raw[0].name).toBe('R1')
  })
})

describe('makeDefaultRatio', () => {
  it('returns a ratio with id, name, and two groups', () => {
    const r = makeDefaultRatio()
    expect(r.id).toBeTruthy()
    expect(r.name).toBe('New Ratio')
    expect(r.scope).toBe('total')
    expect(r.groups).toHaveLength(2)
    expect(r.groups[0].label).toBe('Group A')
    expect(r.groups[1].label).toBe('Group B')
    expect(r.groups[0].classes).toEqual([])
    expect(r.groups[1].classes).toEqual([])
  })

  it('generates unique IDs across calls', () => {
    const a = makeDefaultRatio()
    const b = makeDefaultRatio()
    expect(a.id).not.toBe(b.id)
  })
})
