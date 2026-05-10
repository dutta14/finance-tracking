import { describe, it, expect } from 'vitest'
import { delta } from './savingsCalc'

describe('delta', () => {
  it('computes positive YoY growth', () => {
    expect(delta(110, 100)).toBeCloseTo(10)
  })

  it('computes negative YoY decline', () => {
    expect(delta(90, 100)).toBeCloseTo(-10)
  })

  it('returns null when previous value is 0 (division by zero)', () => {
    expect(delta(100, 0)).toBeNull()
  })

  it('handles both values being 0', () => {
    expect(delta(0, 0)).toBeNull()
  })

  it('computes correctly with negative previous value', () => {
    // -100 to -50: improvement of 50%. Uses Math.abs(prev) = 100
    expect(delta(-50, -100)).toBeCloseTo(50)
  })

  it('computes correctly when going from negative to positive', () => {
    // -100 to 100: (100 - (-100)) / abs(-100) * 100 = 200%
    expect(delta(100, -100)).toBeCloseTo(200)
  })

  it('computes 0% when values are equal', () => {
    expect(delta(500, 500)).toBeCloseTo(0)
  })

  it('handles large percentage changes', () => {
    expect(delta(1000, 10)).toBeCloseTo(9900)
  })

  it('handles fractional values', () => {
    expect(delta(1.5, 1.0)).toBeCloseTo(50)
  })
})
