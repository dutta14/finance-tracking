import { createContext, useContext, useState, useCallback, useEffect, useMemo, FC, ReactNode } from 'react'
import type { Account, BalanceEntry } from '../pages/data/types'
import { appStorage } from '../utils/appStorage'

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
  return appStorage.getJSON<Account[]>('data-accounts', [])
}
function loadBalances(): BalanceEntry[] {
  return appStorage.getJSON<BalanceEntry[]>('data-balances', [])
}

export const DataProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccountsState] = useState<Account[]>(loadAccounts)
  const [balances, setBalancesState] = useState<BalanceEntry[]>(loadBalances)

  const allMonths = useMemo(() => [...new Set(balances.map(b => b.month))].sort(), [balances])

  const setAccounts = useCallback((updated: Account[]) => {
    setAccountsState(updated)
    appStorage.setJSON('data-accounts', updated)
  }, [])

  const setBalances = useCallback((updated: BalanceEntry[]) => {
    setBalancesState(updated)
    appStorage.setJSON('data-balances', updated)
  }, [])

  useEffect(() => {
    const unsub1 = appStorage.subscribe('data-accounts', () => {
      setAccountsState(loadAccounts())
    })
    const unsub2 = appStorage.subscribe('data-balances', () => {
      setBalancesState(loadBalances())
    })
    const handleCustom = () => {
      setAccountsState(loadAccounts())
      setBalancesState(loadBalances())
    }
    window.addEventListener('data-changed', handleCustom)
    return () => {
      unsub1()
      unsub2()
      window.removeEventListener('data-changed', handleCustom)
    }
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({ accounts, balances, allMonths, setAccounts, setBalances }),
    [accounts, balances, allMonths, setAccounts, setBalances],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export default DataContext
