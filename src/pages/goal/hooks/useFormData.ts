import { useState, ChangeEvent } from 'react'
import { FinancialGoal } from '../../../types'

export interface FormData {
  goalName: string
  goalCreatedIn: string
  goalEndYear: string
  resetExpenseMonth: boolean
  retirementAge: string
  expenseMonth: string
  expenseValue: string
  monthlyExpenseValue: string
  inflationRate: string
  safeWithdrawalRate: string
  growth: string
}

const defaultFormData: FormData = {
  goalName: '',
  goalCreatedIn: new Date().toISOString().split('T')[0],
  goalEndYear: new Date().getFullYear().toString(),
  resetExpenseMonth: false,
  retirementAge: '',
  expenseMonth: '',
  expenseValue: '',
  monthlyExpenseValue: '',
  inflationRate: '',
  safeWithdrawalRate: '',
  growth: ''
}

export const useFormData = () => {
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [error, setError] = useState<string>('')

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, type } = e.currentTarget

    if (type === 'checkbox') {
      const checked = (e.currentTarget as HTMLInputElement).checked
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }))
    } else {
      let value = e.currentTarget.value
      if (name === 'expenseValue') {
        value = value.replace(/[^0-9]/g, '')
      }
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const populateFromGoal = (goal: FinancialGoal, nameSuffix?: string): void => {
    setFormData({
      goalName: nameSuffix ? `${goal.goalName} ${nameSuffix}` : goal.goalName,
      goalCreatedIn: goal.goalCreatedIn,
      goalEndYear: goal.goalEndYear,
      resetExpenseMonth: goal.resetExpenseMonth,
      retirementAge: goal.retirementAge.toString(),
      expenseMonth: '',
      expenseValue: goal.expenseValue.toString(),
      monthlyExpenseValue: '',
      inflationRate: goal.inflationRate.toString(),
      safeWithdrawalRate: goal.safeWithdrawalRate.toString(),
      growth: goal.growth.toString()
    })
  }

  const resetForm = (): void => {
    setFormData(defaultFormData)
    setError('')
  }

  return {
    formData,
    setFormData,
    error,
    setError,
    handleInputChange,
    populateFromGoal,
    resetForm
  }
}
