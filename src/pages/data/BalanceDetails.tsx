import { FC, useMemo } from 'react'
import { Profile } from '../../hooks/useProfile'
import { Account, AccountOwner, ACCOUNT_TYPE_LABELS, BalanceEntry, formatCurrency, getOwnerLabels } from './types'

interface BalanceDetailsProps {
  accounts: Account[]
  balances: BalanceEntry[]
  allMonths: string[]
  balanceMap: Map<string, number>
  profile: Profile
}

type AccountSection = 'asset' | 'liability'

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

const sortAccountsByStatus = (accounts: Account[]) => [...accounts].sort((a, b) => getStatusRank(a) - getStatusRank(b))

const buildOwnerDisplayItems = (ownerAccounts: Account[]) => {
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

    const sortedAccounts = sortAccountsByStatus(groupedAccounts)
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
      .sort((a, b) => a.statusRank - b.statusRank || a.order - b.order),
    liability: displayItems
      .filter(item => item.section === 'liability')
      .sort((a, b) => a.statusRank - b.statusRank || a.order - b.order),
  } satisfies Record<AccountSection, OwnerDisplayItem[]>
}

const BalanceDetails: FC<BalanceDetailsProps> = ({ accounts, balances: _balances, allMonths, balanceMap, profile }) => {
  const ownerLabels = useMemo(() => getOwnerLabels(profile), [profile])

  const latestMonth = allMonths[0]
  const netWorthTotal = useMemo(() => {
    if (!latestMonth) return 0

    return accounts.reduce((sum, account) => {
      if (account.status !== 'active') return sum
      return sum + (balanceMap.get(`${account.id}:${latestMonth}`) ?? 0)
    }, 0)
  }, [accounts, balanceMap, latestMonth])

  const accountsByOwner = useMemo<Record<AccountOwner, Account[]>>(
    () =>
      accounts.reduce(
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
    [accounts],
  )

  const primaryInitial = (profile.name || ownerLabels.primary || 'P')[0].toUpperCase()
  const partnerInitial = (profile.partner?.name || ownerLabels.partner || 'P')[0].toUpperCase()
  const hasPartner = !!profile.partner

  const getLatestValue = (account: Account) => {
    if (!latestMonth) return undefined
    return balanceMap.get(`${account.id}:${latestMonth}`)
  }

  const formatLatestValue = (value: number | undefined) => (value === undefined ? '—' : formatCurrency(value))

  const getGroupTotal = (groupedAccounts: Account[]) => {
    let total = 0
    let hasValue = false

    groupedAccounts.forEach(account => {
      const value = getLatestValue(account)

      if (value === undefined) return

      total += value
      hasValue = true
    })

    return hasValue ? total : undefined
  }

  const renderAccountCard = (account: Account, key?: string) => (
    <article
      key={key ?? account.id}
      className={`account-card${account.status === 'inactive' ? ' account-card--inactive' : ''}`}
    >
      <div className="account-card__meta">
        <span className="account-card__name">{account.name}</span>
        <span className="account-card__type">{ACCOUNT_TYPE_LABELS[account.type]}</span>
      </div>
      <span className="account-card__value">{formatLatestValue(getLatestValue(account))}</span>
    </article>
  )

  const renderDisplayItem = (item: OwnerDisplayItem) => {
    if (item.kind === 'account') {
      return renderAccountCard(item.account, `account-${item.account.id}`)
    }

    return (
      <article key={item.groupName} className="account-group-card">
        <div className="account-group-card__header">
          <span className="account-group-card__name">{item.groupName}</span>
          <span className="account-group-card__total">{formatLatestValue(getGroupTotal(item.accounts))}</span>
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

    const sections = buildOwnerDisplayItems(ownerAccounts)

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
        <p className="data-details-summary-label">Net worth</p>
        <p className="data-details-summary-value">{formatCurrency(netWorthTotal)}</p>
      </div>

      <div className="data-details-owner-grid">
        <section className="data-details-owner-card" aria-label={`${ownerLabels.primary} details`}>
          <div className="data-details-owner-header">
            <div className="data-owner-avatar data-owner-avatar-primary">
              {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : primaryInitial}
            </div>
            <span className="data-details-owner-name">{ownerLabels.primary}</span>
          </div>
          <div className="data-details-owner-body">{renderOwnerBody('primary')}</div>
        </section>

        <section className="data-details-owner-card" aria-label={`${ownerLabels.partner} details`}>
          <div className="data-details-owner-header">
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
            <span className={`data-details-owner-name${hasPartner ? '' : ' data-details-owner-name-muted'}`}>
              {hasPartner ? ownerLabels.partner : 'No partner'}
            </span>
          </div>
          <div className="data-details-owner-body">{renderOwnerBody('partner')}</div>
        </section>

        <section className="data-details-owner-card" aria-label="Joint details">
          <div className="data-details-owner-header">
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
            <span className="data-details-owner-name">{ownerLabels.joint}</span>
          </div>
          <div className="data-details-owner-body">{renderOwnerBody('joint')}</div>
        </section>
      </div>
    </div>
  )
}

export default BalanceDetails
