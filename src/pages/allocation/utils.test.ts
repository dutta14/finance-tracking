import { describe, it, expect, beforeEach } from 'vitest'
import { makeId, loadCustomRatios, saveCustomRatios, makeDefaultRatio } from './utils'

beforeEach(() => {
  localStorage.clear()
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
  it('returns empty array when nothing stored', () => {
    expect(loadCustomRatios()).toEqual([])
  })

  it('returns parsed ratios from localStorage', () => {
    const ratio = { id: 'test', name: 'Test', scope: 'total', groups: [] }
    localStorage.setItem('allocation-custom-ratios', JSON.stringify([ratio]))
    const result = loadCustomRatios()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test')
  })

  it('returns empty array on corrupt JSON', () => {
    localStorage.setItem('allocation-custom-ratios', 'broken{')
    expect(loadCustomRatios()).toEqual([])
  })
})

describe('saveCustomRatios', () => {
  it('persists ratios to localStorage', () => {
    const ratio = { id: 'a', name: 'R1', scope: 'fi' as const, groups: [] }
    saveCustomRatios([ratio])
    const raw = JSON.parse(localStorage.getItem('allocation-custom-ratios')!)
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
