import { describe, it, expect } from 'vitest'
import { calcMonthlySaving, monthsBetween, getRetirementMonth } from './goalMath'

describe('goalMath', () => {
  describe('monthsBetween', () => {
    it('returns positive months between two dates', () => {
      expect(monthsBetween('2024-01', '2025-01')).toBe(12)
    })

    it('returns 0 for same month', () => {
      expect(monthsBetween('2024-06', '2024-06')).toBe(0)
    })

    it('returns negative for reversed dates', () => {
      expect(monthsBetween('2025-01', '2024-01')).toBe(-12)
    })

    it('handles partial years', () => {
      expect(monthsBetween('2024-03', '2024-09')).toBe(6)
    })
  })

  describe('getRetirementMonth', () => {
    it('adds retirementAge years to birthday year', () => {
      expect(getRetirementMonth('1990-06-15', 55)).toBe('2045-06')
    })

    it('pads single-digit months', () => {
      expect(getRetirementMonth('1985-01-01', 65)).toBe('2050-01')
    })
  })

  describe('calcMonthlySaving', () => {
    it('returns 0 when nMonths <= 0', () => {
      expect(calcMonthlySaving(100000, 500000, 8, 0)).toBe(0)
      expect(calcMonthlySaving(100000, 500000, 8, -5)).toBe(0)
    })

    it('returns simple division when rate is 0', () => {
      expect(calcMonthlySaving(0, 12000, 0, 12)).toBe(1000)
    })

    it('returns 0 when present value already exceeds future value needed', () => {
      // pv=1M, fv=500k, rate=8%, 120 months → pv grows past fv
      expect(calcMonthlySaving(1_000_000, 500_000, 8, 120)).toBe(0)
    })

    it('calculates correct monthly saving for standard inputs', () => {
      // pv=0, fv=1M, rate=8%, 240 months
      const result = calcMonthlySaving(0, 1_000_000, 8, 240)
      // Expected ~$1,698/mo at 8% over 20 years
      expect(result).toBeGreaterThan(1600)
      expect(result).toBeLessThan(1800)
    })

    it('accounts for existing balance reducing required saving', () => {
      const withoutPV = calcMonthlySaving(0, 1_000_000, 8, 240)
      const withPV = calcMonthlySaving(200_000, 1_000_000, 8, 240)
      expect(withPV).toBeLessThan(withoutPV)
    })
  })
})
