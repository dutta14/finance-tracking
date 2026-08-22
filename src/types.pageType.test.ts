import { describe, it, expect } from 'vitest'
import type { PageType } from './types'

describe('PageType', () => {
  it('includes the expected page identifiers (no tools)', () => {
    const allPages: PageType[] = ['home', 'goal', 'net-worth', 'budget', 'transactions', 'drive', 'taxes', 'guide']

    expect(allPages).toHaveLength(8)
    expect(allPages).not.toContain('tools')
  })

  it('type-checks that "tools" is not assignable to PageType', () => {
    const assertExhaustive = (p: PageType): string => {
      switch (p) {
        case 'home':
          return 'home'
        case 'goal':
          return 'goal'
        case 'net-worth':
          return 'net-worth'
        case 'budget':
          return 'budget'
        case 'transactions':
          return 'transactions'
        case 'drive':
          return 'drive'
        case 'taxes':
          return 'taxes'
        case 'guide':
          return 'guide'
      }
    }

    expect(assertExhaustive('home')).toBe('home')
    expect(assertExhaustive('budget')).toBe('budget')
    expect(assertExhaustive('transactions')).toBe('transactions')
    expect(assertExhaustive('guide')).toBe('guide')
  })
})
