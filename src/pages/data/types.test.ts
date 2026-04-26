import { describe, it, expect } from 'vitest'
import type { Profile } from '../../hooks/useProfile'
import {
  getTypesForGoal,
  getDefaultType,
  getDefaultAllocation,
  formatMonth,
  formatCurrency,
  getOwnerLabels,
} from './types'

describe('getTypesForGoal', () => {
  it('returns FI types for "fi"', () => {
    expect(getTypesForGoal('fi')).toEqual(['retirement', 'non-retirement'])
  })

  it('returns GW types for "gw"', () => {
    expect(getTypesForGoal('gw')).toEqual(['liquid', 'illiquid'])
  })
})

describe('getDefaultType', () => {
  it('returns "retirement" for fi', () => {
    expect(getDefaultType('fi')).toBe('retirement')
  })

  it('returns "liquid" for gw', () => {
    expect(getDefaultType('gw')).toBe('liquid')
  })
})

describe('getDefaultAllocation', () => {
  it('returns "debt" for liability', () => {
    expect(getDefaultAllocation('liability')).toBe('debt')
  })

  it('returns "cash" for asset', () => {
    expect(getDefaultAllocation('asset')).toBe('cash')
  })
})

describe('formatMonth', () => {
  it('formats "2025-01" as "Jan 2025"', () => {
    expect(formatMonth('2025-01')).toBe('Jan 2025')
  })

  it('formats "2024-12" as "Dec 2024"', () => {
    expect(formatMonth('2024-12')).toBe('Dec 2024')
  })

  it('formats "2020-06" as "Jun 2020"', () => {
    expect(formatMonth('2020-06')).toBe('Jun 2020')
  })
})

describe('formatCurrency', () => {
  it('formats positive numbers with $ and commas', () => {
    expect(formatCurrency(1500000)).toBe('$1,500,000')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('formats negative numbers', () => {
    expect(formatCurrency(-5000)).toBe('-$5,000')
  })

  it('rounds to no decimal places', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235')
  })
})

describe('getOwnerLabels', () => {
  it('uses profile names when available', () => {
    const profile = { name: 'Alice', birthday: '1990-01-01', partner: { name: 'Bob', birthday: '1991-02-02' } }
    const labels = getOwnerLabels(profile)
    expect(labels.primary).toBe('Alice')
    expect(labels.partner).toBe('Bob')
    expect(labels.joint).toBe('Joint')
  })

  it('falls back to defaults when names are empty', () => {
    const profile = { name: '', birthday: '', partner: undefined }
    const labels = getOwnerLabels(profile as Profile)
    expect(labels.primary).toBe('Primary')
    expect(labels.partner).toBe('Partner')
  })
})
