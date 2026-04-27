export interface GoalTemplate {
  id: string
  name: string
  description: string
  retirementAge: number
  annualExpense: number
  inflationRate: number
  safeWithdrawalRate: number
  growth: number
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'early-retirement',
    name: 'Early Retirement',
    description: 'Retire at 45 on $40k/yr — lean and free',
    retirementAge: 45,
    annualExpense: 40000,
    inflationRate: 3.0,
    safeWithdrawalRate: 4.0,
    growth: 8.0,
  },
  {
    id: 'standard-retirement',
    name: 'Standard Retirement',
    description: 'The classic path — retire at 60 comfortably',
    retirementAge: 60,
    annualExpense: 60000,
    inflationRate: 3.0,
    safeWithdrawalRate: 4.0,
    growth: 7.0,
  },
  {
    id: 'coast-fi',
    name: 'Coast FI',
    description: 'Front-load savings, then coast from 40',
    retirementAge: 40,
    annualExpense: 50000,
    inflationRate: 3.0,
    safeWithdrawalRate: 4.0,
    growth: 8.0,
  },
  {
    id: 'fat-fi',
    name: 'Fat FI',
    description: 'Retire at 50 with $120k/yr for a premium lifestyle',
    retirementAge: 50,
    annualExpense: 120000,
    inflationRate: 3.0,
    safeWithdrawalRate: 3.5,
    growth: 7.0,
  },
  {
    id: 'barista-fi',
    name: 'Barista FI',
    description: 'Part-time income + investments = freedom at 50',
    retirementAge: 50,
    annualExpense: 45000,
    inflationRate: 3.0,
    safeWithdrawalRate: 4.0,
    growth: 8.0,
  },
]
