export interface GoalTemplate {
  id: string
  name: string
  description: string
  retirementAge: number
  annualExpense: number
  growth: number
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'early-retirement',
    name: 'Early Retirement',
    description: 'Retire at 45 on $40k/yr, lean and free',
    retirementAge: 45,
    annualExpense: 40000,
    growth: 8.0,
  },
  {
    id: 'standard-retirement',
    name: 'Standard Retirement',
    description: 'Classic path, retire at 60 comfortably',
    retirementAge: 60,
    annualExpense: 60000,
    growth: 7.0,
  },
  {
    id: 'coast-fi',
    name: 'Coast FI',
    description: 'Front-load savings, coast from 40',
    retirementAge: 40,
    annualExpense: 50000,
    growth: 8.0,
  },
  {
    id: 'fat-fi',
    name: 'Fat FI',
    description: 'Premium lifestyle, retire at 50',
    retirementAge: 50,
    annualExpense: 120000,
    growth: 7.0,
  },
  {
    id: 'barista-fi',
    name: 'Barista FI',
    description: 'Part-time work + investments at 50',
    retirementAge: 50,
    annualExpense: 45000,
    growth: 8.0,
  },
]
