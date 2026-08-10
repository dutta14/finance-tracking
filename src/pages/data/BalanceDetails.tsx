import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  onToggleShowInactive?: () => void
  onSaveMonth?: (month: string, values: Record<string, number>) => void
}

type AccountSection = 'asset' | 'liability'

type BalanceLookup = {
  month: string | undefined
  balanceMap: Map<string, number>
}

type EditMode = {
  month: string
  values: Record<string, string>
  copyFrom: boolean
}

type AddMonthForm = {
  month: string
  copyFrom: boolean
  error: string
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

const LONG_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

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

const getNextMonth = (month: string | undefined) => {
  if (!month) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  const [yearPart, monthPart] = month.split('-')
  const year = Number(yearPart)
  const monthValue = Number(monthPart)

  if (!Number.isInteger(year) || !Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12) {
    return month
  }

  const nextMonthValue = monthValue === 12 ? 1 : monthValue + 1
  const nextYear = monthValue === 12 ? year + 1 : year

  return `${nextYear}-${String(nextMonthValue).padStart(2, '0')}`
}

const formatLongMonth = (month: string) => {
  const [yearPart, monthPart] = month.split('-')
  const monthIndex = Number(monthPart) - 1

  if (!yearPart || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex >= LONG_MONTH_NAMES.length) {
    return month
  }

  return `${LONG_MONTH_NAMES[monthIndex]} ${yearPart}`
}

const parseBalanceInput = (value: string) => {
  const normalized = value.replace(/[\s,$]/g, '')

  if (!normalized) return undefined

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

const BalanceDetails: FC<BalanceDetailsProps> = ({
  accounts,
  balances: _balances,
  allMonths,
  balanceMap,
  profile,
  showInactive,
  onToggleShowInactive,
  onSaveMonth,
}) => {
  const ownerLabels = useMemo(() => getOwnerLabels(profile), [profile])
  const [selectedMonth, setSelectedMonth] = useState(allMonths[0] ?? '')
  const [isAddMonthOpen, setIsAddMonthOpen] = useState(false)
  const [addMonthForm, setAddMonthForm] = useState<AddMonthForm>({
    month: getNextMonth(allMonths[0]),
    copyFrom: allMonths.length > 0,
    error: '',
  })
  const [editMode, setEditMode] = useState<EditMode | null>(null)
  const detailsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (allMonths.length === 0) {
      if (!editMode) {
        setSelectedMonth('')
      }
      return
    }

    if (!selectedMonth) {
      setSelectedMonth(allMonths[0])
      return
    }

    if (!editMode && !allMonths.includes(selectedMonth)) {
      setSelectedMonth(allMonths[0])
    }
  }, [allMonths, editMode, selectedMonth])

  useEffect(() => {
    setAddMonthForm(current => ({
      month: isAddMonthOpen ? current.month : getNextMonth(allMonths[0]),
      copyFrom: isAddMonthOpen ? current.copyFrom : allMonths.length > 0,
      error: '',
    }))
  }, [allMonths, isAddMonthOpen])

  useEffect(() => {
    if (!editMode) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setEditMode(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editMode])

  useEffect(() => {
    if (!isAddMonthOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsAddMonthOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isAddMonthOpen])

  useEffect(() => {
    if (!editMode) return

    const frameId = window.requestAnimationFrame(() => {
      detailsRef.current?.querySelector<HTMLInputElement>('.account-card__value-input')?.focus()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [editMode])

  const selectedMonthIndex = selectedMonth ? allMonths.indexOf(selectedMonth) : -1
  const previousMonth = selectedMonthIndex >= 0 ? allMonths[selectedMonthIndex + 1] : undefined
  const latestMonth = allMonths[0]

  const activeAccounts = useMemo(() => accounts.filter(account => account.status === 'active'), [accounts])

  const allAccountsByOwner = useMemo<Record<AccountOwner, Account[]>>(
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

  const selectedBalanceLookup = useMemo(
    () => ({ month: selectedMonth || undefined, balanceMap }),
    [selectedMonth, balanceMap],
  )
  const previousBalanceLookup = useMemo(() => ({ month: previousMonth, balanceMap }), [previousMonth, balanceMap])
  const editBalanceLookup = useMemo(() => ({ month: editMode?.month, balanceMap }), [editMode?.month, balanceMap])

  const getEditedBalance = useCallback(
    (account: Account) => {
      if (!editMode || account.status !== 'active') return undefined
      return parseBalanceInput(editMode.values[String(account.id)] ?? '')
    },
    [editMode],
  )

  const getSelectedValue = (account: Account) => getBalanceForMonth(account, selectedBalanceLookup)

  const getDisplayBalance = (account: Account) => {
    if (!editMode) return getSelectedValue(account)
    if (account.status === 'active') return getEditedBalance(account)
    return getBalanceForMonth(account, editBalanceLookup)
  }

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

  const getEditingGroupTotal = (groupedAccounts: Account[]) => {
    let total = 0
    let hasValue = false

    groupedAccounts.forEach(account => {
      if (account.status === 'active') {
        total += getEditedBalance(account) ?? 0
        hasValue = true
        return
      }

      const value = getBalanceForMonth(account, editBalanceLookup)

      if (value === undefined) return

      total += value
      hasValue = true
    })

    return hasValue ? total : undefined
  }

  const netWorthTotal = useMemo(() => {
    if (editMode) {
      return activeAccounts.reduce((sum, account) => sum + (getEditedBalance(account) ?? 0), 0)
    }

    if (!selectedMonth) return 0

    return accounts.reduce((sum, account) => {
      if (account.status !== 'active') return sum
      return sum + (balanceMap.get(`${account.id}:${selectedMonth}`) ?? 0)
    }, 0)
  }, [accounts, activeAccounts, balanceMap, editMode, getEditedBalance, selectedMonth])

  const ownerSubtotals = useMemo<Record<AccountOwner, number>>(
    () =>
      accounts.reduce(
        (totals, account) => {
          if (account.status !== 'active') return totals

          const value = editMode
            ? (getEditedBalance(account) ?? 0)
            : (balanceMap.get(`${account.id}:${selectedMonth}`) ?? 0)
          totals[account.owner] += value
          return totals
        },
        {
          primary: 0,
          partner: 0,
          joint: 0,
        } as Record<AccountOwner, number>,
      ),
    [accounts, balanceMap, editMode, getEditedBalance, selectedMonth],
  )

  const selectedSortLookup = editMode && latestMonth ? { month: latestMonth, balanceMap } : selectedBalanceLookup

  const getChangeDisplay = (currentBalance: number | undefined, previousBalance: number | undefined) => {
    if (editMode || !previousMonth || previousBalance === undefined) return null

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

  const handleOpenAddMonth = () => {
    setAddMonthForm({
      month: getNextMonth(allMonths[0]),
      copyFrom: allMonths.length > 0,
      error: '',
    })
    setIsAddMonthOpen(true)
  }

  const handleStartEditMode = () => {
    const month = addMonthForm.month

    if (!month) {
      setAddMonthForm(current => ({ ...current, error: 'Choose a month to continue.' }))
      return
    }

    if (allMonths.includes(month)) {
      setAddMonthForm(current => ({ ...current, error: 'That month already exists.' }))
      return
    }

    const values: Record<string, string> = {}

    activeAccounts.forEach(account => {
      const previousValue =
        addMonthForm.copyFrom && latestMonth ? balanceMap.get(`${account.id}:${latestMonth}`) : undefined
      values[String(account.id)] = previousValue !== undefined ? String(previousValue) : ''
    })

    setEditMode({ month, values, copyFrom: addMonthForm.copyFrom })
    setIsAddMonthOpen(false)
  }

  const handleSaveEditMode = () => {
    if (!editMode) return

    const nextValues = Object.entries(editMode.values).reduce<Record<string, number>>((entries, [accountId, value]) => {
      if (!value.trim()) return entries

      const parsed = parseBalanceInput(value)

      if (parsed === undefined) return entries

      entries[accountId] = parsed
      return entries
    }, {})

    onSaveMonth?.(editMode.month, nextValues)
    setSelectedMonth(editMode.month)
    setEditMode(null)
  }

  const hasSavableValues = editMode
    ? Object.values(editMode.values).some(value => value.trim() && parseBalanceInput(value) !== undefined)
    : false

  const renderAccountCard = (account: Account, key?: string) => {
    const isEditing = !!editMode
    const isEditableAccount = !!editMode && account.status === 'active'
    const accountKey = String(account.id)

    return (
      <article
        key={key ?? account.id}
        className={`account-card${account.status === 'inactive' ? ' account-card--inactive' : ''}${isEditing ? ' account-card--editing' : ''}`}
      >
        <div className="account-card__meta">
          <span className="account-card__name">{account.name}</span>
          {renderChangeLine(getDisplayBalance(account), getBalanceForMonth(account, previousBalanceLookup))}
        </div>
        {isEditableAccount ? (
          <input
            className="account-card__value-input"
            type="text"
            inputMode="decimal"
            aria-label={`${account.name} balance`}
            value={editMode.values[accountKey] ?? ''}
            onChange={event =>
              setEditMode(current =>
                current
                  ? {
                      ...current,
                      values: {
                        ...current.values,
                        [accountKey]: event.target.value,
                      },
                    }
                  : current,
              )
            }
          />
        ) : (
          <span className="account-card__value">{formatSelectedValue(getDisplayBalance(account))}</span>
        )}
      </article>
    )
  }

  const renderDisplayItem = (item: OwnerDisplayItem) => {
    if (item.kind === 'account') {
      if (!showInactive && item.account.status === 'inactive') return null
      return renderAccountCard(item.account, `account-${item.account.id}`)
    }

    const currentGroupTotal = editMode
      ? getEditingGroupTotal(item.accounts)
      : getGroupTotal(item.accounts, selectedBalanceLookup)

    const visibleChildren = showInactive ? item.accounts : item.accounts.filter(a => a.status !== 'inactive')

    if (visibleChildren.length === 0) return null

    return (
      <article key={item.groupName} className="account-group-card">
        <div className="account-group-card__header">
          <div className="account-group-card__meta">
            <span className="account-group-card__name">{item.groupName}</span>
            {renderChangeLine(currentGroupTotal, getGroupTotal(item.accounts, previousBalanceLookup))}
          </div>
          <span className="account-group-card__total">{formatSelectedValue(currentGroupTotal)}</span>
        </div>
        <div className="account-group-card__children">
          {visibleChildren.map(account => renderAccountCard(account, `group-${item.groupName}-${account.id}`))}
        </div>
      </article>
    )
  }

  const renderOwnerBody = (owner: AccountOwner) => {
    const ownerAccounts = allAccountsByOwner[owner]

    if (ownerAccounts.length === 0) {
      return <p className="owner-column__empty">No accounts</p>
    }

    const sections = buildOwnerDisplayItems(ownerAccounts, selectedSortLookup)

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
    <div ref={detailsRef} className="data-details">
      <div
        className={`data-details-summary${editMode ? ' data-details-summary--editing' : ''}`}
        aria-label="Net worth summary"
      >
        <div className="data-details-summary-title">
          <p className="data-details-summary-label">Net worth</p>
          <p className="data-details-summary-value">{formatCurrency(netWorthTotal)}</p>
        </div>
        {editMode ? (
          <div className="data-details-entry-banner" aria-live="polite">
            Entering balances for {formatLongMonth(editMode.month)}
          </div>
        ) : (
          <div className="data-details-summary-controls">
            {onToggleShowInactive && (
              <button className="data-filter-toggle" aria-pressed={showInactive} onClick={onToggleShowInactive}>
                {showInactive ? 'Hide inactive' : 'Show inactive'}
              </button>
            )}
            <MonthPicker
              allMonths={allMonths}
              selectedMonth={selectedMonth}
              onMonthChange={month => {
                setSelectedMonth(month)
              }}
            />
            <div className="data-add-month-wrap">
              <button className="data-add-entry-btn" type="button" onClick={handleOpenAddMonth}>
                + Add Entry
              </button>
              {isAddMonthOpen ? (
                <div className="data-add-month-popover" role="dialog" aria-label="Add month">
                  <label className="data-add-month-field">
                    <span>Month</span>
                    <input
                      type="month"
                      value={addMonthForm.month}
                      onChange={event =>
                        setAddMonthForm(current => ({
                          ...current,
                          month: event.target.value,
                          error: '',
                        }))
                      }
                    />
                  </label>
                  <fieldset className="data-add-month-options">
                    <legend>Starting point</legend>
                    <label>
                      <input
                        type="radio"
                        name="add-month-mode"
                        checked={!addMonthForm.copyFrom}
                        onChange={() => setAddMonthForm(current => ({ ...current, copyFrom: false }))}
                      />
                      <span>Start blank</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="add-month-mode"
                        checked={addMonthForm.copyFrom}
                        onChange={() => setAddMonthForm(current => ({ ...current, copyFrom: true }))}
                        disabled={!latestMonth}
                      />
                      <span>Copy from last month</span>
                    </label>
                  </fieldset>
                  {addMonthForm.error ? <p className="data-add-month-error">{addMonthForm.error}</p> : null}
                  <div className="data-add-month-actions">
                    <button type="button" className="data-add-month-continue" onClick={handleStartEditMode}>
                      Continue
                    </button>
                    <button type="button" className="data-add-month-cancel" onClick={() => setIsAddMonthOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
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

      {editMode ? (
        <div className="data-details-entry-footer">
          <button
            type="button"
            className="data-details-entry-footer-save"
            onClick={handleSaveEditMode}
            disabled={!hasSavableValues}
          >
            Save
          </button>
          <button type="button" className="data-details-entry-footer-cancel" onClick={() => setEditMode(null)}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default BalanceDetails
