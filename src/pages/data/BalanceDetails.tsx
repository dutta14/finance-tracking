import { FC, useEffect, useMemo, useState } from 'react'
import MonthPicker from '../../components/MonthPicker'
import { Profile } from '../../hooks/useProfile'
import { Account, AccountOwner, BalanceEntry, formatCurrency, getOwnerLabels } from './types'

interface BalanceDetailsProps {
  accounts: Account[]
  balances: BalanceEntry[]
  allMonths: string[]
  balanceMap: Map<string, number>
  profile: Profile
  showInactive: boolean
}

type AccountSection = 'asset' | 'liability'

type BalanceLookup = {
  month: string | undefined
  balanceMap: Map<string, number>
}

type OwnerDisplayItem =
  | {
      kind: 'account'
      account: Account
      section: AccountSection
      statusRank: number
      order: number
    }
  | {
      kind: 'group'
      groupName: string
      accounts: Account[]
      section: AccountSection
      statusRank: number
      order: number
    }

const groupAccounts = (ownerAccounts: Account[]) => {
  const groups = new Map<string, Account[]>()
  const groupOrder: string[] = []
  const ungrouped: Account[] = []

  ownerAccounts.forEach(account => {
    if (!account.group) {
      ungrouped.push(account)
      return
    }

    const existingGroup = groups.get(account.group)

    if (existingGroup) {
      existingGroup.push(account)
      return
    }

    groups.set(account.group, [account])
    groupOrder.push(account.group)
  })

  return { groups, groupOrder, ungrouped }
}

const getStatusRank = (account: Account) => (account.status === 'active' ? 0 : 1)

const getAccountSection = (account: Account): AccountSection => account.nature || 'asset'

const getBalanceForMonth = (account: Account, { month, balanceMap }: BalanceLookup) => {
  if (!month) return undefined
  return balanceMap.get(`${account.id}:${month}`)
}

const getTotalBalanceForMonth = (accounts: Account[], balanceLookup: BalanceLookup) =>
  accounts.reduce((sum, account) => sum + (getBalanceForMonth(account, balanceLookup) ?? 0), 0)

const sortAccountsByValue = (accounts: Account[], selectedBalanceLookup: BalanceLookup) =>
  [...accounts].sort(
    (a, b) =>
      (getBalanceForMonth(b, selectedBalanceLookup) ?? 0) - (getBalanceForMonth(a, selectedBalanceLookup) ?? 0) ||
      getStatusRank(a) - getStatusRank(b),
  )

const getDisplayItemTotal = (item: OwnerDisplayItem, selectedBalanceLookup: BalanceLookup) =>
  item.kind === 'group'
    ? getTotalBalanceForMonth(item.accounts, selectedBalanceLookup)
    : (getBalanceForMonth(item.account, selectedBalanceLookup) ?? 0)

const buildOwnerDisplayItems = (ownerAccounts: Account[], selectedBalanceLookup: BalanceLookup) => {
  const { groups, groupOrder, ungrouped } = groupAccounts(ownerAccounts)
  const displayItems: OwnerDisplayItem[] = []
  let order = 0

  groupOrder.forEach(groupName => {
    const groupedAccounts = groups.get(groupName) ?? []

    if (groupedAccounts.length === 0) return

    if (groupedAccounts.length === 1) {
      const account = groupedAccounts[0]

      displayItems.push({
        kind: 'account',
        account,
        section: getAccountSection(account),
        statusRank: getStatusRank(account),
        order: order++,
      })
      return
    }

    const sortedAccounts = sortAccountsByValue(groupedAccounts, selectedBalanceLookup)
    const firstAccount = groupedAccounts[0]
    const firstSortedAccount = sortedAccounts[0]

    displayItems.push({
      kind: 'group',
      groupName,
      accounts: sortedAccounts,
      section: getAccountSection(firstAccount),
      statusRank: getStatusRank(firstSortedAccount),
      order: order++,
    })
  })

  ungrouped.forEach(account => {
    displayItems.push({
      kind: 'account',
      account,
      section: getAccountSection(account),
      statusRank: getStatusRank(account),
      order: order++,
    })
  })

  return {
    asset: displayItems
      .filter(item => item.section === 'asset')
      .sort(
        (a, b) =>
          a.statusRank - b.statusRank ||
          getDisplayItemTotal(b, selectedBalanceLookup) - getDisplayItemTotal(a, selectedBalanceLookup) ||
          a.order - b.order,
      ),
    liability: displayItems
      .filter(item => item.section === 'liability')
      .sort(
        (a, b) =>
          a.statusRank - b.statusRank ||
          getDisplayItemTotal(b, selectedBalanceLookup) - getDisplayItemTotal(a, selectedBalanceLookup) ||
          a.order - b.order,
      ),
  } satisfies Record<AccountSection, OwnerDisplayItem[]>
}

