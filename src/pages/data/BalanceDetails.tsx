import { FC } from 'react'
import { Account, BalanceEntry } from './types'

interface BalanceDetailsProps {
  accounts: Account[]
  balances: BalanceEntry[]
  allMonths: string[]
  balanceMap: Map<string, number>
}

const BalanceDetails: FC<BalanceDetailsProps> = ({
  accounts: _accounts,
  balances: _balances,
  allMonths: _allMonths,
  balanceMap: _balanceMap,
}) => {
  return <div className="balance-details">Details</div>
}

export default BalanceDetails
