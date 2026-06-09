import { FinancialGoal, GwGoal } from '../../../types'
import { Account, BalanceEntry } from '../../data/types'

export const getTotalForMonth = (
  accounts: Account[],
  balances: BalanceEntry[],
  month: string,
  goalType: 'fi' | 'gw',
): number => {
  const balMap = new Map<number, number>()
  for (const b of balances) if (b.month === month) balMap.set(b.accountId, b.balance)
  return accounts.filter(a => a.goalType === goalType).reduce((sum, a) => sum + (balMap.get(a.id) ?? 0), 0)
}

export interface FiBreakdown {
  retirementPrimary: number
  retirementPartner: number
  nonRetirement: number
  total: number
}

export const getFiBreakdown = (accounts: Account[], balances: BalanceEntry[], month: string): FiBreakdown => {
  const balMap = new Map<number, number>()
  for (const b of balances) if (b.month === month) balMap.set(b.accountId, b.balance)
  let retirementPrimary = 0
  let retirementPartner = 0
  let nonRetirement = 0
  for (const a of accounts) {
    if (a.goalType !== 'fi') continue
    const bal = balMap.get(a.id) ?? 0
    if (a.type === 'retirement' && a.owner === 'primary') retirementPrimary += bal
    else if (a.type === 'retirement' && a.owner === 'partner') retirementPartner += bal
    else if (a.type === 'non-retirement') nonRetirement += bal
  }
  return {
    retirementPrimary,
    retirementPartner,
    nonRetirement,
    total: retirementPrimary + retirementPartner + nonRetirement,
  }
}

export const getRetirementMonth = (birthday: string, retirementAge: number): string => {
  const [by, bm] = birthday.split('-').map(Number)
  const retYear = by + retirementAge
  const mm = String(bm).padStart(2, '0')
  return `${retYear}-${mm}`
}

export const monthsBetween = (from: string, to: string): number => {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

export const calcMonthlySaving = (pv: number, fv: number, annualRate: number, nMonths: number): number => {
  if (nMonths <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return Math.max(0, (fv - pv) / nMonths)
  const factor = Math.pow(1 + r, nMonths)
  const needed = fv - pv * factor
  if (needed <= 0) return 0
  return (needed * r) / (factor - 1)
}

export const getGwTarget = (
  goal: FinancialGoal,
  gwGoals: GwGoal[],
  profileBirthday: string,
  inflation: number,
): number => {
  const goalGws = gwGoals.filter(g => g.fiGoalId === goal.id)
  if (goalGws.length === 0) return 0
  const [by, bm] = profileBirthday.split('-').map(Number)
  const created = new Date(goal.goalCreatedIn)
  return goalGws.reduce((sum, gw) => {
    const disburseYear = by + gw.disburseAge
    const months = Math.max(0, (disburseYear - created.getUTCFullYear()) * 12 + (bm - (created.getUTCMonth() + 1)))
    const disbTarget = gw.disburseAmount * Math.pow(1 + inflation / 100 / 12, months)
    const mRetToDisb = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
    const pv = mRetToDisb > 0 ? disbTarget / Math.pow(1 + gw.growthRate / 100 / 12, mRetToDisb) : disbTarget
    return sum + pv
  }, 0)
}
