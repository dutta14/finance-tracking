import { describe, it, expect } from 'vitest'
import { GOAL_TEMPLATES, GoalTemplate } from './goalTemplates'

describe('goalTemplates', () => {
  it('has exactly 5 templates', () => {
    expect(GOAL_TEMPLATES).toHaveLength(5)
  })

  it('has unique ids', () => {
    const ids = GOAL_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(GOAL_TEMPLATES)('$id has all required fields with correct types', (template: GoalTemplate) => {
    expect(typeof template.id).toBe('string')
    expect(template.id.length).toBeGreaterThan(0)
    expect(typeof template.name).toBe('string')
    expect(template.name.length).toBeGreaterThan(0)
    expect(typeof template.description).toBe('string')
    expect(template.description.length).toBeGreaterThan(0)
    expect(typeof template.retirementAge).toBe('number')
    expect(typeof template.annualExpense).toBe('number')
    expect(typeof template.inflationRate).toBe('number')
    expect(typeof template.safeWithdrawalRate).toBe('number')
    expect(typeof template.growth).toBe('number')
  })

  it.each(GOAL_TEMPLATES)('$id has reasonable value ranges', (template: GoalTemplate) => {
    expect(template.retirementAge).toBeGreaterThan(0)
    expect(template.retirementAge).toBeLessThanOrEqual(100)
    expect(template.annualExpense).toBeGreaterThan(0)
    expect(template.inflationRate).toBeGreaterThanOrEqual(0)
    expect(template.inflationRate).toBeLessThan(20)
    expect(template.safeWithdrawalRate).toBeGreaterThan(0)
    expect(template.safeWithdrawalRate).toBeLessThan(20)
    expect(template.growth).toBeGreaterThan(0)
    expect(template.growth).toBeLessThan(30)
  })
})
