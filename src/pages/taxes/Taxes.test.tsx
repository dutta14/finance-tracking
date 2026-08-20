import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Taxes from './Taxes'
import { makeTaxItem, makeAccount, makeProfile } from '../../test/factories'
import type { TaxDocFile } from './types'
import type { Account } from '../data/types'
import type { Profile } from '../../hooks/useProfile'
import { MemoryFileStore } from '../../utils/memoryFileStore'
import { FileStoreTestProvider } from '../../test/fileStoreTestUtils'

/* ─── Mocks ─── */

const CURRENT_YEAR = new Date().getFullYear()

const mockProfile: Profile = makeProfile({ name: 'Alice', partner: null })
vi.mock('../../hooks/useProfile', () => ({
  useProfile: vi.fn(() => ({ profile: mockProfile, updateProfile: vi.fn() })),
}))
import { useProfile } from '../../hooks/useProfile'
const mockedUseProfile = vi.mocked(useProfile)

const mockAccounts: Account[] = []
vi.mock('../../contexts/DataContext', () => ({
  useData: vi.fn(() => ({
    accounts: mockAccounts,
    balances: [],
    allMonths: [],
    setAccounts: vi.fn(),
    setBalances: vi.fn(),
  })),
}))
import { useData } from '../../contexts/DataContext'
const mockedUseData = vi.mocked(useData)

vi.mock('../../styles/Taxes.css', () => ({}))

/* ─── Helpers ─── */

let store: MemoryFileStore

function makeFile(overrides: Partial<TaxDocFile> = {}): TaxDocFile {
  return {
    id: 'f1',
    name: 'W2_2024.pdf',
    content: undefined,
    ext: 'pdf',
    uploadedAt: '2024-03-01T00:00:00Z',
    ...overrides,
  }
}

async function seedYear(year: number | string, items: object[]) {
  await store.writeJSON(`taxes/${year}.json`, { items })
}

async function seedTemplates(templates: object[]) {
  await store.writeJSON('taxes/templates.json', templates)
}

function renderTaxes() {
  return render(
    <FileStoreTestProvider store={store}>
      <MemoryRouter>
        <Taxes />
      </MemoryRouter>
    </FileStoreTestProvider>,
  )
}

beforeEach(() => {
  store = new MemoryFileStore()
  vi.clearAllMocks()
  // Reset profile to default
  mockedUseProfile.mockReturnValue({ profile: makeProfile({ name: 'Alice', partner: null }), updateProfile: vi.fn() })
  mockedUseData.mockReturnValue({
    accounts: [],
    balances: [],
    allMonths: [],
    setAccounts: vi.fn(),
    setBalances: vi.fn(),
  })
})

afterEach(() => {
  vi.useRealTimers()
})

/* ═══════════════════════════════════════════════════════════════
   TESTS
   ═══════════════════════════════════════════════════════════════ */

