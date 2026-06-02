import { test, expect } from './fixtures/base'
import { NetWorthPage } from './pages/net-worth.page'
import {
  ACCOUNTS,
  INACTIVE_ACCOUNT,
  seedNetWorthData,
} from './fixtures/net-worth.fixtures'

const ALL_ACCOUNTS = [...ACCOUNTS, INACTIVE_ACCOUNT]

test.describe('AccountsModal — Journey 2 (Refactored Components)', () => {
  test('full journey: filter, sort, select, groups, rename, close', async ({ page }) => {
    await seedNetWorthData(page, { accounts: ALL_ACCOUNTS })
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.openAccountsModal()

    // Step 1: Verify modal opens
    await expect(nw.modal).toBeVisible()

    // Step 2: Verify account count (5 total — 4 active + 1 inactive visible in 'all' mode)
    const rows = nw.modal.locator('tbody tr')
    await expect(rows).toHaveCount(5)

    // Step 3: Filter by active → only 4 rows
    await nw.modal.locator('button.data-filter-btn', { hasText: 'Active' }).click()
    await expect(rows).toHaveCount(4)

    // Filter by inactive → only 1 row (Old Savings)
    await nw.modal.locator('button.data-filter-btn', { hasText: 'Inactive' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Old Savings')

    // Back to all
    await nw.modal.locator('button.data-filter-btn', { hasText: 'All' }).click()
    await expect(rows).toHaveCount(5)

    // Step 4: Sort by name — click sort button, verify order changes
    const sortNameBtn = nw.modal.locator('button.data-th-sort-btn', { hasText: 'Account' })
    await sortNameBtn.click()
    // After asc sort, first row should be "401(k)" (alphabetically first)
    const firstRowName = rows.first().locator('.data-account-name span').first()
    await expect(firstRowName).toHaveText('401(k)')

    // Step 5: Shift-click range select
    // Ctrl+click row 0 to select it, then Shift+click row 2 for range select
    const ctrlKey = process.platform === 'darwin' ? 'Meta' : 'Control'
    await rows.nth(0).click({ modifiers: [ctrlKey] })
    await rows.nth(2).click({ modifiers: ['Shift'] })
    // Should show bulk bar with "3 selected"
    const bulkCount = nw.modal.locator('.data-bulk-count')
    await expect(bulkCount).toContainText('3 selected')

    // Step 6: Switch to groups tab
    const groupsBtn = nw.modal.locator('button.data-groups-page-btn')
    await groupsBtn.click()
    // Verify group cards render (Retirement, Taxable, Cash)
    const groupCards = nw.modal.locator('.data-group-card')
    await expect(groupCards.first()).toBeVisible()
    await expect(groupCards).toHaveCount(3)

    // Step 7: Create a new group
    const newGroupBtn = nw.modal.locator('.data-group-add-btn')
    await newGroupBtn.click()
    const groupInput = nw.modal.locator('.data-group-rename-input')
    await groupInput.fill('New Test Group')
    await groupInput.press('Enter')
    await expect(
      nw.modal.locator('.data-group-card-name', { hasText: 'New Test Group' }),
    ).toBeVisible()
    // Now 4 groups total
    await expect(groupCards).toHaveCount(4)

    // Step 8: Rename a group (rename "Retirement" to "Retirement Funds")
    const retirementCard = nw.modal
      .locator('.data-group-card')
      .filter({ hasText: 'Retirement' })
      .first()
    const renameBtn = retirementCard.locator('.data-group-rename-btn')
    await renameBtn.click()
    const renameInput = retirementCard.locator('.data-group-rename-input')
    await renameInput.clear()
    await renameInput.fill('Retirement Funds')
    await renameInput.press('Enter')
    await expect(
      nw.modal.locator('.data-group-card-name', { hasText: 'Retirement Funds' }),
    ).toBeVisible()
    // Old name should be gone
    await expect(
      nw.modal.locator('.data-group-card-name', { hasText: /^Retirement$/ }),
    ).toHaveCount(0)

    // Step 9: Close modal — go back to accounts page, then close
    await nw.modal.locator('button.data-back-btn').click()
    await nw.modal.locator('button.data-modal-close').first().click()
    await expect(nw.modal).toBeHidden()
  })
})
