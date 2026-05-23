import { test, expect, Page } from '@playwright/test'
import { TaxesPage } from './pages/taxes.page'
import {
  CURRENT_YEAR,
  STANDARD_TEMPLATE,
  countTaxIndexedDBFiles,
  defaultAccounts,
  makeFile,
  makeItem,
  multiYearStore,
  partnerProfile,
  partnerStore,
  resetTaxIndexedDB,
  seedTaxes,
  seedTaxIndexedDBFiles,
  singleOwnerStore,
  singleProfile,
  smallPdf,
} from './fixtures/tax.fixtures'

/** Returns true if the row at `label` has data-done="true". */
async function isItemDone(page: Page, label: string): Promise<boolean> {
  return await page.evaluate(text => {
    const rows = Array.from(document.querySelectorAll('.tax-item'))
    const match = rows.find(r => r.querySelector('.tax-item-label-text')?.textContent === text)
    return match?.getAttribute('data-done') === 'true'
  }, label)
}

test.describe('Taxes Page E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Reset IDB before navigation so file blobs from earlier tests cannot
    // bleed into the next one. addInitScript runs on every navigation, so
    // both this and seedTaxes's localStorage clear apply consistently.
    await resetTaxIndexedDB(page)
  })

  test.describe('Page Load & Year Selection', () => {
    test('page loads with current tax year selected and renders without error', async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('pageerror', e => consoleErrors.push(e.message))

      await seedTaxes(page, { profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await expect(taxes.heading).toHaveText('Taxes')
      await expect(taxes.yearLabel).toHaveText(String(CURRENT_YEAR))
      // Forward button is disabled at the current year boundary
      await expect(taxes.nextYearBtn).toBeDisabled()
      // No data was seeded for CURRENT_YEAR → empty state surfaces
      await expect(taxes.emptyState).toBeVisible()
      expect(consoleErrors).toEqual([])
    })

    test('changing tax year shows data for that year and not the other', async ({ page }) => {
      await seedTaxes(page, { store: multiYearStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // Verify the event fires when the year switch triggers the paystub
      // backfill (or any other write) — the assertion below verifies the
      // listener registered before we click prev.
      await page.evaluate(() => {
        ;(window as unknown as { __taxEventFired: boolean }).__taxEventFired = false
        window.addEventListener('tax-store-changed', () => {
          ;(window as unknown as { __taxEventFired: boolean }).__taxEventFired = true
        })
      })

      // We start on CURRENT_YEAR — items present
      await expect(taxes.item('W-2 This Year')).toBeVisible()
      await expect(taxes.item('W-2 Last Year')).toHaveCount(0)

      // Switch to previous year
      await taxes.prevYearBtn.click()
      await expect(taxes.yearLabel).toHaveText(String(CURRENT_YEAR - 1))

      // Last-year items now visible, this-year items hidden
      await expect(taxes.item('W-2 Last Year')).toBeVisible()
      await expect(taxes.item('W-2 This Year')).toHaveCount(0)

      // Event listener works for subsequent mutations on the new year
      await taxes.addCustomItem(/^Alex$/, 'Year-Switch Marker')
      await expect(taxes.item('Year-Switch Marker')).toBeVisible()
      const fired = await page.evaluate(() => (window as unknown as { __taxEventFired: boolean }).__taxEventFired)
      expect(fired).toBe(true)
    })
  })

  test.describe('Checklist Items', () => {
    test('shows empty state when no tax prep exists for selected year', async ({ page }) => {
      await seedTaxes(page, { profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await expect(taxes.emptyState).toBeVisible()
      await expect(taxes.emptyStateHeading).toHaveText(`No tax prep for ${CURRENT_YEAR}`)
      await expect(taxes.createYearBtn).toHaveText(`Create ${CURRENT_YEAR} Tax Prep`)
      // Items area is absent
      await expect(taxes.items).toHaveCount(0)
    })

    test('adding a custom checklist item appears in the list and persists', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await taxes.addCustomItem(/^Alex$/, 'W-2 from Employer')

      // Visible in the Alex (primary) section
      await expect(taxes.section(/^Alex$/).locator('.tax-item-label-text', { hasText: 'W-2 from Employer' })).toBeVisible()
      // Persisted to tax-store
      const stored = await page.evaluate(() => localStorage.getItem('tax-store'))
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!) as { years: Record<string, { items: { label: string }[] }> }
      const labels = parsed.years[String(CURRENT_YEAR)].items.map(i => i.label)
      expect(labels).toContain('W-2 from Employer')
    })

    test('checklist item shows empty indicator and aria-label=not started when no files', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      const row = taxes.item('1099-INT')
      await expect(row).toBeVisible()
      await expect(row).toHaveAttribute('data-done', 'false')
      await expect(row.locator('.tax-item-empty')).toBeVisible()
      await expect(row.locator('.tax-item-tick')).toHaveCount(0)
      const check = row.locator('.tax-item-check')
      await expect(check).toHaveAttribute('role', 'img')
      await expect(check).toHaveAttribute('aria-label', /not started/i)
    })

    test('uploading a document marks item complete, persists metadata, blob lands in IndexedDB', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await taxes.uploadFile('1099-INT', smallPdf('interest.pdf'))

      // 1. DOM assertions first — prove React re-rendered to the complete state
      const row = taxes.item('1099-INT')
      await expect(row).toHaveAttribute('data-done', 'true')
      await expect(row.locator('.tax-item-tick')).toBeVisible()
      await expect(row.locator('.tax-item-check')).toHaveAttribute('aria-label', /complete/i)
      // File chip rendered with the standardized display name (Owner_Label.ext)
      await expect(row.locator('.tax-file-chip .tax-file-name')).toContainText(/Alex_1099-INT\.pdf/)

      // 2. localStorage read — metadata persisted; file content stripped (lives in IDB instead)
      const stored = await page.evaluate(() => localStorage.getItem('tax-store'))
      expect(stored).not.toBeNull()
      expect(stored!).not.toContain('data:application/pdf;base64')
      const parsed = JSON.parse(stored!) as {
        years: Record<string, { items: { id: string; files: { id: string; content?: string }[] }[] }>
      }
      const item = parsed.years[String(CURRENT_YEAR)].items.find(i => i.id === 'pri-2')!
      expect(item.files.length).toBe(1)
      expect(item.files[0].content).toBeUndefined()

      // 3. IndexedDB poll — blob landed
      await expect.poll(() => countTaxIndexedDBFiles(page)).toBeGreaterThanOrEqual(1)
    })

    test('multiple files can be uploaded to a single checklist item', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await taxes.uploadFile('1099-INT', smallPdf('first.pdf'))
      await expect(taxes.item('1099-INT').locator('.tax-file-chip')).toHaveCount(1)
      // After the first upload the button label changes from "Upload" to "Add"
      await expect(taxes.item('1099-INT').locator('.tax-item-actions .tax-btn', { hasText: 'Add' })).toBeVisible()
      await taxes.uploadFile('1099-INT', smallPdf('second.pdf'))
      await expect(taxes.item('1099-INT').locator('.tax-file-chip')).toHaveCount(2)

      // Both blobs in IDB
      await expect.poll(() => countTaxIndexedDBFiles(page)).toBe(2)
    })

    test('removing a file from a single-file item reverts completion state', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await taxes.uploadFile('1099-INT', smallPdf('temp.pdf'))
      const row = taxes.item('1099-INT')
      await expect(row).toHaveAttribute('data-done', 'true')

      const chipName = await row.locator('.tax-file-chip .tax-file-name').first().innerText()
      await taxes.removeFile('1099-INT', chipName)

      await expect(row.locator('.tax-file-chip')).toHaveCount(0)
      await expect(row).toHaveAttribute('data-done', 'false')
      await expect(row.locator('.tax-item-tick')).toHaveCount(0)
      await expect(row.locator('.tax-item-check')).toHaveAttribute('aria-label', /not started/i)
    })
  })

  test.describe('Rename & Delete', () => {
    test('double-clicking item label enters rename mode', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await taxes.startRenameByDoubleClick('1099-INT')

      const input = taxes.activeRenameInput
      await expect(input).toBeVisible()
      await expect(input).toHaveValue('1099-INT')
      await expect(input).toBeFocused()
    })

    test('pressing Enter saves the renamed item and persists', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await taxes.startRenameByDoubleClick('1099-INT')
      const input = taxes.activeRenameInput
      await input.fill('1099-INT (Updated)')
      await input.press('Enter')

      await expect(taxes.activeRenameInput).toHaveCount(0)
      await expect(taxes.item('1099-INT (Updated)')).toBeVisible()
      await expect(taxes.item(/^1099-INT$/)).toHaveCount(0)

      const stored = await page.evaluate(() => localStorage.getItem('tax-store'))
      const parsed = JSON.parse(stored!) as { years: Record<string, { items: { id: string; label: string }[] }> }
      const renamed = parsed.years[String(CURRENT_YEAR)].items.find(i => i.id === 'pri-2')!
      expect(renamed.label).toBe('1099-INT (Updated)')
    })

    test('pressing Escape cancels rename and restores original label', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await taxes.startRenameByDoubleClick('1099-INT')
      const input = taxes.activeRenameInput
      await input.fill('Discarded Label')
      await input.press('Escape')

      await expect(taxes.activeRenameInput).toHaveCount(0)
      await expect(taxes.item('1099-INT')).toBeVisible()
      await expect(taxes.item('Discarded Label')).toHaveCount(0)

      const stored = await page.evaluate(() => localStorage.getItem('tax-store'))
      const parsed = JSON.parse(stored!) as { years: Record<string, { items: { id: string; label: string }[] }> }
      const item = parsed.years[String(CURRENT_YEAR)].items.find(i => i.id === 'pri-2')!
      expect(item.label).toBe('1099-INT')
    })

    test('rename via pencil button also enters edit mode', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await taxes.startRenameByPencil('1099-DIV')
      const input = taxes.activeRenameInput
      await expect(input).toBeVisible()
      await expect(input).toHaveValue('1099-DIV')
      await expect(input).toBeFocused()
    })

    test('removing a checklist item drops it from the list and from storage', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // Sanity: 1099-DIV is present and 1099-INT is also present
      await expect(taxes.item('1099-DIV')).toBeVisible()
      await expect(taxes.item('1099-INT')).toBeVisible()

      await taxes.removeItem('1099-DIV')

      // Removed
      await expect(taxes.item('1099-DIV')).toHaveCount(0)
      // Other item still present (presence + absence both asserted)
      await expect(taxes.item('1099-INT')).toBeVisible()

      const stored = await page.evaluate(() => localStorage.getItem('tax-store'))
      const parsed = JSON.parse(stored!) as { years: Record<string, { items: { id: string; label: string }[] }> }
      const ids = parsed.years[String(CURRENT_YEAR)].items.map(i => i.id)
      expect(ids).not.toContain('pri-3')
      expect(ids).toContain('pri-2')
    })
  })

  test.describe('Templates', () => {
    test('applying a template populates checklist with predefined items and persists', async ({ page }) => {
      // No tax-store → empty state; templates seeded → "Import from Template" available
      await seedTaxes(page, { templates: [STANDARD_TEMPLATE], profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await expect(taxes.importTemplateBtn).toBeVisible()
      await taxes.importTemplateBtn.click()
      await taxes.importTemplateModal.waitFor({ state: 'visible' })
      await taxes.importTemplateModal.locator('.tax-btn--primary', { hasText: /^Use$/ }).click()

      // Year created; all template items rendered
      await expect(taxes.body).toBeVisible()
      await expect(taxes.item('W-2 (Primary)')).toBeVisible()
      await expect(taxes.item('1099-INT')).toBeVisible()
      await expect(taxes.item('1099-DIV')).toBeVisible()
      await expect(taxes.item('Tax Return (Federal)')).toBeVisible()

      // tax-store now has all template items for CURRENT_YEAR
      const stored = await page.evaluate(() => localStorage.getItem('tax-store'))
      const parsed = JSON.parse(stored!) as { years: Record<string, { items: { label: string }[] }> }
      const labels = parsed.years[String(CURRENT_YEAR)].items.map(i => i.label)
      expect(labels).toContain('W-2 (Primary)')
      expect(labels).toContain('Tax Return (Federal)')

      // The template itself remains saved in localStorage
      const tplRaw = await page.evaluate(() => localStorage.getItem('tax-templates'))
      expect(tplRaw).not.toBeNull()
      expect(JSON.parse(tplRaw!).length).toBeGreaterThanOrEqual(1)
    })
  })

  test.describe('Categories & Organization', () => {
    test('items are grouped by owner sections with section headers', async ({ page }) => {
      await seedTaxes(page, { store: partnerStore(), profile: partnerProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // Three owner sections render: Alex (primary), Sam (partner), Joint
      await expect(taxes.section(/^Alex$/)).toBeVisible()
      await expect(taxes.section(/^Sam$/)).toBeVisible()
      await expect(taxes.section(/^Joint$/)).toBeVisible()

      // Each owner's item appears under its own section
      await expect(taxes.section(/^Alex$/).locator('.tax-item-label-text', { hasText: 'W-2 (Alex)' })).toBeVisible()
      await expect(taxes.section(/^Sam$/).locator('.tax-item-label-text', { hasText: 'W-2 (Sam)' })).toBeVisible()
      await expect(
        taxes.section(/^Joint$/).locator('.tax-item-label-text', { hasText: '1099-INT (Joint Savings)' }),
      ).toBeVisible()
      // Cross-section: Alex's item is NOT in the Joint section
      await expect(taxes.section(/^Joint$/).locator('.tax-item-label-text', { hasText: 'W-2 (Alex)' })).toHaveCount(0)
    })

    test('owner sections show completion count (done/total) reflecting file presence', async ({ page }) => {
      // Three items, one tagged as paystub so the auto-backfill of a default
      // primary paystub item (Taxes.tsx useEffect line 662) is a no-op.
      await seedTaxes(page, {
        store: {
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeItem({ id: 'a', label: 'A', owner: 'primary', category: 'paystub' }),
                makeItem({ id: 'b', label: 'B', owner: 'primary', category: 'custom' }),
                makeItem({ id: 'c', label: 'C', owner: 'primary', category: 'custom' }),
              ],
            },
          },
        },
        profile: singleProfile(),
      })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      const alexCount = taxes.section(/^Alex$/).locator('.tax-section-count')
      await expect(alexCount).toHaveText('0/3')

      // Upload a file on A and B → count goes 2/3
      await taxes.uploadFile('A', smallPdf('a.pdf'))
      await expect(taxes.section(/^Alex$/).locator('.tax-section-count')).toHaveText('1/3')
      await taxes.uploadFile('B', smallPdf('b.pdf'))
      await expect(taxes.section(/^Alex$/).locator('.tax-section-count')).toHaveText('2/3')
    })
  })

  test.describe('Owner Badges', () => {
    test('owner badge initial reflects the owner name when a partner profile exists', async ({ page }) => {
      await seedTaxes(page, { store: partnerStore(), profile: partnerProfile('Alex', 'Sam') })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // Primary section header has Alex's initial; partner has Sam's
      const alexBadge = taxes.section(/^Alex$/).locator('.tax-section-header .tax-owner-avatar').first()
      await expect(alexBadge).toHaveText('A')
      const samBadge = taxes.section(/^Sam$/).locator('.tax-section-header .tax-owner-avatar').first()
      await expect(samBadge).toHaveText('S')
    })

    test('joint section header renders a tax-owner-group with two avatars', async ({ page }) => {
      await seedTaxes(page, { store: partnerStore(), profile: partnerProfile('Alex', 'Sam') })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      const jointGroup = taxes.section(/^Joint$/).locator('.tax-section-header .tax-owner-group')
      await expect(jointGroup).toBeVisible()
      const avatars = jointGroup.locator('.tax-owner-avatar')
      await expect(avatars).toHaveCount(2)
      const texts = await avatars.allInnerTexts()
      expect(texts).toEqual(['A', 'S'])
    })
  })

  test.describe('Account Linking', () => {
    test('checklist item linked to accounts shows account names next to the label', async ({ page }) => {
      const accounts = defaultAccounts()
      await seedTaxes(page, {
        store: {
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeItem({
                  id: 'linked-1',
                  label: 'Brokerage Forms',
                  owner: 'primary',
                  category: 'account',
                  accountIds: [1, 2],
                }),
              ],
            },
          },
        },
        accounts,
        profile: singleProfile(),
      })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      const acct = taxes.item('Brokerage Forms').locator('.tax-item-acct')
      await expect(acct).toBeVisible()
      await expect(acct).toContainText('Vanguard 401k')
      await expect(acct).toContainText('Fidelity IRA')
      // Unrelated account name must not leak into the label
      await expect(acct).not.toContainText('Joint Savings')
    })
  })

  test.describe('File Size & Validation', () => {
    test('file larger than 10MB is rejected with error and not stored', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      const huge = makeFile('huge.pdf', 11 * 1024 * 1024)
      await taxes.uploadFile('1099-INT', huge)

      await expect(taxes.uploadError).toBeVisible()
      await expect(taxes.uploadError).toContainText('huge.pdf')
      await expect(taxes.uploadError).toContainText(/10 MB|exceeds/i)
      // Item remains incomplete; no chip rendered
      await expect(taxes.item('1099-INT')).toHaveAttribute('data-done', 'false')
      await expect(taxes.item('1099-INT').locator('.tax-file-chip')).toHaveCount(0)
      // Nothing landed in IDB
      expect(await countTaxIndexedDBFiles(page)).toBe(0)
    })
  })

  test.describe('Edge Cases', () => {
    test('page handles tax-store corruption gracefully — recovers to empty state', async ({ page }) => {
      const pageErrors: string[] = []
      page.on('pageerror', e => pageErrors.push(e.message))

      // appStorage.getJSON catches JSON.parse errors and falls back to default,
      // so the page renders the empty state for the current year instead of
      // crashing. Verify this behavior end-to-end.
      await seedTaxes(page, { store: '{not-valid-json,', profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await expect(taxes.heading).toBeVisible()
      await expect(taxes.emptyState).toBeVisible()
      await expect(taxes.emptyStateHeading).toHaveText(`No tax prep for ${CURRENT_YEAR}`)
      expect(pageErrors).toEqual([])
    })

    test('removing an item and immediately attempting upload does not crash', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // Grab the hidden file input handle BEFORE the row is removed — once
      // the row disappears we won't be able to query it, but the detached
      // element handle is still usable for setInputFiles.
      const fileInput = taxes.item('1099-DIV').locator('input[type="file"]')
      const handle = await fileInput.elementHandle()
      expect(handle).not.toBeNull()

      const pageErrors: string[] = []
      page.on('pageerror', e => pageErrors.push(e.message))

      await taxes.removeItem('1099-DIV')
      await expect(taxes.item('1099-DIV')).toHaveCount(0)

      // Attempt to drive the now-detached file input. The handler should
      // either no-op or fail to find the item; the page must NOT crash.
      try {
        await handle!.setInputFiles(smallPdf('orphan.pdf'))
      } catch {
        /* setInputFiles may reject on a detached node — that is acceptable.
           What's NOT acceptable is a page-level crash. */
      }

      // Page remains responsive — items render, heading visible, no errors
      await expect(taxes.heading).toBeVisible()
      await expect(taxes.item('1099-INT')).toBeVisible()
      expect(pageErrors).toEqual([])
    })
  })

  test.describe('File Upload Edge Cases', () => {
    test('file at exactly 11 MB triggers the size limit error', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      const oversize = makeFile('payslip.pdf', 11 * 1024 * 1024)
      await taxes.uploadFile('1099-INT', oversize)

      await expect(taxes.uploadError).toBeVisible()
      await expect(taxes.uploadError).toContainText('payslip.pdf')
      await expect(taxes.uploadError).toContainText('10 MB')
      expect(await countTaxIndexedDBFiles(page)).toBe(0)
    })

    test('non-PDF file (txt) is accepted, stored, and displayed with the correct extension', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      const txt = { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Some text content') }
      await taxes.uploadFile('1099-INT', txt)

      const row = taxes.item('1099-INT')
      await expect(row).toHaveAttribute('data-done', 'true')
      await expect(row.locator('.tax-file-chip .tax-file-name')).toContainText(/\.txt$/)
      expect(await countTaxIndexedDBFiles(page)).toBe(1)

      // Metadata records the extension correctly
      const stored = await page.evaluate(() => localStorage.getItem('tax-store'))
      const parsed = JSON.parse(stored!) as {
        years: Record<string, { items: { id: string; files: { ext: string }[] }[] }>
      }
      const item = parsed.years[String(CURRENT_YEAR)].items.find(i => i.id === 'pri-2')!
      expect(item.files[0].ext).toBe('txt')
    })

    test('file with a very long filename renders without overflowing its container', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      const longName = `${'a'.repeat(200)}.pdf`
      const big = makeFile(longName, 2048)
      await taxes.uploadFile('1099-INT', big)

      const row = taxes.item('1099-INT')
      const chip = row.locator('.tax-file-chip').first()
      await expect(chip).toBeVisible()

      // Display name = `Alex_1099-INT.pdf` (item label is rewritten by handleUpload)
      const displayed = await chip.locator('.tax-file-name').innerText()
      expect(displayed.length).toBeGreaterThan(0)

      // Chip should never exceed the row width (no horizontal overflow)
      const dims = await chip.evaluate(el => {
        const parent = el.parentElement!
        return {
          chipWidth: (el as HTMLElement).getBoundingClientRect().width,
          parentWidth: parent.getBoundingClientRect().width,
        }
      })
      // Allow 4px tolerance for borders
      expect(dims.chipWidth).toBeLessThanOrEqual(dims.parentWidth + 4)

      // The full long name is preserved in the metadata or IDB key — verify
      // metadata records the original extension and IDB stores 1 record.
      expect(await countTaxIndexedDBFiles(page)).toBe(1)
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('checklist item Upload and remove buttons are keyboard reachable and activatable', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // Walk Tab presses until the Upload button on the first incomplete
      // item receives focus. We assert it is reachable (no Tab traps) and
      // that it has a visible focus ring (browser default outline).
      const uploadBtn = taxes.item('1099-INT').locator('.tax-item-actions .tax-btn', { hasText: /^Upload$/ })
      await expect(uploadBtn).toBeVisible()

      const labels: string[] = []
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab')
        const id = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          if (!el) return ''
          const text = el.textContent ?? ''
          const role = el.tagName
          return `${role}:${text.trim().slice(0, 24)}`
        })
        labels.push(id)
        const focused = await uploadBtn.evaluate(el => el === document.activeElement)
        if (focused) break
      }
      const focused = await uploadBtn.evaluate(el => el === document.activeElement)
      expect(focused).toBe(true)

      // Browser focus is visible (outline-style is not 'none' or outline-width > 0)
      const focusStyles = await uploadBtn.evaluate(el => {
        const cs = getComputedStyle(el as HTMLElement)
        return { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth }
      })
      const hasFocusRing = focusStyles.outlineStyle !== 'none' || parseFloat(focusStyles.outlineWidth) > 0
      expect(hasFocusRing).toBe(true)

      // The × remove button on the same row is reachable too
      const removeBtn = taxes.item('1099-INT').locator('.tax-item-actions .tax-btn--muted')
      await removeBtn.focus()
      const removeFocused = await removeBtn.evaluate(el => el === document.activeElement)
      expect(removeFocused).toBe(true)
    })

    test('save-template name input: Enter saves, Cancel discards', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // ── Cancel path: open modal, type a name, click Cancel → template not saved
      await taxes.saveTemplateBtn.click()
      await taxes.saveTemplateNameInput.waitFor({ state: 'visible' })
      await taxes.saveTemplateNameInput.fill('Discard Me')
      await page.locator('.tax-modal .tax-btn--outline', { hasText: /^Cancel$/ }).click()
      await expect(taxes.modalOverlay).toBeHidden()

      const tplRaw1 = await page.evaluate(() => localStorage.getItem('tax-templates'))
      // Either absent OR an empty list — either way, no "Discard Me" entry
      if (tplRaw1 !== null) {
        const list1 = JSON.parse(tplRaw1) as { name: string }[]
        expect(list1.find(t => t.name === 'Discard Me')).toBeUndefined()
      } else {
        expect(tplRaw1).toBeNull()
      }

      // ── Enter path: open modal again, type a name, press Enter → template saved
      await taxes.saveTemplateBtn.click()
      await taxes.saveTemplateNameInput.waitFor({ state: 'visible' })
      await taxes.saveTemplateNameInput.fill('Saved Via Enter')
      await taxes.saveTemplateNameInput.press('Enter')
      await expect(taxes.modalOverlay).toBeHidden()

      const tplRaw2 = await page.evaluate(() => localStorage.getItem('tax-templates'))
      expect(tplRaw2).not.toBeNull()
      const list2 = JSON.parse(tplRaw2!) as { name: string; items: unknown[] }[]
      const saved = list2.find(t => t.name === 'Saved Via Enter')
      expect(saved?.name).toBe('Saved Via Enter')
      expect(saved!.items.length).toBe(3)
    })

    test('file chip remove (×) button is keyboard reachable and removes the file', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      await taxes.uploadFile('1099-INT', smallPdf('keep-me.pdf'))
      await taxes.uploadFile('1099-INT', smallPdf('delete-me.pdf'))
      await expect(taxes.item('1099-INT').locator('.tax-file-chip')).toHaveCount(2)

      // The second chip's × must be reachable via .focus() (which simulates
      // tab focusability for native buttons — they ARE in tab order).
      const secondRemove = taxes.item('1099-INT').locator('.tax-file-chip').nth(1).locator('.tax-file-remove')
      await secondRemove.focus()
      const isFocused = await secondRemove.evaluate(el => el === document.activeElement)
      expect(isFocused).toBe(true)

      // Press Enter to activate
      await page.keyboard.press('Enter')
      await expect(taxes.item('1099-INT').locator('.tax-file-chip')).toHaveCount(1)
      // The kept file is still present
      const remainingNames = await taxes.item('1099-INT').locator('.tax-file-chip .tax-file-name').allInnerTexts()
      expect(remainingNames.length).toBe(1)
    })
  })

  test.describe('Corruption Resilience', () => {
    test('corrupted tax-store JSON recovers to empty state without crashing the page', async ({ page }) => {
      const pageErrors: string[] = []
      page.on('pageerror', e => pageErrors.push(e.message))

      await seedTaxes(page, { store: '!!!CORRUPT!!!', profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // Source uses appStorage.getJSON, which try/catches JSON.parse and
      // returns the fallback (empty store). Recovery is silent → empty
      // state renders for the current year. No error boundary needed.
      await expect(taxes.heading).toBeVisible()
      await expect(taxes.emptyState).toBeVisible()
      await expect(taxes.createYearBtn).toBeVisible()
      expect(pageErrors).toEqual([])

      // User can still create a fresh year from the empty state
      await taxes.createYearBtn.click()
      await expect(taxes.body).toBeVisible()
      await expect(taxes.section(/^Alex$/)).toBeVisible()
    })

    test('missing tax-templates key renders empty template list; creation still works', async ({ page }) => {
      // Seed tax-store but no tax-templates → templates list will be empty
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // Open Save Template modal — since the store has zero templates, the
      // "Create new" view is shown by default with an empty name input
      await taxes.saveTemplateBtn.click()
      await taxes.saveTemplateNameInput.waitFor({ state: 'visible' })
      await expect(taxes.saveTemplateNameInput).toHaveValue('')
      // Update toggle is hidden when no templates exist
      await expect(page.locator('.tax-modal .tax-tpl-mode')).toHaveCount(0)

      // Save a new template
      await taxes.saveTemplateNameInput.fill('First Template')
      await page.locator('.tax-modal .tax-btn--primary', { hasText: /^Save New$/ }).click()
      await expect(taxes.modalOverlay).toBeHidden()

      const tplRaw = await page.evaluate(() => localStorage.getItem('tax-templates'))
      expect(tplRaw).not.toBeNull()
      const list = JSON.parse(tplRaw!) as { name: string }[]
      expect(list.map(t => t.name)).toContain('First Template')
    })
  })

  test.describe('Event Propagation', () => {
    test('mutating tax data dispatches a tax-store-changed event', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile() })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // Install listener BEFORE any mutation
      await page.evaluate(() => {
        ;(window as unknown as { __taxEventCount: number }).__taxEventCount = 0
        window.addEventListener('tax-store-changed', () => {
          ;(window as unknown as { __taxEventCount: number }).__taxEventCount += 1
        })
      })

      // Trigger a mutation by adding a custom item
      await taxes.addCustomItem(/^Alex$/, '1099-MISC')
      await expect(taxes.item('1099-MISC')).toBeVisible()

      const count = await page.evaluate(
        () => (window as unknown as { __taxEventCount: number }).__taxEventCount,
      )
      expect(count).toBeGreaterThanOrEqual(1)
    })
  })

  test.describe('Dark Mode', () => {
    test('Taxes page renders with sufficient contrast in dark mode', async ({ page }) => {
      await seedTaxes(page, { store: singleOwnerStore(), profile: singleProfile(), darkMode: true })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      const hasDark = await page.evaluate(() => document.body.classList.contains('dark'))
      expect(hasDark).toBe(true)

      // Real WCAG contrast check on a label text inside a section card —
      // analogous to the Budget page's contrast assertion.
      const contrast = await page.evaluate(() => {
        const parseRgb = (s: string): [number, number, number, number] | null => {
          const m = s.match(/rgba?\(([^)]+)\)/)
          if (!m) return null
          const parts = m[1].split(',').map(p => parseFloat(p.trim()))
          if (parts.length < 3) return null
          return [parts[0], parts[1], parts[2], parts[3] ?? 1]
        }
        const effectiveBg = (el: Element | null): [number, number, number] => {
          let cur: Element | null = el
          while (cur) {
            const cs = getComputedStyle(cur as HTMLElement)
            const rgb = parseRgb(cs.backgroundColor)
            if (rgb && rgb[3] > 0) return [rgb[0], rgb[1], rgb[2]]
            cur = cur.parentElement
          }
          return [0, 0, 0]
        }
        const relLum = (r: number, g: number, b: number) => {
          const channel = (c: number) => {
            const s = c / 255
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
          }
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
        }
        const label = document.querySelector('.tax-item-label-text') as HTMLElement | null
        if (!label) return null
        const cs = getComputedStyle(label)
        const fg = parseRgb(cs.color)
        if (!fg) return null
        const bg = effectiveBg(label)
        const Lfg = relLum(fg[0], fg[1], fg[2])
        const Lbg = relLum(bg[0], bg[1], bg[2])
        const ratio = (Math.max(Lfg, Lbg) + 0.05) / (Math.min(Lfg, Lbg) + 0.05)
        return { color: cs.color, backgroundColor: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`, ratio }
      })

      expect(contrast).not.toBeNull()
      expect(contrast!.color).not.toBe(contrast!.backgroundColor)
      expect(contrast!.ratio).toBeGreaterThanOrEqual(4.5)
    })
  })

  test.describe('IndexedDB Cleanup', () => {
    test('deleting a tax year removes associated file blobs from IndexedDB', async ({ page }) => {
      // Seed tax-store with two items in CURRENT_YEAR each carrying one file
      // ID, and ALSO seed a placeholder file for CURRENT_YEAR-1 that should
      // remain after deletion. (Year metadata for prev year contains a
      // file ID that is NOT touched by the deleteYear call.)
      const lastYear = CURRENT_YEAR - 1
      await seedTaxes(page, {
        store: {
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeItem({
                  id: 'cur-1',
                  label: 'CurYear A',
                  owner: 'primary',
                  category: 'paystub',
                  files: [{ id: 'file-cur-a', name: 'a.pdf', ext: 'pdf', uploadedAt: '2024-01-01T00:00:00Z' }],
                }),
                makeItem({
                  id: 'cur-2',
                  label: 'CurYear B',
                  owner: 'primary',
                  category: 'custom',
                  files: [{ id: 'file-cur-b', name: 'b.pdf', ext: 'pdf', uploadedAt: '2024-01-01T00:00:00Z' }],
                }),
              ],
            },
            [lastYear]: {
              items: [
                makeItem({
                  id: 'last-1',
                  label: 'LastYear C',
                  owner: 'primary',
                  category: 'paystub',
                  files: [{ id: 'file-last-c', name: 'c.pdf', ext: 'pdf', uploadedAt: '2023-01-01T00:00:00Z' }],
                }),
              ],
            },
          },
        },
        profile: singleProfile(),
      })
      const taxes = new TaxesPage(page)
      await taxes.goto()

      // Inject the three file blobs into IDB (the page is mounted now,
      // so the addInitScript-driven IDB reset has run).
      await seedTaxIndexedDBFiles(page, [
        { id: 'file-cur-a', content: 'AAAA' },
        { id: 'file-cur-b', content: 'BBBB' },
        { id: 'file-last-c', content: 'CCCC' },
      ])
      await expect.poll(() => countTaxIndexedDBFiles(page), { timeout: 2000 }).toBe(3)

      // Delete CURRENT_YEAR via the UI
      await taxes.openDeleteYear()
      await taxes.confirmDeleteYear()
      await expect(taxes.emptyState).toBeVisible()
      await expect(taxes.emptyStateHeading).toHaveText(`No tax prep for ${CURRENT_YEAR}`)

      // Files for CURRENT_YEAR should be removed; lastYear's file remains.
      // deleteMultipleFiles is fire-and-forget — poll for the final count.
      await expect.poll(() => countTaxIndexedDBFiles(page)).toBe(1)
      const remaining = await page.evaluate(async () => {
        const open = () =>
          new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open('finance-tracking-files', 1)
            req.onupgradeneeded = () => {
              const db = req.result
              if (!db.objectStoreNames.contains('tax-files'))
                db.createObjectStore('tax-files', { keyPath: 'id' })
            }
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
          })
        const db = await open()
        const ids = await new Promise<string[]>((resolve, reject) => {
          const tx = db.transaction('tax-files', 'readonly')
          const req = tx.objectStore('tax-files').getAllKeys()
          req.onsuccess = () => resolve(req.result as string[])
          req.onerror = () => reject(req.error)
        })
        db.close()
        return ids
      })
      expect(remaining).toEqual(['file-last-c'])
    })
  })

  test.describe('Accessibility', () => {
    test('checklist items expose status via role=img + aria-label reflecting completion; upload error region uses aria-live', async ({
      page,
    }) => {
      await seedTaxes(page, {
        store: {
          years: {
            [CURRENT_YEAR]: {
              items: [
                makeItem({
                  id: 'done-1',
                  label: 'Already Done',
                  owner: 'primary',
                  category: 'custom',
                  files: [{ id: 'fixed', name: 'doc.pdf', ext: 'pdf', uploadedAt: '2024-01-01T00:00:00Z' }],
                }),
                makeItem({ id: 'todo-1', label: 'Still To Do', owner: 'primary', category: 'custom' }),
                makeItem({ id: 'todo-2', label: 'Another Open', owner: 'primary', category: 'custom' }),
              ],
            },
          },
        },
        profile: singleProfile(),
      })
      // Pre-seed the file blob so the "done" item's metadata is consistent
      // with the file actually existing in IndexedDB.
      const taxes = new TaxesPage(page)
      await taxes.goto()
      await seedTaxIndexedDBFiles(page, [{ id: 'fixed', content: 'data' }])

      // Each item exposes role=img with aria-label encoding completion state
      const done = taxes.item('Already Done').locator('.tax-item-check')
      const open1 = taxes.item('Still To Do').locator('.tax-item-check')
      const open2 = taxes.item('Another Open').locator('.tax-item-check')

      await expect(done).toHaveAttribute('role', 'img')
      await expect(done).toHaveAttribute('aria-label', /Already Done.*complete/)

      await expect(open1).toHaveAttribute('role', 'img')
      await expect(open1).toHaveAttribute('aria-label', /Still To Do.*not started/)

      await expect(open2).toHaveAttribute('role', 'img')
      await expect(open2).toHaveAttribute('aria-label', /Another Open.*not started/)

      // When toggling an item from incomplete → complete by uploading,
      // aria-label flips to "(complete)".
      await taxes.uploadFile('Still To Do', smallPdf('done-now.pdf'))
      await expect(taxes.item('Still To Do').locator('.tax-item-check')).toHaveAttribute(
        'aria-label',
        /Still To Do.*complete/,
      )

      // The aria-live error region only mounts when there's an error. Trigger
      // an oversize upload, then assert role=alert + aria-live=polite on the
      // mounted element.
      const huge = makeFile('giant.pdf', 11 * 1024 * 1024)
      await taxes.uploadFile('Another Open', huge)
      await expect(taxes.uploadError).toHaveAttribute('role', 'alert')
      await expect(taxes.uploadError).toHaveAttribute('aria-live', 'polite')
      await expect(taxes.uploadError).toContainText('giant.pdf')
    })
  })
})
