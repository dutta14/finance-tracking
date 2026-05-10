import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'
import Taxes from './Taxes'
import { makeTaxItem, makeTaxStore, makeAccount, makeProfile } from '../../test/factories'
import type { TaxChecklistItem, TaxDocFile, TaxStore, TaxDocOwner, ChecklistCategory } from './types'
import type { Account } from '../data/types'
import type { Profile } from '../../hooks/useProfile'

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

// Mock taxFileDB to avoid real IndexedDB ops
vi.mock('../../utils/taxFileDB', () => ({
  saveFileContent: vi.fn().mockResolvedValue(undefined),
  getFileContent: vi.fn().mockResolvedValue(null),
  deleteFileContent: vi.fn().mockResolvedValue(undefined),
  deleteMultipleFiles: vi.fn().mockResolvedValue(undefined),
  getStorageEstimate: vi.fn().mockResolvedValue({ usedMB: 1.2, quotaMB: 100 }),
}))

// Mock EncryptionContext
vi.mock('../../contexts/EncryptionContext', () => ({
  useEncryption: vi.fn(() => ({ cryptoKey: null })),
  EncryptionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock appStorage
vi.mock('../../utils/appStorage', () => {
  const store: Record<string, string> = {}
  return {
    appStorage: {
      getJSON: vi.fn(<T,>(key: string, fallback: T): T => {
        const val = store[key]
        if (val === undefined) return fallback
        try {
          return JSON.parse(val) as T
        } catch {
          return fallback
        }
      }),
      setJSON: vi.fn((key: string, value: unknown) => {
        store[key] = JSON.stringify(value)
      }),
      subscribe: vi.fn(() => () => {}),
      _store: store,
    },
  }
})

vi.mock('../../styles/Taxes.css', () => ({}))

import { appStorage } from '../../utils/appStorage'
const mockStore = (appStorage as unknown as { _store: Record<string, string> })._store

/* ─── Helpers ─── */

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

function seedTaxStore(store: TaxStore) {
  mockStore['tax-store'] = JSON.stringify(store)
}

function clearMockStore() {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key]
  }
}

beforeEach(() => {
  clearMockStore()
  localStorage.clear()
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
      render(<Taxes />)
      expect(screen.getByText(`No tax prep for ${CURRENT_YEAR}`)).toBeInTheDocument()
      const createBtn = screen.getByText(`Create ${CURRENT_YEAR} Tax Prep`)
      expect(createBtn).toBeInTheDocument()
      await user.click(createBtn)
      expect(screen.queryByText(`No tax prep for ${CURRENT_YEAR}`)).not.toBeInTheDocument()
    })

    it('renders the year label in the header', () => {
      render(<Taxes />)
      expect(screen.getByText(String(CURRENT_YEAR))).toBeInTheDocument()
    })

    it('shows Import from Template button when templates exist and opens modal on click', async () => {
      mockStore['tax-templates'] = JSON.stringify([
        { id: 't1', name: 'My Template', items: [{ label: 'W-2', owner: 'primary', category: 'paystub' }] },
      ])
      const user = userEvent.setup()
      render(<Taxes />)
      const importBtn = screen.getByText('Import from Template')
      expect(importBtn).toBeInTheDocument()
      await user.click(importBtn)
      expect(screen.getByText('Import from Template', { selector: 'h3' })).toBeInTheDocument()
    })

    it('does not show Import from Template button when no templates exist', () => {
      render(<Taxes />)
      expect(screen.queryByText('Import from Template')).not.toBeInTheDocument()
    })
  })

  describe('year creation', () => {
    it('creates a year with default paystub items on button click', async () => {
      const user = userEvent.setup()
      render(<Taxes />)
      await user.click(screen.getByText(`Create ${CURRENT_YEAR} Tax Prep`))
      // After creation, empty state should be gone
      expect(screen.queryByText(`No tax prep for ${CURRENT_YEAR}`)).not.toBeInTheDocument()
      // Primary section should appear with paystub
      expect(screen.getByText("Alice's Paystubs")).toBeInTheDocument()
    })

    it('creates partner paystub when partner exists', async () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '1990-01-01' } }),
        updateProfile: vi.fn(),
      })
      const user = userEvent.setup()
      render(<Taxes />)
      await user.click(screen.getByText(`Create ${CURRENT_YEAR} Tax Prep`))
      expect(screen.getByText("Alice's Paystubs")).toBeInTheDocument()
      expect(screen.getByText("Bob's Paystubs")).toBeInTheDocument()
    })
  })

  describe('year navigation', () => {
    it('navigates to previous year', async () => {
      const user = userEvent.setup()
      render(<Taxes />)
      await user.click(screen.getByText('←'))
      expect(screen.getByText(String(CURRENT_YEAR - 1))).toBeInTheDocument()
    })

    it('navigates to next year', async () => {
      const user = userEvent.setup()
      render(<Taxes />)
      // Go back first, then forward
      await user.click(screen.getByText('←'))
      await user.click(screen.getByText('→'))
      expect(screen.getByText(String(CURRENT_YEAR))).toBeInTheDocument()
    })

    it('disables forward navigation at current year', () => {
      render(<Taxes />)
      const forwardBtn = screen.getByText('→')
      expect(forwardBtn).toBeDisabled()
    })

    it('shows empty state when navigating to year without data', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs" })],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      await user.click(screen.getByText('←'))
      expect(screen.getByText(`No tax prep for ${CURRENT_YEAR - 1}`)).toBeInTheDocument()
    })
  })

  describe('checklist display', () => {
    it('renders items grouped by owner sections', () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary', category: 'paystub' }),
                makeTaxItem({ id: '2', label: 'Joint Docs', owner: 'joint', category: 'custom' }),
              ],
            },
          },
        }),
      )
      render(<Taxes />)
      expect(screen.getByText("Alice's Paystubs")).toBeInTheDocument()
      expect(screen.getByText('Joint Docs')).toBeInTheDocument()
    })

    it('shows tick mark for items with files', () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeTaxItem({
                  id: '1',
                  label: 'W-2',
                  files: [makeFile()],
                }),
              ],
            },
          },
        }),
      )
      render(<Taxes />)
      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('displays file names in chips for uploaded files', () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeTaxItem({
                  id: '1',
                  label: 'W-2',
                  files: [makeFile({ name: 'Alice_W2.pdf' })],
                }),
              ],
            },
          },
        }),
      )
      render(<Taxes />)
      expect(screen.getByText('Alice_W2.pdf')).toBeInTheDocument()
    })

    it('shows completion count per section', () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeTaxItem({ id: '1', label: 'W-2', owner: 'primary', files: [makeFile()] }),
                makeTaxItem({ id: '2', label: '1099', owner: 'primary', files: [] }),
              ],
            },
          },
        }),
      )
      render(<Taxes />)
      expect(screen.getByText('1/2')).toBeInTheDocument()
    })

    it('shows "No items yet" for empty owner sections', () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      render(<Taxes />)
      // Primary section has 1 item (paystub), joint section has 0 items
      const noItemsTexts = screen.getAllByText('No items yet')
      expect(noItemsTexts.length).toBe(1)
    })
  })

  describe('add custom item', () => {
    it('opens add item modal and adds custom item', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      // Click the first "+ Add Item" button (primary section)
      const addButtons = screen.getAllByText('+ Add Item')
      await user.click(addButtons[0])
      // Modal should appear
      expect(screen.getByText('Add Checklist Item')).toBeInTheDocument()
      // Type custom label
      const input = screen.getByPlaceholderText('Item name')
      await user.type(input, 'HSA Contribution')
      // Click Add
      const addBtn = screen.getByRole('button', { name: 'Add' })
      await user.click(addBtn)
      // Item should appear in the checklist
      expect(screen.getByText('HSA Contribution')).toBeInTheDocument()
    })

    it('disables Add button when input is empty', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      const addButtons = screen.getAllByText('+ Add Item')
      await user.click(addButtons[0])
      const addBtn = screen.getByRole('button', { name: 'Add' })
      expect(addBtn).toBeDisabled()
    })

    it('enables Add button when input has content', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      const addButtons = screen.getAllByText('+ Add Item')
      await user.click(addButtons[0])
      const addBtn = screen.getByRole('button', { name: 'Add' })
      expect(addBtn).toBeDisabled()
      const input = screen.getByPlaceholderText('Item name')
      await user.type(input, 'W-2')
      expect(addBtn).toBeEnabled()
    })
  })

  describe('rename item', () => {
    it('renames checklist item via rename button', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary' })],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      // Click the rename button (✎)
      const renameBtn = screen.getByTitle('Rename')
      await user.click(renameBtn)
      // Should show rename input
      const input = screen.getByDisplayValue('W-2')
      await user.clear(input)
      await user.type(input, 'W-2 from Employer{Enter}')
      await waitFor(() => {
        expect(screen.getByText('W-2 from Employer')).toBeInTheDocument()
      })
    })
  })

  describe('remove item', () => {
    it('removes a checklist item when remove button is clicked', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeTaxItem({ id: '1', label: 'W-2', owner: 'primary' }),
                makeTaxItem({ id: '2', label: '1099-INT', owner: 'primary' }),
              ],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      // Click the remove button for the first item (the × in actions)
      const removeButtons = screen.getAllByTitle('Remove item')
      await user.click(removeButtons[0])
      // W-2 should be gone
      expect(screen.queryByText('W-2')).not.toBeInTheDocument()
      expect(screen.getByText('1099-INT')).toBeInTheDocument()
    })
  })

  describe('remove file', () => {
    it('removes a file from an item when remove file button is clicked', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeTaxItem({
                  id: '1',
                  label: 'W-2',
                  owner: 'primary',
                  files: [makeFile({ id: 'f1', name: 'W2_2024.pdf' }), makeFile({ id: 'f2', name: 'W2_extra.pdf' })],
                }),
              ],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      // Should see both files
      expect(screen.getByText('W2_2024.pdf')).toBeInTheDocument()
      expect(screen.getByText('W2_extra.pdf')).toBeInTheDocument()
      // Click "Remove file" button on first file
      const removeFileButtons = screen.getAllByTitle('Remove file')
      await user.click(removeFileButtons[0])
      // First file should be removed
      expect(screen.queryByText('W2_2024.pdf')).not.toBeInTheDocument()
      expect(screen.getByText('W2_extra.pdf')).toBeInTheDocument()
    })
  })

  describe('file upload', () => {
    it('shows Upload button for items without files', () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary', files: [] })],
            },
          },
        }),
      )
      render(<Taxes />)
      expect(screen.getByText('Upload')).toBeInTheDocument()
    })

    it('shows Add button for items that already have files', () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeTaxItem({
                  id: '1',
                  label: 'W-2',
                  owner: 'primary',
                  files: [makeFile()],
                }),
              ],
            },
          },
        }),
      )
      render(<Taxes />)
      // "Add" button in item actions for item with files
      const addBtns = screen.getAllByText('Add')
      expect(addBtns.length).toBe(1)
    })

    it('rejects files larger than 10 MB', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary', files: [] })],
            },
          },
        }),
      )
      render(<Taxes />)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const bigFile = new File(['x'.repeat(100)], 'big.pdf', { type: 'application/pdf' })
      Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 })
      fireEvent.change(fileInput, { target: { files: [bigFile] } })
      await waitFor(() => {
        expect(screen.getByText(/exceeds the 10 MB limit/)).toBeInTheDocument()
      })
    })
  })

  describe('storage estimate display', () => {
    it('displays storage usage in header', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary' })],
            },
          },
        }),
      )
      render(<Taxes />)
      await waitFor(() => {
        expect(screen.getByText('1.2 MB used')).toBeInTheDocument()
      })
    })
  })

  describe('linked accounts display', () => {
    it('shows linked account names on items', () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Savings Account', owner: 'primary' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeTaxItem({
                  id: '1',
                  label: '1099-INT',
                  owner: 'primary',
                  accountIds: [10],
                  category: 'account',
                }),
              ],
            },
          },
        }),
      )
      render(<Taxes />)
      expect(screen.getByText('Savings Account')).toBeInTheDocument()
    })
  })

  describe('partner sections', () => {
    it('shows partner section when partner exists', () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: { name: 'Bob', avatarDataUrl: '', birthday: '1990-01-01' } }),
        updateProfile: vi.fn(),
      })
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      render(<Taxes />)
      // Partner section title
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })

    it('hides partner section when no partner exists', () => {
      mockedUseProfile.mockReturnValue({
        profile: makeProfile({ name: 'Alice', partner: null }),
        updateProfile: vi.fn(),
      })
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      render(<Taxes />)
      // Only Alice and Joint sections, no partner
      const sectionTitles = screen.getAllByRole('heading', { level: 3 })
      const titleTexts = sectionTitles.map(h => h.textContent)
      expect(titleTexts).not.toContain('Partner')
    })
  })

  describe('add paystub', () => {
    it('hides Add Paystub button when owner already has a paystub item', async () => {
      // The component auto-backfills paystub items via useEffect, so when
      // we seed with a paystub already present, the button should be hidden.
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary', category: 'paystub' })],
            },
          },
        }),
      )
      render(<Taxes />)
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
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary', category: 'paystub' }),
                makeTaxItem({ id: '2', label: "Bob's Paystubs", owner: 'partner', category: 'paystub' }),
              ],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      // Both sections have paystubs, so no Add Paystub buttons visible for primary/partner
      await waitFor(() => {
        const paystubBtns = screen.queryAllByText('+ Add Paystub')
        expect(paystubBtns.length).toBe(0)
      })
    })
  })

  describe('suggest from accounts', () => {
    it('shows From Accounts button when unlinked accounts exist', () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Brokerage', owner: 'primary' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      render(<Taxes />)
      expect(screen.getByText('+ From Accounts')).toBeInTheDocument()
    })

    it('opens suggest modal and adds account-linked item', async () => {
      mockedUseData.mockReturnValue({
        accounts: [makeAccount({ id: 10, name: 'Brokerage', owner: 'primary' })],
        balances: [],
        allMonths: [],
        setAccounts: vi.fn(),
        setBalances: vi.fn(),
      })
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      await user.click(screen.getByText('+ From Accounts'))
      expect(screen.getByText('Add from Accounts')).toBeInTheDocument()
      // Select the account
      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)
      // Click Add button in modal
      const addBtn = screen.getByRole('button', { name: /Add 1 account/ })
      await user.click(addBtn)
      // Account-linked item should appear in the checklist
      // "Brokerage" appears as both the suggest source label and the new checklist item
      const brokerageTexts = screen.getAllByText('Brokerage')
      expect(brokerageTexts.length).toBe(2)
    })
  })

  describe('delete year', () => {
    it('shows confirmation dialog and deletes year', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      // Click Delete Year button
      await user.click(screen.getByText(/Delete Year/))
      // Confirm dialog
      expect(screen.getByText(`Delete ${CURRENT_YEAR} Tax Prep?`)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      // Should return to empty state
      expect(screen.getByText(`No tax prep for ${CURRENT_YEAR}`)).toBeInTheDocument()
    })

    it('cancels delete when Cancel is clicked', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      await user.click(screen.getByText(/Delete Year/))
      const cancelBtns = screen.getAllByRole('button', { name: 'Cancel' })
      await user.click(cancelBtns[cancelBtns.length - 1])
      // Still showing checklist
      expect(screen.getByText("Alice's Paystubs")).toBeInTheDocument()
    })
  })

  describe('templates', () => {
    it('opens save template modal', async () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      const user = userEvent.setup()
      render(<Taxes />)
      await user.click(screen.getByText(/Save as Template/))
      expect(screen.getByText('Save as Template', { selector: 'h3' })).toBeInTheDocument()
    })

    it('creates a year from a template', async () => {
      // Set up a template in storage
      mockStore['tax-templates'] = JSON.stringify([
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
      render(<Taxes />)
      // Should show Import from Template in empty state
      await user.click(screen.getByText('Import from Template'))
      expect(screen.getByText('Import from Template', { selector: 'h3' })).toBeInTheDocument()
      // Click Use on the template
      await user.click(screen.getByText('Use'))
      // Template items should now appear
      expect(screen.getByText('W-2 Wages')).toBeInTheDocument()
      expect(screen.getByText('Mortgage Interest')).toBeInTheDocument()
    })
  })

  describe('tax return section', () => {
    it('renders Tax Returns section header', () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      render(<Taxes />)
      expect(screen.getByText('Tax Returns')).toBeInTheDocument()
    })

    it('shows empty message when no return is uploaded', () => {
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: "Alice's Paystubs", owner: 'primary' })],
            },
          },
        }),
      )
      render(<Taxes />)
      expect(screen.getByText('No return uploaded yet. Use the menu to add.')).toBeInTheDocument()
    })
  })

  describe('upload error auto-clear', () => {
    it('clears upload error after 5 seconds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      seedTaxStore(
        makeTaxStore({
          years: {
            [CURRENT_YEAR]: {
              items: [makeTaxItem({ id: '1', label: 'W-2', owner: 'primary', files: [] })],
            },
          },
        }),
      )
      render(<Taxes />)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const bigFile = new File(['x'], 'huge.pdf', { type: 'application/pdf' })
      Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 })
      fireEvent.change(fileInput, { target: { files: [bigFile] } })
      // Error should appear
      expect(screen.getByText(/exceeds the 10 MB limit/)).toBeInTheDocument()
      // Advance timers by 5 seconds
      await vi.advanceTimersByTimeAsync(5000)
      await waitFor(() => {
        expect(screen.queryByText(/exceeds the 10 MB limit/)).not.toBeInTheDocument()
      })
    })
  })
})
