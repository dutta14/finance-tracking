import { createContext, useContext, useState, useCallback, useEffect, useMemo, FC, ReactNode } from 'react'
import type { Account, BalanceEntry } from '../pages/data/types'
import { useFileStore } from './FileStoreContext'
import { loadBalances, saveBalances } from '../utils/balanceStorage'

const ACCOUNTS_PATH = 'accounts.json'

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

export const DataProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { fileStore } = useFileStore()
  const [accounts, setAccountsState] = useState<Account[]>([])
  const [balances, setBalancesState] = useState<BalanceEntry[]>([])

  const allMonths = useMemo(() => [...new Set(balances.map(b => b.month))].sort(), [balances])

  const setAccounts = useCallback(
    (updated: Account[]) => {
      setAccountsState(updated)
      fileStore.writeJSON(ACCOUNTS_PATH, updated).catch(console.error)
    },
    [fileStore],
  )

  const setBalances = useCallback(
    (updated: BalanceEntry[]) => {
      setBalancesState(updated)
      saveBalances(fileStore, updated).catch(console.error)
    },
    [fileStore],
  )

  useEffect(() => {
    let cancelled = false

    const refreshAccounts = () => {
      fileStore
        .readJSON<Account[]>(ACCOUNTS_PATH, [])
        .then(next => {
          if (!cancelled) setAccountsState(next)
        })
        .catch(console.error)
    }

    const refreshBalances = () => {
      loadBalances(fileStore)
        .then(next => {
          if (!cancelled) setBalancesState(next)
        })
        .catch(console.error)
    }

    refreshAccounts()
    refreshBalances()

    const unsubscribe = fileStore.subscribe(ACCOUNTS_PATH, refreshAccounts)
    const handleCustom = () => {
      refreshAccounts()
      refreshBalances()
    }
    window.addEventListener('data-changed', handleCustom)

    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('data-changed', handleCustom)
    }
  }, [fileStore])

  const value = useMemo<DataContextValue>(
    () => ({ accounts, balances, allMonths, setAccounts, setBalances }),
    [accounts, balances, allMonths, setAccounts, setBalances],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export default DataContext
