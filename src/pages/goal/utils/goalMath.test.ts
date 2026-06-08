import { describe, it, expect } from 'vitest'
import { makeAccount, makeBalanceEntry, makeGoal, makeGwGoal } from '../../../test/factories'
import { calcMonthlySaving, getFiBreakdown, getGwTarget, getRetirementMonth, getTotalForMonth, monthsBetween } from './goalMath'

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

  describe('getTotalForMonth', () => {
    const month = '2024-01'

    it('returns 0 when an account has no matching balance for the selected month', () => {
      const accounts = [makeAccount({ id: 1, goalType: 'fi' })]
      const balances = [makeBalanceEntry({ accountId: 1, month: '2024-02', balance: 50_000 })]

      expect(getTotalForMonth(accounts, balances, month, 'fi')).toBe(0)
    })
  })

  describe('getFiBreakdown', () => {
    const month = '2024-01'

    it('categorizes retirement primary accounts correctly', () => {
      const accounts = [makeAccount({ id: 1, goalType: 'fi', type: 'retirement', owner: 'primary' })]
      const balances = [makeBalanceEntry({ accountId: 1, month, balance: 125_000 })]

      expect(getFiBreakdown(accounts, balances, month)).toEqual({
        retirementPrimary: 125_000,
        retirementPartner: 0,
        nonRetirement: 0,
        total: 125_000,
      })
    })

    it('categorizes retirement partner accounts correctly', () => {
      const accounts = [makeAccount({ id: 2, goalType: 'fi', type: 'retirement', owner: 'partner' })]
      const balances = [makeBalanceEntry({ accountId: 2, month, balance: 80_000 })]

      expect(getFiBreakdown(accounts, balances, month)).toEqual({
        retirementPrimary: 0,
        retirementPartner: 80_000,
        nonRetirement: 0,
        total: 80_000,
      })
    })

    it('categorizes non-retirement accounts correctly', () => {
      const accounts = [makeAccount({ id: 3, goalType: 'fi', type: 'non-retirement' })]
      const balances = [makeBalanceEntry({ accountId: 3, month, balance: 45_000 })]

      expect(getFiBreakdown(accounts, balances, month)).toEqual({
        retirementPrimary: 0,
        retirementPartner: 0,
        nonRetirement: 45_000,
        total: 45_000,
      })
    })

    it('sums balances from multiple accounts of the same type', () => {
      const accounts = [
        makeAccount({ id: 4, goalType: 'fi', type: 'retirement', owner: 'primary' }),
        makeAccount({ id: 5, goalType: 'fi', type: 'retirement', owner: 'primary' }),
      ]
      const balances = [
        makeBalanceEntry({ accountId: 4, month, balance: 100_000 }),
        makeBalanceEntry({ accountId: 5, month, balance: 150_000 }),
      ]

      expect(getFiBreakdown(accounts, balances, month).retirementPrimary).toBe(250_000)
    })

    it('handles accounts with no matching balance by returning 0', () => {
      const accounts = [makeAccount({ id: 6, goalType: 'fi', type: 'retirement', owner: 'primary' })]

      expect(getFiBreakdown(accounts, [], month)).toEqual({
        retirementPrimary: 0,
        retirementPartner: 0,
        nonRetirement: 0,
        total: 0,
      })
    })

    it('ignores balances from other months non-fi accounts and unsupported account types', () => {
      const accounts = [
        makeAccount({ id: 7, goalType: 'gw', type: 'retirement', owner: 'primary' }),
        makeAccount({ id: 8, goalType: 'fi', type: 'liquid', owner: 'joint' }),
      ]
      const balances = [
        makeBalanceEntry({ accountId: 7, month, balance: 75_000 }),
        makeBalanceEntry({ accountId: 8, month: '2024-02', balance: 30_000 }),
      ]

      expect(getFiBreakdown(accounts, balances, month)).toEqual({
        retirementPrimary: 0,
        retirementPartner: 0,
        nonRetirement: 0,
        total: 0,
      })
    })
  })

  describe('getGwTarget', () => {
    const goal = makeGoal({
      id: 42,
      goalCreatedIn: '2024-01-01',
      retirementAge: 45,
      inflationRate: 3,
    })
    const profileBirthday = '1990-06-15'

    it('returns 0 when no GW goals match the FI goal', () => {
      const unrelatedGoal = makeGwGoal({ fiGoalId: 999 })

      expect(getGwTarget(goal, [unrelatedGoal], profileBirthday)).toBe(0)
    })

    it('computes a target from a single GW goal with inflation and growth adjustments', () => {
      const gwGoal = makeGwGoal({
        fiGoalId: 42,
        disburseAge: 50,
        disburseAmount: 100_000,
        growthRate: 6,
      })

      const monthsUntilDisbursement = (1990 + 50 - 2024) * 12 + (6 - 1)
      const inflatedDisbursement = 100_000 * Math.pow(1 + 3 / 100 / 12, monthsUntilDisbursement)
      const monthsFromRetirementToDisbursement = (50 - 45) * 12
      const expected = inflatedDisbursement / Math.pow(1 + 6 / 100 / 12, monthsFromRetirementToDisbursement)

      expect(getGwTarget(goal, [gwGoal], profileBirthday)).toBeCloseTo(expected, 5)
    })

    it('does not discount the target when disbursement happens at retirement age', () => {
      const sameAgeGoal = makeGwGoal({
        fiGoalId: 42,
        disburseAge: 45,
        disburseAmount: 50_000,
        growthRate: 6,
      })

      const monthsUntilDisbursement = (1990 + 45 - 2024) * 12 + (6 - 1)
      const expected = 50_000 * Math.pow(1 + 3 / 100 / 12, monthsUntilDisbursement)

      expect(getGwTarget(goal, [sameAgeGoal], profileBirthday)).toBeCloseTo(expected, 5)
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
      expect(calcMonthlySaving(1_000_000, 500_000, 8, 120)).toBe(0)
    })

    it('calculates correct monthly saving for standard inputs', () => {
      const result = calcMonthlySaving(0, 1_000_000, 8, 240)
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