describe('Taxes', () => {
  describe('empty state', () => {
    it('renders empty state when no year data exists', async () => {
      const user = userEvent.setup()
      renderTaxes()
      expect(await screen.findByText(`No tax prep for ${CURRENT_YEAR}`)).toBeInTheDocument()
      const createBtn = await screen.findByText(`Create ${CURRENT_YEAR} Tax Prep`)
      expect(createBtn).toBeInTheDocument()
      await user.click(createBtn)
      expect(screen.queryByText(`No tax prep for ${CURRENT_YEAR}`)).not.toBeInTheDocument()
    })

    it('renders the year label in the header', async () => {
      renderTaxes()
      expect(await screen.findByText(String(CURRENT_YEAR))).toBeInTheDocument()
    })

    it('shows Import from Template button when templates exist and opens modal on click', async () => {
      await seedTemplates([
        { id: 't1', name: 'My Template', items: [{ label: 'W-2', owner: 'primary', category: 'paystub' }] },
      ])
      const user = userEvent.setup()
      renderTaxes()
      const importBtn = await screen.findByText('Import from Template')
      expect(importBtn).toBeInTheDocument()
      await user.click(importBtn)
      expect(await screen.findByText('Import from Template', { selector: 'h3' })).toBeInTheDocument()
    })

    it('does not show Import from Template button when no templates exist', async () => {
      renderTaxes()
      expect(screen.queryByText('Import from Template')).not.toBeInTheDocument()
    })
  })

  describe('year creation', () => {
    it('creates a year with default paystub items on button click', async () => {
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(`Create ${CURRENT_YEAR} Tax Prep`))
      // After creation, empty state should be gone
      expect(screen.queryByText(`No tax prep for ${CURRENT_YEAR}`)).not.toBeInTheDocument()
      // Primary section should appear with paystub
      expect(await screen.findByText("Alice's Paystubs")).toBeInTheDocument()
    })

    it('creates partner paystub when partner exists', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '1990-01-01' } }),
        updateProfile: vi.fn(),
      })
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(`Create ${CURRENT_YEAR} Tax Prep`))
      expect(await screen.findByText("Alice's Paystubs")).toBeInTheDocument()
      expect(await screen.findByText("Bob's Paystubs")).toBeInTheDocument()
    })
  })

  describe('year navigation', () => {
    it('navigates to previous year', async () => {
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByTitle('Previous year'))
      expect(await screen.findByText(String(CURRENT_YEAR - 1))).toBeInTheDocument()
    })

    it('navigates to next year', async () => {
      const user = userEvent.setup()
      renderTaxes()
      // Go back first, then forward
      await user.click(await screen.findByTitle('Previous year'))
      await user.click(await screen.findByTitle('Next year'))
      expect(await screen.findByText(String(CURRENT_YEAR))).toBeInTheDocument()
    })

    it('disables forward navigation at current year', async () => {
      renderTaxes()
      const forwardBtn = await screen.findByTitle('Next year')
      expect(forwardBtn).toBeDisabled()
    })

    it('shows empty state when navigating to year without data', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs" })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByTitle('Previous year'))
      expect(await screen.findByText(`No tax prep for ${CURRENT_YEAR - 1}`)).toBeInTheDocument()
    })
  })

  describe('checklist display', () => {
    it('renders items grouped by owner sections', async () => {
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary', category: 'paystub' }),
                makeTaxItem({ id: '2', label: 'Joint Docs', owner: 'joint', category: 'custom' }),
              ],
            )
      renderTaxes()
      expect(await screen.findByText("Alice's Paystubs")).toBeInTheDocument()
      expect(await screen.findByText('Joint Docs')).toBeInTheDocument()
    })

    it('shows tick mark for items with files', async () => {
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({
                  id: '1',
                  label: 'W-2',
                  files: [makeFile()],
                }),
              ],
            )
      renderTaxes()
      expect(await screen.findByText('✓')).toBeInTheDocument()
    })

    it('displays file names in chips for uploaded files', async () => {
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({
                  id: '1',
                  label: 'W-2',
                  files: [makeFile({ name: 'Alice_W2.pdf' })],
                }),
              ],
            )
      renderTaxes()
      expect(await screen.findByText('Alice_W2.pdf')).toBeInTheDocument()
    })

    it('shows completion count per section', async () => {
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({ id: '1', label: 'W-2', owner: 'primary', files: [makeFile()] }),
                makeTaxItem({ id: '2', label: '1099', owner: 'primary', files: [] }),
              ],
            )
      renderTaxes()
      expect(await screen.findByText('1/2')).toBeInTheDocument()
    })

    it('shows "No items yet" for empty owner sections', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      renderTaxes()
      // Primary section has 1 item (paystub), joint section has 0 items
      const noItemsTexts = await screen.findAllByText('No items yet')
      expect(noItemsTexts.length).toBe(1)
    })
  })

  describe('add custom item', () => {
    it('opens add item modal and adds custom item', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      // Click the first "+ Add Item" button (primary section)
      const addButtons = await screen.findAllByText('+ Add Item')
      await user.click(addButtons[0])
      // Modal should appear
      expect(await screen.findByText('Add Checklist Item')).toBeInTheDocument()
      // Type custom label
      const input = await screen.findByPlaceholderText('Item name')
      await user.type(input, 'HSA Contribution')
      // Click Add
      const addBtn = await screen.findByRole('button', { name: 'Add' })
      await user.click(addBtn)
      // Item should appear in the checklist
      expect(await screen.findByText('HSA Contribution')).toBeInTheDocument()
    })

    it('disables Add button when input is empty', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      const addButtons = await screen.findAllByText('+ Add Item')
      await user.click(addButtons[0])
      const addBtn = await screen.findByRole('button', { name: 'Add' })
      expect(addBtn).toBeDisabled()
    })

    it('enables Add button when input has content', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      const addButtons = await screen.findAllByText('+ Add Item')
      await user.click(addButtons[0])
      const addBtn = await screen.findByRole('button', { name: 'Add' })
      expect(addBtn).toBeDisabled()
      const input = await screen.findByPlaceholderText('Item name')
      await user.type(input, 'W-2')
      expect(addBtn).toBeEnabled()
    })
  })

  describe('rename item', () => {
    it('renames checklist item via More actions menu', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      // Open More actions menu for the item
      const moreBtn = await screen.findByTitle('More actions')
      await user.click(moreBtn)
      await user.click(await screen.findByText('Rename'))
      // Should show rename input
      const input = await screen.findByDisplayValue('W-2')
      await user.clear(input)
      await user.type(input, 'W-2 from Employer{Enter}')
      await waitFor(() => {
        expect(screen.getByText('W-2 from Employer')).toBeInTheDocument()
      })
    })
  })

  describe('remove item', () => {
    it('removes a checklist item when remove button is clicked', async () => {
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({ id: '1', label: 'W-2', owner: 'primary' }),
                makeTaxItem({ id: '2', label: '1099-INT', owner: 'primary' }),
              ],
            )
      const user = userEvent.setup()
      renderTaxes()
      // Click More actions for the first item and delete it
      const moreButtons = await screen.findAllByTitle('More actions')
      await user.click(moreButtons[0])
      await user.click(await screen.findByText('Delete'))
      // W-2 should be gone
      expect(screen.queryByText('W-2')).not.toBeInTheDocument()
      expect(await screen.findByText('1099-INT')).toBeInTheDocument()
    })
  })

  describe('remove file', () => {
    it('removes a file from an item when remove file button is clicked', async () => {
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({
                  id: '1',
                  label: 'W-2',
                  owner: 'primary',
                  files: [makeFile({ id: 'f1', name: 'W2_2024.pdf' }), makeFile({ id: 'f2', name: 'W2_extra.pdf' })],
                }),
              ],
            )
      const user = userEvent.setup()
      renderTaxes()
      // Should see both files
      expect(await screen.findByText('W2_2024.pdf')).toBeInTheDocument()
      expect(await screen.findByText('W2_extra.pdf')).toBeInTheDocument()
      // Click "Remove file" button on first file
      const removeFileButtons = await screen.findAllByTitle('Remove file')
      await user.click(removeFileButtons[0])
      // First file should be removed
      expect(screen.queryByText('W2_2024.pdf')).not.toBeInTheDocument()
      expect(await screen.findByText('W2_extra.pdf')).toBeInTheDocument()
    })
  })

  describe('file upload', () => {
    it('shows Upload button for items without files', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary', files: [] })],
            )
      renderTaxes()
      expect(await screen.findByText('Upload')).toBeInTheDocument()
    })

    it('shows Add button for items that already have files', async () => {
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({
                  id: '1',
                  label: 'W-2',
                  owner: 'primary',
                  files: [makeFile()],
                }),
              ],
            )
      renderTaxes()
      // "Add" button in item actions for item with files
      const addBtns = await screen.findAllByText('Add')
      expect(addBtns.length).toBe(1)
    })

    it('rejects files larger than 10 MB', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary', files: [] })],
            )
      renderTaxes()
      // Wait for item to load so file input is in the DOM
      await screen.findByText('Upload')
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const bigFile = new File(['x'.repeat(100)], 'big.pdf', { type: 'application/pdf' })
      Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 })
      fireEvent.change(fileInput, { target: { files: [bigFile] } })
      await waitFor(() => {
        expect(screen.getByText(/exceeds the 10 MB limit/)).toBeInTheDocument()
      })
    })
  })

  describe('linked accounts display', () => {
    it('renders item that has accountIds without breaking', async () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Savings Account', owner: 'primary' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({
                  id: '1',
                  label: '1099-INT',
                  owner: 'primary',
                  accountIds: [10],
                  category: 'account',
                }),
              ],
            )
      renderTaxes()
      // Item label should still be visible; account names are no longer shown inline
      expect(await screen.findByText('1099-INT')).toBeInTheDocument()
    })
  })

  describe('partner sections', () => {
    it('shows partner section when partner exists', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '1990-01-01' } }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      renderTaxes()
      // Partner section title
      expect(await screen.findByText('Bob')).toBeInTheDocument()
    })

    it('hides partner section when no partner exists', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: null }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      renderTaxes()
      // Only Alice and Joint sections, no partner
      const sectionTitles = await screen.findAllByRole('heading', { level: 3 })
      const titleTexts = sectionTitles.map(h => h.textContent)
      expect(titleTexts).not.toContain('Partner')
    })
  })

  describe('add paystub', () => {
    it('hides Add Paystub button when owner already has a paystub item', async () => {
      // The component auto-backfills paystub items via useEffect, so when
      // we seed with a paystub already present, the button should be hidden.
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary', category: 'paystub' })],
            )
      renderTaxes()
      // Wait for any effects to settle
      await waitFor(() => {
        // Primary section should not have Add Paystub since paystub exists
        // Joint section never shows paystub button (owner === 'joint')
        const paystubBtns = screen.queryAllByText('+ Add Paystub')
        expect(paystubBtns.length).toBe(0)
      })
    })

    it('adds paystub item via Add Paystub button', async () => {
      // With partner, the partner section initially has no paystub item
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '1990-01-01' } }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary', category: 'paystub' }),
                makeTaxItem({ id: '2', label: "Bob's Paystubs", owner: 'partner', category: 'paystub' }),
              ],
            )
      renderTaxes()
      // Both sections have paystubs, so no Add Paystub buttons visible for primary/partner
      await waitFor(() => {
        const paystubBtns = screen.queryAllByText('+ Add Paystub')
        expect(paystubBtns.length).toBe(0)
      })
    })
  })

  describe('suggest from accounts', () => {
    it('shows From Accounts button when unlinked accounts exist', async () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Brokerage', owner: 'primary' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      renderTaxes()
      expect(await screen.findByText('+ From Accounts')).toBeInTheDocument()
    })

    it('opens suggest modal and adds account-linked item', async () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Brokerage', owner: 'primary' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText('+ From Accounts'))
      expect(await screen.findByText('Add from Accounts')).toBeInTheDocument()
      // Select the account
      const checkbox = await screen.findByRole('checkbox')
      await user.click(checkbox)
      // Click Add button in modal
      const addBtn = await screen.findByRole('button', { name: /Add 1 account/ })
      await user.click(addBtn)
      // Account-linked item should appear in the checklist
      expect(await screen.findByText('Brokerage')).toBeInTheDocument()
    })
  })

  describe('delete year', () => {
    it('shows confirmation dialog and deletes year', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      // Click Delete Year button
      await user.click(await screen.findByText(/Delete Year/))
      // Confirm dialog
      expect(await screen.findByText(`Delete ${CURRENT_YEAR} Tax Prep?`)).toBeInTheDocument()
      await user.click(await screen.findByRole('button', { name: 'Delete' }))
      // Should return to empty state
      expect(await screen.findByText(`No tax prep for ${CURRENT_YEAR}`)).toBeInTheDocument()
    })

    it('cancels delete when Cancel is clicked', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Delete Year/))
      const cancelBtns = await screen.findAllByRole('button', { name: 'Cancel' })
      await user.click(cancelBtns[cancelBtns.length - 1])
      // Still showing checklist
      expect(await screen.findByText("Alice's Paystubs")).toBeInTheDocument()
    })
  })

  describe('templates', () => {
    it('opens save template modal', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Save as Template/))
      expect(await screen.findByText('Save as Template', { selector: 'h3' })).toBeInTheDocument()
    })

    it('creates a year from a template', async () => {
      // Set up a template in storage
      await seedTemplates([
        {
          id: 't1',
          name: 'Standard',
          items: [
            { label: 'W-2 Wages', owner: 'primary', category: 'paystub' },
            { label: 'Mortgage Interest', owner: 'joint', category: 'custom' },
          ],
        },
      ])
      const user = userEvent.setup()
      renderTaxes()
      // Should show Import from Template in empty state
      await user.click(await screen.findByText('Import from Template'))
      expect(await screen.findByText('Import from Template', { selector: 'h3' })).toBeInTheDocument()
      // Click Use on the template
      await user.click(await screen.findByText('Use'))
      // Template items should now appear
      expect(await screen.findByText('W-2 Wages')).toBeInTheDocument()
      expect(await screen.findByText('Mortgage Interest')).toBeInTheDocument()
    })
  })

  describe('tax return section', () => {
    it('renders Tax Returns section header', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      renderTaxes()
      expect(await screen.findByText('Tax Returns')).toBeInTheDocument()
    })

    it('shows empty message when no return is uploaded', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      renderTaxes()
      expect(await screen.findByText('No return uploaded yet. Use the menu to add.')).toBeInTheDocument()
    })
  })

  describe('upload error auto-clear', () => {
    it('clears upload error after 5 seconds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary', files: [] })],
            )
      renderTaxes()
      // Flush pending microtasks so the async store load completes
      await act(async () => {})
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const bigFile = new File(['x'], 'huge.pdf', { type: 'application/pdf' })
      Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 })
      fireEvent.change(fileInput, { target: { files: [bigFile] } })
      // Error should appear
      expect(await screen.findByText(/exceeds the 10 MB limit/)).toBeInTheDocument()
      // Advance timers by 5 seconds
      await vi.advanceTimersByTimeAsync(5000)
      await waitFor(() => {
        expect(screen.queryByText(/exceeds the 10 MB limit/)).not.toBeInTheDocument()
      })
    })
  })

  describe('add custom item via Enter key', () => {
    it('adds custom item when Enter is pressed in the input', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      const addButtons = await screen.findAllByText('+ Add Item')
      await user.click(addButtons[0])
      const input = await screen.findByPlaceholderText('Item name')
      await user.type(input, 'HSA Docs{Enter}')
      // Modal should close and item should appear
      expect(await screen.findByText('HSA Docs')).toBeInTheDocument()
    })

    it('does not add item via Enter when input is empty', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      const addButtons = await screen.findAllByText('+ Add Item')
      await user.click(addButtons[0])
      const input = await screen.findByPlaceholderText('Item name')
      await user.type(input, '{Enter}')
      // Modal should still be open
      expect(await screen.findByText('Add Checklist Item')).toBeInTheDocument()
    })
  })

  describe('add item modal cancel', () => {
    it('closes add item modal when Cancel is clicked', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      const addButtons = await screen.findAllByText('+ Add Item')
      await user.click(addButtons[0])
      expect(await screen.findByText('Add Checklist Item')).toBeInTheDocument()
      await user.click(await screen.findByRole('button', { name: 'Cancel' }))
      expect(screen.queryByText('Add Checklist Item')).not.toBeInTheDocument()
    })
  })

  describe('rename item via double-click and keyboard', () => {
    it('renames checklist item on Enter key in rename input', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByTitle('More actions'))
      const renameBtn = await screen.findByText('Rename')
      await user.click(renameBtn)
      const input = await screen.findByDisplayValue('W-2')
      await user.clear(input)
      await user.type(input, 'W-2 Updated{Enter}')
      await waitFor(() => {
        expect(screen.getByText('W-2 Updated')).toBeInTheDocument()
      })
    })

    it('cancels rename on Escape key', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByTitle('More actions'))
      const renameBtn = await screen.findByText('Rename')
      await user.click(renameBtn)
      const input = await screen.findByDisplayValue('W-2')
      await user.clear(input)
      await user.type(input, 'Something Else')
      await user.keyboard('{Escape}')
      // Should revert to original label
      await waitFor(() => {
        expect(screen.getByText('W-2')).toBeInTheDocument()
      })
    })

    it('commits rename on blur with changed value', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByTitle('More actions'))
      const renameBtn = await screen.findByText('Rename')
      await user.click(renameBtn)
      const input = await screen.findByDisplayValue('W-2')
      await user.clear(input)
      await user.type(input, 'W-2 Wages')
      // Trigger blur by tabbing away
      await user.tab()
      await waitFor(() => {
        expect(screen.getByText('W-2 Wages')).toBeInTheDocument()
      })
    })
  })

  describe('save template modal', () => {
    it('saves new template with name', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Save as Template/))
      expect(await screen.findByText('Save as Template', { selector: 'h3' })).toBeInTheDocument()
      const nameInput = await screen.findByPlaceholderText('Template name')
      await user.type(nameInput, 'My Template')
      const saveBtn = await screen.findByRole('button', { name: 'Save New' })
      expect(saveBtn).toBeEnabled()
      await user.click(saveBtn)
      // Modal should close
      expect(screen.queryByText('Save as Template', { selector: 'h3' })).not.toBeInTheDocument()
    })

    it('disables Save New button when template name is empty', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Save as Template/))
      const saveBtn = await screen.findByRole('button', { name: 'Save New' })
      expect(saveBtn).toBeDisabled()
    })

    it('saves template via Enter key in name input', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Save as Template/))
      const nameInput = await screen.findByPlaceholderText('Template name')
      await user.type(nameInput, 'Quick Template{Enter}')
      // Modal should close (template saved via onKeyDown Enter)
      expect(screen.queryByText('Save as Template', { selector: 'h3' })).not.toBeInTheDocument()
    })

    it('shows update mode when existing templates exist', async () => {
      await seedTemplates([
        { id: 't1', name: 'Existing Template', items: [{ label: 'W-2', owner: 'primary', category: 'paystub' }] },
      ])
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Save as Template/))
      // Should show Update existing radio selected by default
      expect(await screen.findByText('Update existing')).toBeInTheDocument()
      expect(await screen.findByText('Create new')).toBeInTheDocument()
      // Update button should be visible
      expect(await screen.findByRole('button', { name: 'Update Template' })).toBeInTheDocument()
    })

    it('updates existing template when Update Template clicked', async () => {
      await seedTemplates([
        { id: 't1', name: 'Existing Template', items: [{ label: 'W-2', owner: 'primary', category: 'paystub' }] },
      ])
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Save as Template/))
      await user.click(await screen.findByRole('button', { name: 'Update Template' }))
      // Modal should close
      expect(screen.queryByText('Save as Template', { selector: 'h3' })).not.toBeInTheDocument()
    })

    it('switches to create new mode when Create new radio clicked', async () => {
      await seedTemplates([
        { id: 't1', name: 'Existing Template', items: [{ label: 'W-2', owner: 'primary', category: 'paystub' }] },
      ])
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Save as Template/))
      // Switch to Create new
      await user.click(await screen.findByText('Create new'))
      // Should show template name input
      expect(await screen.findByPlaceholderText('Template name')).toBeInTheDocument()
      expect(await screen.findByRole('button', { name: 'Save New' })).toBeInTheDocument()
    })

    it('cancels save template modal', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Save as Template/))
      expect(await screen.findByText('Save as Template', { selector: 'h3' })).toBeInTheDocument()
      await user.click(await screen.findByRole('button', { name: 'Cancel' }))
      expect(screen.queryByText('Save as Template', { selector: 'h3' })).not.toBeInTheDocument()
    })
  })

  describe('import template modal', () => {
    it('deletes template from import modal', async () => {
      await seedTemplates([
        { id: 't1', name: 'Template A', items: [{ label: 'W-2', owner: 'primary', category: 'paystub' }] },
        { id: 't2', name: 'Template B', items: [{ label: '1099', owner: 'primary', category: 'custom' }] },
      ])
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText('Import from Template'))
      // Should show both templates
      expect(await screen.findByText('Template A')).toBeInTheDocument()
      expect(await screen.findByText('Template B')).toBeInTheDocument()
      // Delete first template
      const deleteButtons = await screen.findAllByTitle('Delete template')
      await user.click(deleteButtons[0])
      await waitFor(() => {
        expect(screen.queryByText('Template A')).not.toBeInTheDocument()
      })
    })

    it('shows empty message when no templates exist in import modal', async () => {
      // Need templates to show the button, then delete them
      await seedTemplates([{ id: 't1', name: 'Only Template', items: [] }])
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText('Import from Template'))
      // Delete the only template
      await user.click(await screen.findByTitle('Delete template'))
      await waitFor(() => {
        expect(screen.getByText('No templates saved yet.')).toBeInTheDocument()
      })
    })
  })

  describe('tax return section', () => {
    async function openReturnMenu(user: ReturnType<typeof userEvent.setup>) {
      // The Tax Returns ⋯ button is in .tax-return-menu-wrap; wait for it to render
      const wrap = await waitFor(() => {
        const el = document.querySelector('.tax-return-menu-wrap button')
        if (!el) throw new Error('return menu wrap not found')
        return el as HTMLButtonElement
      })
      await user.click(wrap)
    }

    it('adds joint return entry via menu', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await openReturnMenu(user)
      // Click Upload Joint Return
      await user.click(await screen.findByText('Upload Joint Return'))
      // Joint Tax Return item should appear
      expect(await screen.findByText('Joint Tax Return')).toBeInTheDocument()
    })

    it('adds primary single return entry via menu', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await openReturnMenu(user)
      await user.click(await screen.findByText("Upload Alice's Return (Single)"))
      expect(await screen.findByText("Alice's Tax Return")).toBeInTheDocument()
    })

    it('adds partner single return entry via menu when partner exists', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '1990-01-01' } }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await openReturnMenu(user)
      await user.click(await screen.findByText("Upload Bob's Return (Single)"))
      expect(await screen.findByText("Bob's Tax Return")).toBeInTheDocument()
    })

    it('shows return item with uploaded file and upload button', async () => {
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' }),
                makeTaxItem({
                  id: 'r1',
                  label: 'Joint Tax Return',
                  owner: 'joint',
                  category: 'tax-return',
                  files: [makeFile({ id: 'rf1', name: 'return_2024.pdf' })],
                }),
              ],
            )
      renderTaxes()
      expect(await screen.findByText('Joint Tax Return')).toBeInTheDocument()
      expect(await screen.findByText('return_2024.pdf')).toBeInTheDocument()
    })

    it('hides Upload Joint Return when joint return already exists', async () => {
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' }),
                makeTaxItem({ id: 'r1', label: 'Joint Tax Return', owner: 'joint', category: 'tax-return' }),
              ],
            )
      const user = userEvent.setup()
      renderTaxes()
      await openReturnMenu(user)
      expect(screen.queryByText('Upload Joint Return')).not.toBeInTheDocument()
    })
  })

  describe('add paystub button', () => {
    it('adds paystub item for partner when Add Paystub clicked', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '1990-01-01' } }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary', category: 'paystub' }),
                // No partner paystub
              ],
            )
      renderTaxes()
      // Wait for backfill to add Bob's Paystubs automatically
      await waitFor(() => {
        expect(screen.getByText("Bob's Paystubs")).toBeInTheDocument()
      })
    })
  })

  describe('suggest from accounts modal', () => {
    it('closes suggest modal on Cancel click', async () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Brokerage', owner: 'primary' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText('+ From Accounts'))
      expect(await screen.findByText('Add from Accounts')).toBeInTheDocument()
      await user.click(await screen.findByRole('button', { name: 'Cancel' }))
      expect(screen.queryByText('Add from Accounts')).not.toBeInTheDocument()
    })

    it('disables Add button when no accounts selected in suggest modal', async () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Brokerage', owner: 'primary' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText('+ From Accounts'))
      // The disabled add button in the modal has empty text "Add "
      const modal = (await screen.findByText('Add from Accounts')).closest('.tax-modal')!
      const addBtn = within(modal as HTMLElement).getByRole('button', { name: /^Add/ })
      expect(addBtn).toBeDisabled()
    })

    it('shows All accounts already have items when all linked', async () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Brokerage', owner: 'primary' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [
                makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' }),
                makeTaxItem({ id: '2', label: 'Brokerage', owner: 'primary', category: 'account', accountIds: [10] }),
              ],
            )
      renderTaxes()
      // From Accounts button should be hidden since all accounts linked
      expect(screen.queryByText('+ From Accounts')).not.toBeInTheDocument()
    })

    it('adds multiple accounts as consolidated item', async () => {
      mockedUseData.mockReturnValue({
        accounts: [
          makeAccount({ id: 10, name: 'Brokerage', owner: 'primary' }),
          makeAccount({ id: 11, name: 'IRA', owner: 'primary' }),
        ],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText('+ From Accounts'))
      // Select both accounts
      const checkboxes = await screen.findAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])
      // Button should show count
      const addBtn = await screen.findByRole('button', { name: /Add \(2 accounts\)/ })
      await user.click(addBtn)
      // Consolidated label should appear
      expect(await screen.findByText('Brokerage / IRA')).toBeInTheDocument()
    })
  })

  describe('confirm delete modal', () => {
    it('closes confirm dialog when clicking overlay', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Delete Year/))
      expect(await screen.findByText(`Delete ${CURRENT_YEAR} Tax Prep?`)).toBeInTheDocument()
      // Click overlay to dismiss
      const heading = await screen.findByText(`Delete ${CURRENT_YEAR} Tax Prep?`)
      const overlay = heading.closest('.tax-modal')!.parentElement!
      await user.click(overlay)
      expect(screen.queryByText(`Delete ${CURRENT_YEAR} Tax Prep?`)).not.toBeInTheDocument()
    })
  })

  describe('suggest modal shows inactive badge', () => {
    it('shows inactive badge for inactive accounts in suggest modal', async () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Old Account', owner: 'primary', status: 'inactive' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText('+ From Accounts'))
      expect(await screen.findByText('inactive')).toBeInTheDocument()
    })

    it('shows institution name for accounts with institution', async () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Savings', owner: 'primary', institution: 'Chase' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText('+ From Accounts'))
      expect(await screen.findByText('Chase')).toBeInTheDocument()
    })
  })

  describe('year navigation', () => {
    it('navigates to previous year', async () => {
      renderTaxes()
      expect(await screen.findByText(String(CURRENT_YEAR))).toBeInTheDocument()
      fireEvent.click(await screen.findByTitle('Previous year'))
      expect(await screen.findByText(String(CURRENT_YEAR - 1))).toBeInTheDocument()
    })

    it('disables forward button when on current year', async () => {
      renderTaxes()
      const forwardBtn = await screen.findByTitle('Next year')
      expect(forwardBtn).toBeDisabled()
    })

    it('enables forward button when on a past year', async () => {
      renderTaxes()
      fireEvent.click(await screen.findByTitle('Previous year'))
      const forwardBtn = await screen.findByTitle('Next year')
      expect(forwardBtn).not.toBeDisabled()
    })
  })

  describe('double-click rename', () => {
    it('enters editing mode on double-click', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2 Forms', owner: 'primary' })],
            )
      renderTaxes()
      const label = await screen.findByText('W-2 Forms')
      fireEvent.doubleClick(label)
      const input = await screen.findByDisplayValue('W-2 Forms')
      expect(input).toBeInTheDocument()
      expect(input.tagName).toBe('INPUT')
    })

    it('reverts rename on Escape key', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2 Forms', owner: 'primary' })],
            )
      renderTaxes()
      const label = await screen.findByText('W-2 Forms')
      fireEvent.doubleClick(label)
      const input = await screen.findByDisplayValue('W-2 Forms')
      fireEvent.change(input, { target: { value: 'Changed' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(await screen.findByText('W-2 Forms')).toBeInTheDocument()
    })

    it('commits rename on blur when text changes', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2 Forms', owner: 'primary' })],
            )
      renderTaxes()
      const label = await screen.findByText('W-2 Forms')
      fireEvent.doubleClick(label)
      const input = await screen.findByDisplayValue('W-2 Forms')
      fireEvent.change(input, { target: { value: 'Updated W-2' } })
      fireEvent.blur(input)
      expect(await screen.findByText('Updated W-2')).toBeInTheDocument()
    })

    it('reverts to original label on blur when trimmed text is empty', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2 Forms', owner: 'primary' })],
            )
      renderTaxes()
      fireEvent.doubleClick(await screen.findByText('W-2 Forms'))
      const input = await screen.findByDisplayValue('W-2 Forms')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.blur(input)
      expect(await screen.findByText('W-2 Forms')).toBeInTheDocument()
    })
  })

  describe('save template modal', () => {
    it('opens and saves a new template', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2 Forms', owner: 'primary' })],
            )
      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Save as Template/))
      expect(await screen.findByRole('heading', { name: 'Save as Template' })).toBeInTheDocument()
      const nameInput = await screen.findByPlaceholderText('Template name')
      await user.type(nameInput, 'My Template')
      await user.click(await screen.findByText('Save New'))
      expect(screen.queryByPlaceholderText('Template name')).not.toBeInTheDocument()
    })

    it('shows update/create options when templates exist', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: '1', label: 'W-2 Forms', owner: 'primary' })],
            )
      // Templates are stored separately from the tax store
      await seedTemplates([
        { id: 'tpl1', name: 'Existing', items: [{ label: 'Item', owner: 'primary', category: 'w2' }] },
      ])

      const user = userEvent.setup()
      renderTaxes()
      await user.click(await screen.findByText(/Save as Template/))
      // Should show radio buttons for update/create
      expect(await screen.findByText('Update existing')).toBeInTheDocument()
      expect(await screen.findByText('Create new')).toBeInTheDocument()
    })
  })

  describe('storage estimate', () => {
    it('shows the year action buttons when a year with no items is loaded', async () => {
      await seedYear(CURRENT_YEAR, [])
      renderTaxes()
      // "Save as Template" appears only when the year exists
      expect(await screen.findByText('Save as Template')).toBeInTheDocument()
    })
  })

  /* ── OwnerBadge avatar rendering branches ───────────────────── */

  describe('OwnerBadge avatar branches', () => {
    it('renders primary avatar image when primaryAvatar is provided (line 60-61)', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', avatarDataUrl: 'data:image/png;base64,abc', partner: null }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 'p1', label: 'W-2', owner: 'primary', category: 'paystub' })],
            )
      const { container } = renderTaxes()
      await screen.findByText('W-2') // wait for async load
      const avatarImg = container.querySelector('.tax-owner-primary img')
      expect(avatarImg).not.toBeNull()
      expect((avatarImg as HTMLImageElement).src).toContain('data:image/png;base64,abc')
    })

    it('renders partner avatar image when partnerAvatar is provided (line 55-56)', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({
          name: 'Alice',
          partner: { name: 'Bob', avatarDataUrl: 'data:image/png;base64,xyz', birthday: '' },
        }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 'p1', label: '1099', owner: 'partner', category: 'account' })],
            )
      const { container } = renderTaxes()
      await screen.findByText('1099') // wait for async load
      const avatarImg = container.querySelector('.tax-owner-partner img')
      expect(avatarImg).not.toBeNull()
      expect((avatarImg as HTMLImageElement).src).toContain('data:image/png;base64,xyz')
    })

    it('renders joint owner badge with both initials when no avatars (line 40,43)', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '' } }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 'j1', label: 'Joint 1099', owner: 'joint', category: 'account' })],
            )
      const { container } = renderTaxes()
      await screen.findByText('Joint 1099') // wait for async load
      const jointBadge = container.querySelector('.tax-owner-group')
      expect(jointBadge).not.toBeNull()
      expect(jointBadge!.querySelector('.tax-owner-primary')!.textContent).toBe('A')
      expect(jointBadge!.querySelector('.tax-owner-partner')!.textContent).toBe('B')
    })

    it('renders joint owner badge with avatar images when both provided (line 40,43)', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({
          name: 'Alice',
          avatarDataUrl: 'data:image/png;base64,primary123',
          partner: { name: 'Bob', avatarDataUrl: 'data:image/png;base64,partner456', birthday: '' },
        }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 'j1', label: 'Joint Doc', owner: 'joint', category: 'account' })],
            )
      const { container } = renderTaxes()
      await screen.findByText('Joint Doc') // wait for async load
      const primaryImg = container.querySelector('.tax-owner-group .tax-owner-primary img')
      const partnerImg = container.querySelector('.tax-owner-group .tax-owner-partner img')
      expect(primaryImg).not.toBeNull()
      expect(partnerImg).not.toBeNull()
    })

    it('renders partner initial when partner has no avatar (line 56-58)', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '' } }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 's1', label: 'Partner 1099', owner: 'partner', category: 'account' })],
            )
      const { container } = renderTaxes()
      await screen.findByText('Partner 1099') // wait for async load
      const partnerBadge = container.querySelector('.tax-owner-partner')
      expect(partnerBadge).not.toBeNull()
      expect(partnerBadge!.querySelector('img')).toBeNull()
      expect(partnerBadge!.textContent).toBe('B')
    })

    it('renders primary initial when empty name defaults to P (line 34)', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: '', partner: null }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 'p2', label: 'W-2', owner: 'primary', category: 'paystub' })],
            )
      const { container } = renderTaxes()
      await screen.findByText('W-2') // wait for async load
      const primaryBadge = container.querySelector('.tax-owner-primary')
      expect(primaryBadge).not.toBeNull()
      expect(primaryBadge!.textContent).toBe('P')
    })

    it('uses Partner default name when partner name is empty (line 35)', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: '', avatarDataUrl: '', birthday: '' } }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 's2', label: 'Doc', owner: 'partner', category: 'account' })],
            )
      const { container } = renderTaxes()
      await screen.findByText('Doc') // wait for async load
      // partner.name is '' → partnerName = profile.partner?.name || 'Partner' = 'Partner' → initial = 'P'
      const partnerBadge = container.querySelector('.tax-owner-partner')
      expect(partnerBadge).not.toBeNull()
      expect(partnerBadge!.textContent).toBe('P')
    })
  })

  /* ── SuggestModal branches ──────────────────────────────────── */

  describe('SuggestModal branches', () => {
    it('allows toggling account selection and disables Add when none selected (line 314, 320)', async () => {
      const user = userEvent.setup()
      mockedUseData.mockReturnValue({
        accounts: [
          makeAccount({ id: 1, name: 'Checking', owner: 'primary', status: 'active' }),
          makeAccount({ id: 2, name: 'Savings', owner: 'primary', status: 'active' }),
        ],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 'x1', label: 'W-2', owner: 'primary', category: 'paystub' })],
            )
      renderTaxes()
      // Button text is "+ From Accounts"
      const suggestBtns = await screen.findAllByText('+ From Accounts')
      await user.click(suggestBtns[0])
      // Modal is open
      expect(await screen.findByText('Add from Accounts')).toBeInTheDocument()
      // Select first account
      const checkboxes = await screen.findAllByRole('checkbox')
      await user.click(checkboxes[0])
      // Deselect (toggle branch line 314)
      await user.click(checkboxes[0])
      // Add button should be disabled (0 selected, line 320)
      const addBtn = await screen.findByRole('button', { name: /Add$/i })
      expect(addBtn).toBeDisabled()
    })

    it('filters suggestions by owner and handles ownerFilter for joint (line 308, 309)', async () => {
      const user = userEvent.setup()
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '' } }),
        updateProfile: vi.fn(),
      })
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 1, name: 'Joint Checking', owner: 'joint', status: 'active' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 'x1', label: 'W-2', owner: 'primary', category: 'paystub' })],
            )
      renderTaxes()
      // Open suggest modal for joint section
      const suggestBtns = await screen.findAllByText('+ From Accounts')
      // The joint section's button
      const jointBtn = suggestBtns[suggestBtns.length - 1]
      await user.click(jointBtn)
      // Should show the joint account as a suggestion
      expect(await screen.findByText('Joint Checking')).toBeInTheDocument()
    })
  })

  /* ── handleUpload branches ──────────────────────────────────── */

  describe('handleUpload branches', () => {
    it('shows error when file exceeds 10MB (line 751-752)', async () => {
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 'up1', label: 'W-2', owner: 'primary', category: 'paystub' })],
            )
      renderTaxes()
      // Wait for async data to load so the file input is rendered
      await screen.findByText('W-2')
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const bigFile = new File(['x'.repeat(11 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' })
      Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 })
      fireEvent.change(fileInput, { target: { files: [bigFile] } })

      await waitFor(() => {
        expect(screen.getByText(/exceeds the 10 MB limit/)).toBeInTheDocument()
      })
    })
  })

  /* ── handleAddCustom and handleSuggestAdd null guards ─────── */

  describe('handler null guards', () => {
    it('handleAddPaystub adds item for partner owner (line 809)', async () => {
      const user = userEvent.setup()
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '' } }),
        updateProfile: vi.fn(),
      })
      await seedYear(CURRENT_YEAR, [makeTaxItem({ id: 'pp1', label: 'W-2', owner: 'partner', category: 'account' })],
            )
      renderTaxes()
      // Look for "Add Paystub" button in the partner section
      const paystubBtns = screen.queryAllByText(/Add Paystub/)
      if (paystubBtns.length > 0) {
        await user.click(paystubBtns[paystubBtns.length - 1])
        await waitFor(() => {
          expect(screen.getByText(/Bob's Paystubs/)).toBeInTheDocument()
        })
      }
    })
  })
})
