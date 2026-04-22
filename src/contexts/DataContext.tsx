import { createContext, useContext, useState, useCallback, useEffect, useMemo, FC, ReactNode } from 'react'
import type { Account, BalanceEntry } from '../pages/data/types'

interface DataContextValue {
  accounts: Account[]
  balances: BalanceEntry[]
  allMonths: string[]
  setAccounts: (accounts: Account[]) => void
  setBalances: (balances: BalanceEntry[]) => void
}

const DataContext = createContext<DataContextValue>({
  accounts: [],
  balances: [],
  allMonths: [],
  setAccounts: () => {},
  setBalances: () => {},
})

export const useData = () => useContext(DataContext)

function loadAccounts(): Account[] {
  try { return JSON.parse(localStorage.getItem('data-accounts') || '[]') } catch { return [] }
}
function loadBalances(): BalanceEntry[] {
  try { return JSON.parse(localStorage.getItem('data-balances') || '[]') } catch { return [] }
}

export const DataProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccountsState] = useState<Account[]>(loadAccounts)
  const [balances, setBalancesState] = useState<BalanceEntry[]>(loadBalances)

  const allMonths = useMemo(
    () => [...new Set(balances.map(b => b.month))].sort(),
    [balances]
  )

  const setAccounts = useCallback((updated: Account[]) => {
    setAccountsState(updated)
    localStorage.setItem('data-accounts', JSON.stringify(updated))
  }, [])

  const setBalances = useCallback((updated: BalanceEntry[]) => {
    setBalancesState(updated)
    localStorage.setItem('data-balances', JSON.stringify(updated))
  }, [])

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'data-accounts') setAccountsState(loadAccounts())
      if (e.key === 'data-balances') setBalancesState(loadBalances())
    }
    const handleCustom = () => {
      setAccountsState(loadAccounts())
      setBalancesState(loadBalances())
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('data-changed', handleCustom)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('data-changed', handleCustom)
    }
  }, [])

  return (
    <DataContext.Provider value={{ accounts, balances, allMonths, setAccounts, setBalances }}>
      {children}
    </DataContext.Provider>
  )
}

export default DataContext
