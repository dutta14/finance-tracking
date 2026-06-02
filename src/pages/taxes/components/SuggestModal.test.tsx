import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SuggestModal from './SuggestModal'
import { makeAccount } from '../../../test/factories'
import type { SuggestModalProps } from './SuggestModal'

const baseProps: SuggestModalProps = {
  accounts: [
    makeAccount({ id: 1, name: 'Fidelity 401k', owner: 'primary' }),
    makeAccount({ id: 2, name: 'Vanguard IRA', owner: 'primary' }),
    makeAccount({ id: 3, name: 'Partner Roth', owner: 'partner' }),
  ],
  alreadyLinked: new Set<number>(),
  owner: 'primary',
  onAdd: vi.fn(),
  onClose: vi.fn(),
}

describe('SuggestModal', () => {
  it('filters accounts by owner', () => {
    render(<SuggestModal {...baseProps} />)
    expect(screen.getByText('Fidelity 401k')).toBeInTheDocument()
    expect(screen.getByText('Vanguard IRA')).toBeInTheDocument()
    expect(screen.queryByText('Partner Roth')).not.toBeInTheDocument()
  })

  it('excludes already linked accounts', () => {
    render(<SuggestModal {...baseProps} alreadyLinked={new Set([1])} />)
    expect(screen.queryByText('Fidelity 401k')).not.toBeInTheDocument()
    expect(screen.getByText('Vanguard IRA')).toBeInTheDocument()
  })

  it('shows empty state when all accounts linked', () => {
    render(<SuggestModal {...baseProps} alreadyLinked={new Set([1, 2])} />)
    expect(screen.getByText('All accounts already have items')).toBeInTheDocument()
  })

  it('disables Add button when nothing selected', () => {
    render(<SuggestModal {...baseProps} />)
    const addBtn = screen.getByRole('button', { name: /add/i })
    expect(addBtn).toBeDisabled()
  })

  it('enables Add button after selecting an account', async () => {
    render(<SuggestModal {...baseProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    const addBtn = screen.getByRole('button', { name: /add 1 account/i })
    expect(addBtn).not.toBeDisabled()
  })

  it('toggles account selection on and off', async () => {
    render(<SuggestModal {...baseProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    expect(checkboxes[0]).toBeChecked()
    await userEvent.click(checkboxes[0])
    expect(checkboxes[0]).not.toBeChecked()
  })

  it('calls onAdd with selected ids and label', async () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<SuggestModal {...baseProps} onAdd={onAdd} onClose={onClose} />)
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(screen.getByRole('button', { name: /add 1 account/i }))
    expect(onAdd).toHaveBeenCalledWith([1], 'Fidelity 401k')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows multi-account count when multiple selected', async () => {
    render(<SuggestModal {...baseProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[1])
    expect(screen.getByRole('button', { name: /add \(2 accounts\)/i })).toBeInTheDocument()
  })

  it('calls onClose when Cancel clicked', async () => {
    const onClose = vi.fn()
    render(<SuggestModal {...baseProps} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows inactive badge for inactive accounts', () => {
    const accounts = [makeAccount({ id: 1, name: 'Old Account', owner: 'primary', status: 'inactive' })]
    render(<SuggestModal {...baseProps} accounts={accounts} />)
    expect(screen.getByText('inactive')).toBeInTheDocument()
  })

  it('shows institution when available', () => {
    const accounts = [makeAccount({ id: 1, name: 'Fidelity', owner: 'primary', institution: 'Fidelity Investments' })]
    render(<SuggestModal {...baseProps} accounts={accounts} />)
    expect(screen.getByText('Fidelity Investments')).toBeInTheDocument()
  })
})
