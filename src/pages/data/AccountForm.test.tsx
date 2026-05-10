import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountForm from './AccountForm'
import { makeAccount, makeProfile } from '../../test/factories'
import type { Account } from './types'

const profile = makeProfile()
const profileWithPartner = makeProfile({
  partner: { name: 'Jane', avatarDataUrl: '', birthday: '1991-05-20' },
})

function makeProps(overrides: Partial<React.ComponentProps<typeof AccountForm>> = {}) {
  return {
    profile,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
}

describe('AccountForm', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // --- Create vs Edit ---

  it('renders empty fields for a new account', () => {
    render(<AccountForm {...makeProps()} />)
    const nameInput = screen.getByPlaceholderText('e.g. Chase Checking')
    expect(nameInput).toHaveValue('')
    expect(screen.getByPlaceholderText('e.g. Chase')).toHaveValue('')
  })

  it('pre-fills fields when editing an existing account', () => {
    const existing = makeAccount({
      id: 5,
      name: 'Fidelity 401k',
      institution: 'Fidelity',
      goalType: 'fi',
      type: 'retirement',
      owner: 'primary',
      nature: 'asset',
      allocation: 'us-stock',
      group: 'Retirement',
    })

    render(<AccountForm {...makeProps({ initial: existing })} />)
    expect(screen.getByPlaceholderText('e.g. Chase Checking')).toHaveValue('Fidelity 401k')
    expect(screen.getByPlaceholderText('e.g. Chase')).toHaveValue('Fidelity')
  })

  // --- Goal type cascading ---

  it('shows FI account types when FI goal is selected', () => {
    render(<AccountForm {...makeProps()} />)
    // Default goalType is 'fi'
    expect(screen.getByText('Retirement')).toBeInTheDocument()
    expect(screen.getByText('Non-Retirement')).toBeInTheDocument()
  })

  it('switches to GW account types when GW goal is selected', async () => {
    const user = userEvent.setup()
    render(<AccountForm {...makeProps()} />)

    // Labels aren't htmlFor-associated; find the select by its current value
    const goalSelect = screen.getByDisplayValue('FI (Financial Independence)')
    await user.selectOptions(goalSelect, 'gw')

    expect(screen.getByText('Liquid')).toBeInTheDocument()
    expect(screen.getByText('Illiquid')).toBeInTheDocument()
  })

  // --- Owner dropdown ---

  it('shows partner option in owner dropdown when profile has a partner', () => {
    render(<AccountForm {...makeProps({ profile: profileWithPartner })} />)
    const ownerSelect = screen.getByDisplayValue(profileWithPartner.name || 'Primary')
    const options = Array.from((ownerSelect as HTMLSelectElement).options).map(o => o.textContent)
    expect(options).toContain('Jane')
    expect(options).toContain('Joint')
  })

  it('does not show partner option when profile has no partner', () => {
    render(<AccountForm {...makeProps()} />)
    const ownerSelect = screen.getByDisplayValue(profile.name || 'Primary')
    const options = Array.from((ownerSelect as HTMLSelectElement).options).map(o => o.textContent)
    expect(options).not.toContain('Partner')
    expect(options).toContain('Joint')
  })

  // --- Group dropdown ---

  it('shows existing groups in dropdown when group input is focused', async () => {
    const user = userEvent.setup()
    render(<AccountForm {...makeProps({ existingGroups: ['Brokerage', 'Savings'] })} />)

    const groupInput = screen.getByPlaceholderText('Optional group name')
    await user.click(groupInput)

    // Source uses a plain <ul>/<li> dropdown (not listbox/combobox pattern)
    expect(screen.getByText('Brokerage')).toBeInTheDocument()
    expect(screen.getByText('Savings')).toBeInTheDocument()
    const dropdown = screen.getByText('Brokerage').closest('ul')
    expect(dropdown).toBeInTheDocument()
  })

  it('shows create new option when typing a new group name', async () => {
    const user = userEvent.setup()
    render(<AccountForm {...makeProps({ existingGroups: ['Retirement'] })} />)

    const groupInput = screen.getByPlaceholderText('Optional group name')
    await user.type(groupInput, 'NewGroup')

    expect(screen.getByText(/Create "NewGroup"/)).toBeInTheDocument()
  })

  // --- Linked account selector ---

  it('shows linked asset selector when nature is liability', async () => {
    const user = userEvent.setup()
    const assetAcct = makeAccount({ id: 10, name: 'House', nature: 'asset' })
    render(
      <AccountForm
        {...makeProps({
          allAccounts: [assetAcct],
        })}
      />,
    )

    const natureSelect = screen.getByDisplayValue('Asset')
    await user.selectOptions(natureSelect, 'liability')

    expect(screen.getByText('Linked Asset')).toBeInTheDocument()
    expect(screen.getByText('House')).toBeInTheDocument()
  })

  it('does not show linked asset selector for asset nature', () => {
    render(<AccountForm {...makeProps()} />)
    expect(screen.queryByText('Linked Asset')).not.toBeInTheDocument()
  })

  // --- Name validation ---

  it('does not call onSave when name is empty', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<AccountForm {...makeProps({ onSave })} />)

    await user.click(screen.getByRole('button', { name: /Add Account/ }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not call onSave when name is only whitespace', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<AccountForm {...makeProps({ onSave })} />)

    await user.type(screen.getByPlaceholderText('e.g. Chase Checking'), '   ')
    await user.click(screen.getByRole('button', { name: /Add Account/ }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('trims leading and trailing spaces from name before saving', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<AccountForm {...makeProps({ onSave })} />)

    await user.type(screen.getByPlaceholderText('e.g. Chase Checking'), '  My 401k  ')
    await user.click(screen.getByRole('button', { name: /Add Account/ }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].name).toBe('My 401k')
  })

  // --- onSave callback ---

  it('calls onSave with complete data when form is submitted', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<AccountForm {...makeProps({ onSave })} />)

    await user.type(screen.getByPlaceholderText('e.g. Chase Checking'), 'My 401k')
    await user.type(screen.getByPlaceholderText('e.g. Chase'), 'Fidelity')
    await user.click(screen.getByRole('button', { name: /Add Account/ }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const data = onSave.mock.calls[0][0]
    expect(data.name).toBe('My 401k')
    expect(data.institution).toBe('Fidelity')
    expect(data.goalType).toBe('fi')
    expect(data.type).toBe('retirement')
    expect(data.owner).toBe('primary')
    expect(data.status).toBe('active')
    expect(data.nature).toBe('asset')
  })

  it('shows Update button label when editing an existing account', () => {
    const existing = makeAccount({ id: 5, name: 'Old Name' })
    render(<AccountForm {...makeProps({ initial: existing })} />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('shows Add Account button label for new accounts', () => {
    render(<AccountForm {...makeProps()} />)
    expect(screen.getByRole('button', { name: 'Add Account' })).toBeInTheDocument()
  })

  // --- Cancel ---

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<AccountForm {...makeProps({ onCancel })} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
