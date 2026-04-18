import { describe, it, expect } from 'vitest'
import { ALLOC_COLORS, ALL_CLASSES, PRESETS, GROUP_COLORS, STORAGE_KEY } from './constants'

describe('ALLOC_COLORS', () => {
  it('has a color for every allocation class', () => {
    for (const cls of ALL_CLASSES) {
      expect(ALLOC_COLORS[cls]).toBeTruthy()
      expect(ALLOC_COLORS[cls]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('ALL_CLASSES', () => {
  it('contains all 7 asset allocation types', () => {
    expect(ALL_CLASSES).toHaveLength(7)
    expect(ALL_CLASSES).toContain('us-stock')
    expect(ALL_CLASSES).toContain('intl-stock')
    expect(ALL_CLASSES).toContain('bonds')
    expect(ALL_CLASSES).toContain('cash')
    expect(ALL_CLASSES).toContain('real-estate')
    expect(ALL_CLASSES).toContain('others')
    expect(ALL_CLASSES).toContain('debt')
  })
})

describe('PRESETS', () => {
  it('has at least 3 presets', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(3)
  })

  it('each preset has id, name, scope, and at least 2 groups', () => {
    for (const p of PRESETS) {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(['total', 'fi', 'gw']).toContain(p.scope)
      expect(p.groups.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('each group in every preset has a valid color', () => {
    for (const p of PRESETS) {
      for (const g of p.groups) {
        expect(g.color).toMatch(/^#[0-9a-f]{6}$/i)
        expect(g.label).toBeTruthy()
        expect(g.classes.length).toBeGreaterThan(0)
      }
    }
  })

  it('preset class arrays only contain valid allocation types', () => {
    for (const p of PRESETS) {
      for (const g of p.groups) {
        for (const cls of g.classes) {
          expect(ALL_CLASSES).toContain(cls)
        }
      }
    }
  })
})

describe('GROUP_COLORS', () => {
  it('has at least 5 colors', () => {
    expect(GROUP_COLORS.length).toBeGreaterThanOrEqual(5)
  })

  it('all colors are valid hex', () => {
    for (const c of GROUP_COLORS) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('STORAGE_KEY', () => {
  it('is a non-empty string', () => {
    expect(STORAGE_KEY).toBe('allocation-custom-ratios')
  })
})
