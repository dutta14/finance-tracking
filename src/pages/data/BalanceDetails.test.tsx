import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BalanceDetails from './BalanceDetails'
import { makeAccount, makeBalanceEntry } from '../../test/factories'

describe('BalanceDetails', () => {
  it('renders the placeholder content for the Details view', () => {
    render(
      <BalanceDetails
        accounts={[makeAccount({ id: 1, name: 'Checking' })]}
        balances={[makeBalanceEntry({ id: 1, accountId: 1, month: '2024-01', balance: 1000 })]}
        allMonths={['2024-01']}
        balanceMap={new Map([['1:2024-01', 1000]])}
      />,
    )

    expect(screen.getByText('Details')).toBeVisible()
  })
})
