import { useState, ChangeEvent } from 'react'
import { FinancialPlan } from '../../../types'

export interface FormData {
  planName: string
  birthday: string
  planCreatedIn: string
  planEndYear: string
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
  planName: '',
  birthday: '',
  planCreatedIn: new Date().toISOString().split('T')[0],
  planEndYear: new Date().getFullYear().toString(),
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
      const value = e.currentTarget.value
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const populateFromPlan = (plan: FinancialPlan): void => {
    setFormData({
      planName: plan.planName,
      birthday: plan.birthday,
      planCreatedIn: plan.planCreatedIn,
      planEndYear: plan.planEndYear,
      resetExpenseMonth: plan.resetExpenseMonth,
      retirementAge: plan.retirementAge.toString(),
      expenseMonth: '',
      expenseValue: plan.expenseValue.toString(),
      monthlyExpenseValue: '',
      inflationRate: plan.inflationRate.toString(),
      safeWithdrawalRate: plan.safeWithdrawalRate.toString(),
      growth: plan.growth.toString()
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
    populateFromPlan,
    resetForm
  }
}
