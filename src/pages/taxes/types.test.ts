import { describe, it, expect, beforeEach } from 'vitest'
import {
  EMPTY_STORE,
  getEmptyYear,
  loadTemplates,
  saveTemplates,
} from './types'
import type { TaxTemplate } from './types'

beforeEach(() => {
  localStorage.clear()
})

describe('constants', () => {
  it('EMPTY_STORE has empty years object', () => {
    expect(EMPTY_STORE).toEqual({ years: {} })
  })

  it('getEmptyYear returns object with empty items array', () => {
    const year = getEmptyYear()
    expect(year).toEqual({ items: [] })
  })

  it('getEmptyYear returns a new object each call', () => {
    const a = getEmptyYear()
    const b = getEmptyYear()
    expect(a).not.toBe(b)
  })
})

describe('loadTemplates', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadTemplates()).toEqual([])
  })

  it('returns parsed templates from localStorage', () => {
    const templates: TaxTemplate[] = [
      { id: '1', name: 'Standard', items: [{ label: 'W-2', owner: 'primary', category: 'paystub' }] },
    ]
    localStorage.setItem('tax-templates', JSON.stringify(templates))
    const result = loadTemplates()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Standard')
    expect(result[0].items[0].label).toBe('W-2')
  })

  it('returns empty array on corrupt JSON', () => {
    localStorage.setItem('tax-templates', '{broken')
    expect(loadTemplates()).toEqual([])
  })
})

describe('saveTemplates', () => {
  it('persists templates to localStorage', () => {
    const templates: TaxTemplate[] = [
      { id: '2', name: 'Custom', items: [] },
    ]
    saveTemplates(templates)
    const raw = JSON.parse(localStorage.getItem('tax-templates')!)
    expect(raw).toHaveLength(1)
    expect(raw[0].name).toBe('Custom')
  })

  it('overwrites existing templates', () => {
    saveTemplates([{ id: '1', name: 'First', items: [] }])
    saveTemplates([{ id: '2', name: 'Second', items: [] }])
    const raw = JSON.parse(localStorage.getItem('tax-templates')!)
    expect(raw).toHaveLength(1)
    expect(raw[0].name).toBe('Second')
  })
})