const BalanceDetails: FC<BalanceDetailsProps> = ({
  accounts,
  balances: _balances,
  allMonths,
  balanceMap,
  profile,
  showInactive,
}) => {
  const ownerLabels = useMemo(() => getOwnerLabels(profile), [profile])
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0)

  useEffect(() => {
    if (selectedMonthIndex > allMonths.length - 1) {
      setSelectedMonthIndex(Math.max(allMonths.length - 1, 0))
    }
  }, [allMonths.length, selectedMonthIndex])

  const selectedMonth = allMonths[selectedMonthIndex]
  const previousMonth = allMonths[selectedMonthIndex + 1]

  const netWorthTotal = useMemo(() => {
    if (!selectedMonth) return 0

    return accounts.reduce((sum, account) => {
      if (account.status !== 'active') return sum
      return sum + (balanceMap.get(`${account.id}:${selectedMonth}`) ?? 0)
    }, 0)
  }, [accounts, balanceMap, selectedMonth])

  const visibleAccounts = useMemo(
    () => (showInactive ? accounts : accounts.filter(account => account.status !== 'inactive')),
    [accounts, showInactive],
  )

  const accountsByOwner = useMemo<Record<AccountOwner, Account[]>>(
    () =>
      visibleAccounts.reduce(
        (grouped, account) => {
          grouped[account.owner].push(account)
          return grouped
        },
        {
          primary: [],
          partner: [],
          joint: [],
        } as Record<AccountOwner, Account[]>,
      ),
    [visibleAccounts],
  )

  const ownerSubtotals = useMemo<Record<AccountOwner, number>>(
    () =>
      accounts.reduce(
        (totals, account) => {
          if (account.status !== 'active') return totals

          totals[account.owner] += balanceMap.get(`${account.id}:${selectedMonth}`) ?? 0
          return totals
        },
        {
          primary: 0,
          partner: 0,
          joint: 0,
        } as Record<AccountOwner, number>,
      ),
    [accounts, balanceMap, selectedMonth],
  )

  const primaryInitial = (profile.name || ownerLabels.primary || 'P')[0].toUpperCase()
  const partnerInitial = (profile.partner?.name || ownerLabels.partner || 'P')[0].toUpperCase()
  const hasPartner = !!profile.partner

  const selectedBalanceLookup = useMemo(() => ({ month: selectedMonth, balanceMap }), [selectedMonth, balanceMap])
  const previousBalanceLookup = useMemo(() => ({ month: previousMonth, balanceMap }), [previousMonth, balanceMap])

  const getSelectedValue = (account: Account) => getBalanceForMonth(account, selectedBalanceLookup)

  const formatSelectedValue = (value: number | undefined) => (value === undefined ? '—' : formatCurrency(value))

  const getGroupTotal = (groupedAccounts: Account[], balanceLookup: BalanceLookup) => {
    let total = 0
    let hasValue = false

    groupedAccounts.forEach(account => {
      const value = getBalanceForMonth(account, balanceLookup)

      if (value === undefined) return

      total += value
      hasValue = true
    })

    return hasValue ? total : undefined
  }

  const getChangeDisplay = (currentBalance: number | undefined, previousBalance: number | undefined) => {
    if (!previousMonth || previousBalance === undefined) return null

    const change = (currentBalance ?? 0) - previousBalance

    if (change === 0) {
      return {
        className: 'account-card__change account-card__change--flat',
        text: 'No change since last month',
      }
    }

    const percentChange =
      previousBalance !== 0 ? (change / previousBalance) * 100 : change > 0 ? Number.POSITIVE_INFINITY : 0
    const amountText = formatCurrency(Math.abs(change))
    const percentText = Number.isFinite(percentChange) ? ` (${Math.abs(percentChange).toFixed(1)}%)` : ''

    return {
      className: `account-card__change account-card__change--${change > 0 ? 'up' : 'down'}`,
      text: `${change > 0 ? '↑' : '↓'} ${amountText}${percentText}`,
    }
  }

  const renderChangeLine = (currentBalance: number | undefined, previousBalance: number | undefined) => {
    const changeDisplay = getChangeDisplay(currentBalance, previousBalance)

    return changeDisplay ? <span className={changeDisplay.className}>{changeDisplay.text}</span> : null
  }

  const renderAccountCard = (account: Account, key?: string) => (
    <article
      key={key ?? account.id}
      className={`account-card${account.status === 'inactive' ? ' account-card--inactive' : ''}`}
    >
      <div className="account-card__meta">
        <span className="account-card__name">{account.name}</span>
        {renderChangeLine(
          getBalanceForMonth(account, selectedBalanceLookup),
          getBalanceForMonth(account, previousBalanceLookup),
        )}
      </div>
      <span className="account-card__value">{formatSelectedValue(getSelectedValue(account))}</span>
    </article>
  )

  const renderDisplayItem = (item: OwnerDisplayItem) => {
    if (item.kind === 'account') {
      return renderAccountCard(item.account, `account-${item.account.id}`)
    }

    return (
      <article key={item.groupName} className="account-group-card">
        <div className="account-group-card__header">
          <div className="account-group-card__meta">
            <span className="account-group-card__name">{item.groupName}</span>
            {renderChangeLine(
              getGroupTotal(item.accounts, selectedBalanceLookup),
              getGroupTotal(item.accounts, previousBalanceLookup),
            )}
          </div>
          <span className="account-group-card__total">
            {formatSelectedValue(getGroupTotal(item.accounts, selectedBalanceLookup))}
          </span>
        </div>
        <div className="account-group-card__children">
          {item.accounts.map(account => renderAccountCard(account, `group-${item.groupName}-${account.id}`))}
        </div>
      </article>
    )
  }

  const renderOwnerBody = (owner: AccountOwner) => {
    const ownerAccounts = accountsByOwner[owner]

    if (ownerAccounts.length === 0) {
      return <p className="owner-column__empty">No accounts</p>
    }

    const sections = buildOwnerDisplayItems(ownerAccounts, selectedBalanceLookup)

    return (
      <>
        {sections.asset.length > 0 ? (
          <>
            <p className="data-details-owner-section-label">Assets</p>
            {sections.asset.map(renderDisplayItem)}
          </>
        ) : null}
        {sections.liability.length > 0 ? (
          <>
            <p className="data-details-owner-section-label">Liabilities</p>
            {sections.liability.map(renderDisplayItem)}
          </>
        ) : null}
      </>
    )
  }

  return (
    <div className="data-details">
      <div className="data-details-summary" aria-label="Net worth summary">
        <div>
          <p className="data-details-summary-label">Net worth</p>
          <p className="data-details-summary-value">{formatCurrency(netWorthTotal)}</p>
        </div>
        <MonthPicker
          allMonths={allMonths}
          selectedMonth={selectedMonth ?? ''}
          onMonthChange={month => {
            const nextMonthIndex = allMonths.indexOf(month)

            if (nextMonthIndex >= 0) {
              setSelectedMonthIndex(nextMonthIndex)
            }
          }}
        />
      </div>

      <div className="data-details-owner-grid">
        <section className="data-details-owner-card" aria-label={`${ownerLabels.primary} details`}>
          <div className="data-details-owner-header">
            <div className="data-details-owner-identity">
              <div className="data-owner-avatar data-owner-avatar-primary">
                {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : primaryInitial}
              </div>
              <div className="data-details-owner-labels">
                <span className="data-details-owner-name">{ownerLabels.primary}</span>
              </div>
            </div>
            <span className="data-details-owner-subtotal">{formatCurrency(ownerSubtotals.primary)}</span>
          </div>
          <div className="data-details-owner-body">{renderOwnerBody('primary')}</div>
        </section>

        <section className="data-details-owner-card" aria-label={`${ownerLabels.partner} details`}>
          <div className="data-details-owner-header">
            <div className="data-details-owner-identity">
              <div
                className={`data-owner-avatar ${hasPartner ? 'data-owner-avatar-partner' : 'data-details-avatar-neutral'}`}
              >
                {hasPartner ? (
                  profile.partner?.avatarDataUrl ? (
                    <img src={profile.partner.avatarDataUrl} alt="" />
                  ) : (
                    partnerInitial
                  )
                ) : (
                  partnerInitial
                )}
              </div>
              <div className="data-details-owner-labels">
                <span className={`data-details-owner-name${hasPartner ? '' : ' data-details-owner-name-muted'}`}>
                  {hasPartner ? ownerLabels.partner : 'No partner'}
                </span>
              </div>
            </div>
            <span className="data-details-owner-subtotal">{formatCurrency(ownerSubtotals.partner)}</span>
          </div>
          <div className="data-details-owner-body">{renderOwnerBody('partner')}</div>
        </section>

        <section className="data-details-owner-card" aria-label="Joint details">
          <div className="data-details-owner-header">
            <div className="data-details-owner-identity">
              <div className="data-owner-avatar-group" aria-hidden="true">
                <div className="data-owner-avatar data-owner-avatar-primary">
                  {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : primaryInitial}
                </div>
                <div
                  className={`data-owner-avatar ${hasPartner ? 'data-owner-avatar-partner' : 'data-details-avatar-neutral'}`}
                >
                  {hasPartner ? (
                    profile.partner?.avatarDataUrl ? (
                      <img src={profile.partner.avatarDataUrl} alt="" />
                    ) : (
                      partnerInitial
                    )
                  ) : (
                    partnerInitial
                  )}
                </div>
              </div>
              <div className="data-details-owner-labels">
                <span className="data-details-owner-name">{ownerLabels.joint}</span>
              </div>
            </div>
            <span className="data-details-owner-subtotal">{formatCurrency(ownerSubtotals.joint)}</span>
          </div>
          <div className="data-details-owner-body">{renderOwnerBody('joint')}</div>
        </section>
      </div>
    </div>
  )
}

export default BalanceDetails
