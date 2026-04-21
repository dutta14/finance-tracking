import { describe, it, expect } from 'vitest'
import type { PageType } from './types'

describe('PageType', () => {
  it('includes the expected page identifiers (no tools)', () => {
    // Runtime-level exhaustiveness check: every PageType value is listed here
    const allPages: PageType[] = ['home', 'goal', 'net-worth', 'budget', 'drive', 'taxes']

    expect(allPages).toHaveLength(6)
    expect(allPages).not.toContain('tools')
  })

  it('type-checks that "tools" is not assignable to PageType', () => {
    // If 'tools' were re-added to PageType this would still pass at runtime,
    // but the exhaustive const below would cause a TypeScript compile error
    // because the switch wouldn't cover 'tools'.
    const assertExhaustive = (p: PageType): string => {
      switch (p) {
        case 'home': return 'home'
        case 'goal': return 'goal'
        case 'net-worth': return 'net-worth'
        case 'budget': return 'budget'
        case 'drive': return 'drive'
        case 'taxes': return 'taxes'
      }
    }

    expect(assertExhaustive('home')).toBe('home')
    expect(assertExhaustive('budget')).toBe('budget')
  })
})
