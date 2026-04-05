import { FC } from 'react'

export type PageType = 'home' | 'plan' | 'plan-solo'

export interface FinancialPlan {
  id: number
  planName: string
  createdAt: string
  
  // Personal & Timeline Info
  birthday: string
  planCreatedIn: string
  planEndYear: string
  resetExpenseMonth: boolean
  retirementAge: number
  
  // Expense Details
  expenseMonth: number
  expenseValue: number
  monthlyExpenseValue: number
  expenseValueMar2026: number
  expenseValue2047: number
  monthlyExpense2047: number
  
  // Financial Parameters
  inflationRate: number
  safeWithdrawalRate: number
  growth: number
  
  // Calculated Fields
  retirement: string
  fiGoal: number
  progress: number
}

export interface GwPlan {
  id: number
  fiPlanId: number
  label: string
  createdAt: string
  disburseAge: number
  disburseAmount: number   // in plan-creation-year (today's) dollars
  growthRate: number       // % per year, independent of FI growth rate
  currentSavings: number   // current savings allocated toward this goal
}

export interface NavigationProps {
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export type PageRenderer = {
  [key in PageType]: FC<any>
}
