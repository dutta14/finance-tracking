import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import BalanceDetails from './BalanceDetails'
import { makeAccount, makeBalanceEntry } from '../../test/factories'
import type { Profile } from '../../hooks/useProfile'
import type { Account } from './types'

const baseProfile: Profile = {
  name: 'Alex',
  avatarDataUrl: '',
  birthday: '',
  partner: {
    name: 'Sam',
    avatarDataUrl: '',
    birthday: '',
  },
}

describe('BalanceDetails', () => {
  it('renders the latest net worth total and owner cards', () => {
    render(
      <BalanceDetails
        accounts={[
          makeAccount({ id: 1, owner: 'primary', goalType: 'fi' }),
          makeAccount({ id: 2, owner: 'partner', goalType: 'gw' }),
          makeAccount({ id: 3, owner: 'joint', goalType: 'fi', status: 'inactive' }),
        ]}
        balances={[
          makeBalanceEntry({ id: 1, accountId: 1, month: '2024-01', balance: 90000 }),
          makeBalanceEntry({ id: 2, accountId: 2, month: '2024-01', balance: 45000 }),
          makeBalanceEntry({ id: 3, accountId: 3, month: '2024-01', balance: 25000 }),
          makeBalanceEntry({ id: 4, accountId: 1, month: '2024-02', balance: 100000 }),
          makeBalanceEntry({ id: 5, accountId: 2, month: '2024-02', balance: 50000 }),
          makeBalanceEntry({ id: 6, accountId: 3, month: '2024-02', balance: 30000 }),
        ]}
        allMonths={['2024-02', '2024-01']}
        balanceMap={
          new Map([
            ['1:2024-01', 90000],
            ['2:2024-01', 45000],
            ['3:2024-01', 25000],
            ['1:2024-02', 100000],
            ['2:2024-02', 50000],
            ['3:2024-02', 30000],
          ])
        }
        profile={baseProfile}
        showInactive={false}
      />,
    )

    expect(screen.getByText('Net worth')).toBeVisible()
    expect(screen.getByText('$150,000')).toBeVisible()
    expect(screen.getByLabelText('Alex details')).toBeVisible()
    expect(screen.getByLabelText('Sam details')).toBeVisible()
    expect(screen.getByLabelText('Joint details')).toBeVisible()
    expect(screen.getAllByText('A')).toHaveLength(2)
    expect(screen.getAllByText('S')).toHaveLength(2)
  })

  it('shows a no partner fallback when the profile has no partner', () => {
    render(
      <BalanceDetails
        accounts={[makeAccount({ id: 1, owner: 'primary' })]}
        balances={[makeBalanceEntry({ id: 1, accountId: 1, month: '2024-01', balance: 1000 })]}
        allMonths={['2024-01']}
        balanceMap={new Map([['1:2024-01', 1000]])}
        profile={{
          ...baseProfile,
          partner: null,
        }}
        showInactive={false}
      />,
    )

    expect(screen.getByText('No partner')).toBeVisible()
    expect(screen.getByLabelText('Partner details')).toBeVisible()
  })

  it('renders owner subtotals in headers using only active accounts from the latest month', () => {
    render(
      <BalanceDetails
        accounts={[
          makeAccount({ id: 1, name: 'Checking', owner: 'primary', status: 'active' }),
          makeAccount({ id: 2, name: 'Old Savings', owner: 'primary', status: 'inactive' }),
          makeAccount({ id: 3, name: 'Brokerage', owner: 'partner', status: 'active' }),
          makeAccount({ id: 4, name: 'Joint Cash', owner: 'joint', status: 'active' }),
        ]}
        balances={[
          makeBalanceEntry({ id: 1, accountId: 1, month: '2024-02', balance: 12345 }),
          makeBalanceEntry({ id: 2, accountId: 2, month: '2024-02', balance: 999999 }),
          makeBalanceEntry({ id: 3, accountId: 3, month: '2024-02', balance: 67890 }),
          makeBalanceEntry({ id: 4, accountId: 4, month: '2024-02', balance: 22222 }),
        ]}
        allMonths={['2024-02']}
        balanceMap={
          new Map([
            ['1:2024-02', 12345],
            ['2:2024-02', 999999],
            ['3:2024-02', 67890],
            ['4:2024-02', 22222],
          ])
        }
        profile={baseProfile}
        showInactive={true}
      />,
    )

    expect(
      within(screen.getByLabelText('Alex details')).getByText('$12,345', { selector: '.data-details-owner-subtotal' }),
    ).toBeVisible()
    expect(
      within(screen.getByLabelText('Sam details')).getByText('$67,890', { selector: '.data-details-owner-subtotal' }),
    ).toBeVisible()
    expect(
      within(screen.getByLabelText('Joint details')).getByText('$22,222', {
        selector: '.data-details-owner-subtotal',
      }),
    ).toBeVisible()
    expect(screen.getByText('$999,999')).toBeVisible()
  })

  it('renders grouped accounts, inactive states, and empty owner placeholders', () => {
    render(
      <BalanceDetails
        accounts={[
          makeAccount({ id: 1, name: 'Chase Checking', owner: 'primary', type: 'liquid', group: undefined }),
          makeAccount({ id: 2, name: '401k', owner: 'primary', type: 'retirement', group: 'Retirement' }),
          makeAccount({
            id: 3,
            name: 'Roth IRA',
            owner: 'primary',
            type: 'retirement',
            group: 'Retirement',
            status: 'inactive',
          }),
          makeAccount({ id: 4, name: 'Joint Brokerage', owner: 'joint', type: 'non-retirement' }),
        ]}
        balances={[
          makeBalanceEntry({ id: 1, accountId: 1, month: '2024-02', balance: 4220 }),
          makeBalanceEntry({ id: 2, accountId: 2, month: '2024-02', balance: 100000 }),
          makeBalanceEntry({ id: 3, accountId: 3, month: '2024-02', balance: 23456 }),
        ]}
        allMonths={['2024-02']}
        balanceMap={
          new Map([
            ['1:2024-02', 4220],
            ['2:2024-02', 100000],
            ['3:2024-02', 23456],
          ])
        }
        profile={baseProfile}
        showInactive={true}
      />,
    )

    const primaryColumn = screen.getByLabelText('Alex details')
    const partnerColumn = screen.getByLabelText('Sam details')
    const jointColumn = screen.getByLabelText('Joint details')
    const retirementGroup = within(primaryColumn).getByText('$123,456').closest('article')

    expect(retirementGroup).not.toBeNull()
    expect(
      within(retirementGroup as HTMLElement).getByText('Retirement', { selector: '.account-group-card__name' }),
    ).toBeVisible()
    expect(within(primaryColumn).getByText('Assets')).toBeVisible()
    expect(within(primaryColumn).queryByText('Liabilities')).not.toBeInTheDocument()
    expect(within(primaryColumn).getByText('$123,456')).toBeVisible()
    expect(within(primaryColumn).getByText('Chase Checking')).toBeVisible()
    expect(within(primaryColumn).getByText('Liquid')).toBeVisible()
    expect(within(primaryColumn).getByText('$4,220')).toBeVisible()

    const inactiveCard = within(primaryColumn).getByText('Roth IRA').closest('article')
    expect(inactiveCard).toHaveClass('account-card--inactive')

    expect(within(partnerColumn).getByText('No accounts')).toBeVisible()
    expect(within(jointColumn).getByText('Joint Brokerage')).toBeVisible()
    expect(within(jointColumn).getByText('Non-Retirement')).toBeVisible()
    expect(within(jointColumn).getByText('Assets')).toBeVisible()
    expect(within(jointColumn).queryByText('Liabilities')).not.toBeInTheDocument()
    expect(within(jointColumn).getByText('—')).toBeVisible()
  })

  it('sorts owner sections and grouped accounts by nature and active status', () => {
    render(
      <BalanceDetails
        accounts={[
          makeAccount({ id: 1, name: 'Inactive Asset', owner: 'primary', status: 'inactive' }),
          makeAccount({ id: 2, name: 'Credit Card', owner: 'primary', nature: 'liability' }),
          makeAccount({
            id: 3,
            name: 'Old Mortgage',
            owner: 'primary',
            nature: 'liability',
            type: 'illiquid',
            allocation: 'debt',
            status: 'inactive',
          }),
          makeAccount({ id: 4, name: 'Brokerage', owner: 'primary', group: 'Investments', type: 'non-retirement' }),
          makeAccount({
            id: 5,
            name: 'Old 401k',
            owner: 'primary',
            group: 'Investments',
            type: 'retirement',
            status: 'inactive',
          }),
          makeAccount({
            id: 6,
            name: 'Mixed Loan',
            owner: 'joint',
            group: 'Mixed Group',
            nature: 'liability',
            allocation: 'debt',
          }),
          makeAccount({ id: 7, name: 'Mixed Cash', owner: 'joint', group: 'Mixed Group', nature: 'asset' }),
        ]}
        balances={[
          makeBalanceEntry({ id: 1, accountId: 1, month: '2024-02', balance: 1000 }),
          makeBalanceEntry({ id: 2, accountId: 2, month: '2024-02', balance: -5000 }),
          makeBalanceEntry({ id: 3, accountId: 3, month: '2024-02', balance: -120000 }),
          makeBalanceEntry({ id: 4, accountId: 4, month: '2024-02', balance: 70000 }),
          makeBalanceEntry({ id: 5, accountId: 5, month: '2024-02', balance: 30000 }),
          makeBalanceEntry({ id: 6, accountId: 6, month: '2024-02', balance: -2000 }),
          makeBalanceEntry({ id: 7, accountId: 7, month: '2024-02', balance: 4000 }),
        ]}
        allMonths={['2024-02']}
        balanceMap={
          new Map([
            ['1:2024-02', 1000],
            ['2:2024-02', -5000],
            ['3:2024-02', -120000],
            ['4:2024-02', 70000],
            ['5:2024-02', 30000],
            ['6:2024-02', -2000],
            ['7:2024-02', 4000],
          ])
        }
        profile={baseProfile}
        showInactive={true}
      />,
    )

    const primaryColumn = screen.getByLabelText('Alex details')
    const assetsHeader = within(primaryColumn).getByText('Assets')
    const liabilitiesHeader = within(primaryColumn).getByText('Liabilities')
    const investmentsGroup = within(primaryColumn).getByText('Investments').closest('article')
    const inactiveAsset = within(primaryColumn).getByText('Inactive Asset')
    const creditCard = within(primaryColumn).getByText('Credit Card')
    const oldMortgage = within(primaryColumn).getByText('Old Mortgage')

    expect(assetsHeader.compareDocumentPosition(liabilitiesHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(investmentsGroup).not.toBeNull()
    expect(
      assetsHeader.compareDocumentPosition(investmentsGroup as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      (investmentsGroup as HTMLElement).compareDocumentPosition(inactiveAsset) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(inactiveAsset.compareDocumentPosition(liabilitiesHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(liabilitiesHeader.compareDocumentPosition(creditCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(creditCard.compareDocumentPosition(oldMortgage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(primaryColumn).getByText('$100,000')).toBeVisible()
    expect(
      within(investmentsGroup as HTMLElement)
        .getByText('Brokerage')
        .compareDocumentPosition(within(investmentsGroup as HTMLElement).getByText('Old 401k')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const jointColumn = screen.getByLabelText('Joint details')
    expect(within(jointColumn).queryByText('Assets')).not.toBeInTheDocument()
    expect(within(jointColumn).getByText('Liabilities')).toBeVisible()
    expect(within(jointColumn).getByText('Mixed Group')).toBeVisible()
  })

  it('sorts cards by latest value within each section and sorts group children by value descending', () => {
    render(
      <BalanceDetails
        accounts={[
          makeAccount({ id: 1, name: 'Cash Reserve', owner: 'primary' }),
          makeAccount({ id: 2, name: 'Brokerage', owner: 'primary', group: 'Investments', type: 'non-retirement' }),
          makeAccount({ id: 3, name: '401k', owner: 'primary', group: 'Investments', type: 'retirement' }),
          makeAccount({ id: 4, name: 'HSA', owner: 'primary', type: 'retirement' }),
          makeAccount({ id: 5, name: 'Old Savings', owner: 'primary', status: 'inactive' }),
          makeAccount({ id: 6, name: 'Credit Card', owner: 'primary', nature: 'liability' }),
          makeAccount({
            id: 7,
            name: 'Car Loan',
            owner: 'primary',
            nature: 'liability',
            allocation: 'debt',
            group: 'Loans',
            type: 'illiquid',
          }),
          makeAccount({
            id: 8,
            name: 'Student Loan',
            owner: 'primary',
            nature: 'liability',
            allocation: 'debt',
            group: 'Loans',
            type: 'illiquid',
          }),
        ]}
        balances={[
          makeBalanceEntry({ id: 1, accountId: 1, month: '2024-02', balance: 200000 }),
          makeBalanceEntry({ id: 2, accountId: 2, month: '2024-02', balance: 300000 }),
          makeBalanceEntry({ id: 3, accountId: 3, month: '2024-02', balance: 200000 }),
          makeBalanceEntry({ id: 4, accountId: 4, month: '2024-02', balance: 100000 }),
          makeBalanceEntry({ id: 5, accountId: 5, month: '2024-02', balance: 900000 }),
          makeBalanceEntry({ id: 6, accountId: 6, month: '2024-02', balance: -1000 }),
          makeBalanceEntry({ id: 7, accountId: 7, month: '2024-02', balance: -3000 }),
          makeBalanceEntry({ id: 8, accountId: 8, month: '2024-02', balance: -2000 }),
        ]}
        allMonths={['2024-02']}
        balanceMap={
          new Map([
            ['1:2024-02', 200000],
            ['2:2024-02', 300000],
            ['3:2024-02', 200000],
            ['4:2024-02', 100000],
            ['5:2024-02', 900000],
            ['6:2024-02', -1000],
            ['7:2024-02', -3000],
            ['8:2024-02', -2000],
          ])
        }
        profile={baseProfile}
        showInactive={true}
      />,
    )

    const primaryColumn = screen.getByLabelText('Alex details')
    const assetsHeader = within(primaryColumn).getByText('Assets')
    const investmentsGroup = within(primaryColumn).getByText('Investments').closest('article')
    const cashReserve = within(primaryColumn).getByText('Cash Reserve')
    const hsa = within(primaryColumn).getByText('HSA')
    const oldSavings = within(primaryColumn).getByText('Old Savings')
    const liabilitiesHeader = within(primaryColumn).getByText('Liabilities')
    const creditCard = within(primaryColumn).getByText('Credit Card')
    const loansGroup = within(primaryColumn).getByText('Loans').closest('article')

    expect(investmentsGroup).not.toBeNull()
    expect(
      assetsHeader.compareDocumentPosition(investmentsGroup as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      (investmentsGroup as HTMLElement).compareDocumentPosition(cashReserve) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(cashReserve.compareDocumentPosition(hsa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(hsa.compareDocumentPosition(oldSavings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(oldSavings.compareDocumentPosition(liabilitiesHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(loansGroup).not.toBeNull()
    expect(liabilitiesHeader.compareDocumentPosition(creditCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      creditCard.compareDocumentPosition(loansGroup as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    expect(
      within(investmentsGroup as HTMLElement)
        .getByText('Brokerage')
        .compareDocumentPosition(within(investmentsGroup as HTMLElement).getByText('401k')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      within(loansGroup as HTMLElement)
        .getByText('Student Loan')
        .compareDocumentPosition(within(loansGroup as HTMLElement).getByText('Car Loan')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(within(investmentsGroup as HTMLElement).getByText('$500,000')).toBeVisible()
    expect(within(loansGroup as HTMLElement).getByText('-$5,000')).toBeVisible()
  })

  it('treats accounts without a nature as assets so all accounts still render', () => {
    const accounts = [
      { ...makeAccount({ id: 1, name: 'Fallback Checking', owner: 'primary' }), nature: undefined },
      {
        ...makeAccount({ id: 2, name: 'Fallback Brokerage', owner: 'primary', group: 'Fallback Group' }),
        nature: null,
      },
      {
        ...makeAccount({ id: 3, name: 'Grouped Savings', owner: 'primary', group: 'Fallback Group' }),
        nature: 'asset',
      },
      { ...makeAccount({ id: 4, name: 'Credit Card', owner: 'primary', nature: 'liability' }) },
    ] as unknown as Account[]

    render(
      <BalanceDetails
        accounts={accounts}
        balances={[
          makeBalanceEntry({ id: 1, accountId: 1, month: '2024-02', balance: 1000 }),
          makeBalanceEntry({ id: 2, accountId: 2, month: '2024-02', balance: 2000 }),
          makeBalanceEntry({ id: 3, accountId: 3, month: '2024-02', balance: 3000 }),
          makeBalanceEntry({ id: 4, accountId: 4, month: '2024-02', balance: -500 }),
        ]}
        allMonths={['2024-02']}
        balanceMap={
          new Map([
            ['1:2024-02', 1000],
            ['2:2024-02', 2000],
            ['3:2024-02', 3000],
            ['4:2024-02', -500],
          ])
        }
        profile={baseProfile}
        showInactive={false}
      />,
    )

    const primaryColumn = screen.getByLabelText('Alex details')

    expect(within(primaryColumn).getByText('Assets')).toBeVisible()
    expect(within(primaryColumn).getByText('Liabilities')).toBeVisible()
    expect(within(primaryColumn).getByText('Fallback Checking')).toBeVisible()
    expect(within(primaryColumn).getByText('Fallback Group')).toBeVisible()
    expect(within(primaryColumn).getByText('Grouped Savings')).toBeVisible()
    expect(within(primaryColumn).getByText('Credit Card')).toBeVisible()
  })

  it('hides inactive accounts by default and shows them when toggled on', () => {
    const props = {
      accounts: [
        makeAccount({ id: 1, name: 'Checking', owner: 'primary', status: 'active' }),
        makeAccount({ id: 2, name: 'Old 401k', owner: 'primary', status: 'inactive' }),
      ],
      balances: [
        makeBalanceEntry({ id: 1, accountId: 1, month: '2024-02', balance: 1000 }),
        makeBalanceEntry({ id: 2, accountId: 2, month: '2024-02', balance: 2000 }),
      ],
      allMonths: ['2024-02'],
      balanceMap: new Map([
        ['1:2024-02', 1000],
        ['2:2024-02', 2000],
      ]),
      profile: baseProfile,
    }

    const { rerender } = render(<BalanceDetails {...props} showInactive={false} />)

    expect(screen.getByText('Checking')).toBeVisible()
    expect(screen.queryByText('Old 401k')).not.toBeInTheDocument()

    rerender(<BalanceDetails {...props} showInactive />)

    const inactiveCard = screen.getByText('Old 401k').closest('article')
    expect(screen.getByText('Old 401k')).toBeVisible()
    expect(inactiveCard).toHaveClass('account-card--inactive')
  })
})
