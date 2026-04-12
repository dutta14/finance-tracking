import { Profile } from '../../hooks/useProfile'

export type AccountType = 'retirement' | 'non-retirement' | 'liquid' | 'illiquid'
export type AccountOwner = 'primary' | 'partner' | 'joint'
export type AccountGoalType = 'fi' | 'gw'
export type AccountStatus = 'active' | 'inactive'
export type AccountNature = 'asset' | 'liability'
export type AssetAllocation = 'cash' | 'us-stock' | 'intl-stock' | 'bonds' | 'real-estate' | 'others' | 'debt'

export interface Account {
  id: number
  name: string
  type: AccountType
  owner: AccountOwner
  status: AccountStatus
  goalType: AccountGoalType
  nature: AccountNature
  allocation: AssetAllocation
  institution?: string
}

export interface BalanceEntry {
  id: number
  accountId: number
  month: string // YYYY-MM
  balance: number
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  retirement: 'Retirement',
  'non-retirement': 'Non-Retirement',
  liquid: 'Liquid',
  illiquid: 'Illiquid',
}

export const FI_TYPES: AccountType[] = ['retirement', 'non-retirement']
export const GW_TYPES: AccountType[] = ['liquid', 'illiquid']

export const getTypesForGoal = (goal: AccountGoalType): AccountType[] =>
  goal === 'fi' ? FI_TYPES : GW_TYPES

export const getDefaultType = (goal: AccountGoalType): AccountType =>
  goal === 'fi' ? 'retirement' : 'liquid'

export const getOwnerLabels = (profile: Profile): Record<AccountOwner, string> => ({
  primary: profile.name || 'Primary',
  partner: profile.partner?.name || 'Partner',
  joint: 'Joint',
})

export const GOAL_TYPE_LABELS: Record<AccountGoalType, string> = {
  fi: 'FI',
  gw: 'GW',
}

export const NATURE_LABELS: Record<AccountNature, string> = {
  asset: 'Asset',
  liability: 'Liability',
}

export const ALLOCATION_LABELS: Record<AssetAllocation, string> = {
  cash: 'Cash',
  'us-stock': 'US Stock',
  'intl-stock': 'Intl Stock',
  bonds: 'Bonds',
  'real-estate': 'Real Estate',
  others: 'Others',
  debt: 'Debt',
}

export const getDefaultAllocation = (nature: AccountNature): AssetAllocation =>
  nature === 'liability' ? 'debt' : 'cash'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const formatMonth = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

export const formatCurrency = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
