import { test, expect } from './fixtures/base'
import { NetWorthPage } from './pages/net-worth.page'
import {
  ACCOUNTS,
  BALANCES,
  INACTIVE_ACCOUNT,
  seedNetWorthData,
  seedEmptyState,
  seedCorruptedData,
  createLargeDataset,
} from './fixtures/net-worth.fixtures'

test.describe('Net Worth — Empty State', () => {
  test('displays empty state message when no accounts exist', async ({ page }) => {
    await seedEmptyState(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await expect(nw.emptyTitle).toHaveText('No accounts yet')
  })

  test('displays Add Account button in empty state', async ({ page }) => {
    await seedEmptyState(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await expect(nw.emptyAddBtn).toBeVisible()
  })
})

test.describe('Net Worth — Account Management', () => {
  test('opens AccountsModal when clicking View Accounts button', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.openAccountsModal()
    await expect(nw.modal).toBeVisible()
  })

  test('displays all seeded accounts in the modal', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.openAccountsModal()
    for (const account of ACCOUNTS) {
      await expect(nw.getAccountName(account.name)).toBeVisible()
    }
  })

  test('creates a new account via the form', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.openAccountsModal()
    await nw.addAccount('Test Checking', 'Chase')
    await expect(nw.getAccountName('Test Checking')).toBeVisible()
  })

  test('edits an existing account name', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.openAccountsModal()
    await nw.getEditBtn(0).click()
    await nw.accountNameInput.waitFor({ state: 'visible' })
    await nw.accountNameInput.clear()
    await nw.accountNameInput.fill('Updated 401(k)')
    await nw.formSaveBtn.click()
    await expect(nw.getAccountName('Updated 401(k)')).toBeVisible()
  })

  test('deletes an account from the modal', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.openAccountsModal()
    await expect(nw.getAccountName('High-Yield Savings')).toBeVisible()
    await nw.getDeleteBtn(3).click()
    await expect(nw.getAccountName('High-Yield Savings')).not.toBeVisible()
  })
})

test.describe('Net Worth — Balance Entry', () => {
  test('shows inline entry row when Add Entry is clicked', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.spreadsheetTab.click()
    await nw.addEntryBtn.click()
    await expect(nw.inlineMonthInput).toBeVisible()
  })

  test('saves a new balance entry via inline form', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.spreadsheetTab.click()
    await nw.addEntryBtn.click()
    await nw.getInlineBalanceInput(0).fill('200000')
    await nw.inlineSaveBtn.click()
    await expect(nw.inlineMonthInput).not.toBeVisible()
    // Verify saved value appears in spreadsheet
    await expect(nw.spreadsheetWrap).toContainText('200,000')
  })

  test('copies balances from last month when Copy Last Month is clicked', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.spreadsheetTab.click()
    await nw.copyLastMonthBtn.click()
    await expect(nw.inlineMonthInput).toBeVisible()
    // Verify inputs are pre-filled (non-empty)
    const firstInput = nw.getInlineBalanceInput(0)
    await expect(firstInput).not.toHaveValue('')
  })

  test('deletes a month row from the spreadsheet', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.spreadsheetTab.click()
    const monthLabels = page.locator('.data-spreadsheet-month-label')
    const initialCount = await monthLabels.count()
    // Delete button is hidden until row header is hovered
    const firstRowHeader = page.locator('.data-spreadsheet-row-header').first()
    await firstRowHeader.hover()
    await nw.deleteRowBtns.first().click()
    const confirmBtn = page.locator('button', { hasText: 'Delete' })
    const hasConfirm = await confirmBtn.isVisible({ timeout: 1000 }).catch((e) => {
      if (e.message?.includes('Timeout')) return false
      throw e
    })
    if (hasConfirm) {
      await confirmBtn.click()
    }
    await expect(monthLabels).toHaveCount(initialCount - 1)
  })
})

test.describe('Net Worth — Data View Toggle', () => {
  test('switches to Charts view when Charts tab is clicked', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.chartsTab.click()
    await expect(nw.chartsTab).toHaveAttribute('aria-selected', 'true')
    await expect(nw.chartsTypePicker).toBeVisible()
  })

  test('switches to Spreadsheet view when Spreadsheet tab is clicked', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.spreadsheetTab.click()
    await expect(nw.spreadsheetTab).toHaveAttribute('aria-selected', 'true')
    await expect(nw.spreadsheetWrap).toBeVisible()
  })

  test('shows inactive accounts when Show inactive checkbox is checked', async ({ page }) => {
    await seedNetWorthData(page, { accounts: [...ACCOUNTS, INACTIVE_ACCOUNT] })
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.spreadsheetTab.click()
    // Inactive account should be hidden initially
    await expect(page.locator('.data-spreadsheet-account-name', { hasText: 'Old Savings' })).not.toBeVisible()
    await nw.showInactiveLabel.click()
    await expect(page.locator('.data-spreadsheet-account-name', { hasText: 'Old Savings' })).toBeVisible()
  })
})

test.describe('Net Worth — CSV Import/Export/Reset', () => {
  test('shows import button when CSV import is enabled', async ({ page }) => {
    await seedNetWorthData(page, { allowCsvImport: true })
    const nw = new NetWorthPage(page)
    await nw.goto()
    await expect(nw.importCsvBtn).toBeVisible()
  })

  test('shows export button when accounts and balances exist', async ({ page }) => {
    await seedNetWorthData(page, { allowCsvImport: true })
    const nw = new NetWorthPage(page)
    await nw.goto()
    await expect(nw.exportCsvBtn).toBeVisible()
  })

  test('shows reset button when CSV import is enabled and data exists', async ({ page }) => {
    await seedNetWorthData(page, { allowCsvImport: true })
    const nw = new NetWorthPage(page)
    await nw.goto()
    await expect(nw.resetBtn).toBeVisible()
  })
})

test.describe('Net Worth — Tab Navigation', () => {
  test('navigates to Allocation tab', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.getTabLink('Allocation').click()
    await expect(page).toHaveURL(/\/net-worth\/allocation/)
  })

  test('navigates to Growth tab', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.getTabLink('Growth').click()
    await expect(page).toHaveURL(/\/net-worth\/growth/)
  })
})

test.describe('Net Worth — Home Card Month Arrows', () => {
  test('navigates between months using arrow buttons on Home card', async ({ page }) => {
    await seedNetWorthData(page)
    await page.goto('/finance-tracking/')
    await page.waitForLoadState('domcontentloaded')
    const prevBtn = page.getByLabel('Previous month')
    const nwDate = page.locator('.nw-date')
    const initialDate = await nwDate.textContent()
    await prevBtn.click()
    const newDate = await nwDate.textContent()
    expect(newDate).not.toEqual(initialDate)
  })
})

test.describe('Net Worth — Edge Cases', () => {
  test('handles zero balance entries without errors', async ({ page }) => {
    const zeroBalances = BALANCES.map(b => ({ ...b, balance: 0 }))
    await seedNetWorthData(page, { balances: zeroBalances })
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.spreadsheetTab.click()
    await expect(nw.spreadsheetWrap).toBeVisible()
  })

  test('handles malformed CSV file gracefully on import', async ({ page }) => {
    await seedNetWorthData(page, { allowCsvImport: true })
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.csvFileInput.setInputFiles({
      name: 'bad.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('not,a,valid,csv\n,,,\ngarbage\n'),
    })
    // App should not crash — page remains functional
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error')
    await expect(nw.viewAccountsBtn).toBeVisible()
  })

  test('renders large dataset without crashing', async ({ page }) => {
    const { accounts, balances } = createLargeDataset(20, 24)
    await seedNetWorthData(page, { accounts, balances })
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.spreadsheetTab.click()
    await expect(nw.spreadsheetWrap).toBeVisible()
  })
})

test.describe('Net Worth — Corruption Resilience', () => {
  test('does not crash with malformed JSON in localStorage', async ({ page }) => {
    await seedCorruptedData(page, 'malformed-json')
    const nw = new NetWorthPage(page)
    await nw.goto()
    await expect(page.locator('body')).toBeVisible()
    const content = await page.content()
    expect(content).not.toContain('Unhandled Runtime Error')
    // No data artifacts
    await expect(page.locator('body')).not.toContainText('NaN')
    await expect(page.locator('body')).not.toContainText('Infinity')
  })

  test('does not crash with corrupted balance entries', async ({ page }) => {
    await seedCorruptedData(page, 'corrupted-balances')
    const nw = new NetWorthPage(page)
    await nw.goto()
    await expect(page.locator('body')).toBeVisible()
    const content = await page.content()
    expect(content).not.toContain('Unhandled Runtime Error')
    // Account should still render even if balances are corrupted
    await expect(nw.viewAccountsBtn).toBeVisible()
    // No NaN or Infinity artifacts
    await expect(page.locator('body')).not.toContainText('NaN')
    await expect(page.locator('body')).not.toContainText('Infinity')
  })

  test('does not crash with accounts missing required keys', async ({ page }) => {
    await seedCorruptedData(page, 'missing-keys')
    const nw = new NetWorthPage(page)
    await nw.goto()
    await expect(page.locator('body')).toBeVisible()
    const content = await page.content()
    expect(content).not.toContain('Unhandled Runtime Error')
    // No NaN or undefined text artifacts
    await expect(page.locator('body')).not.toContainText('NaN')
    await expect(page.locator('body')).not.toContainText('undefined')
  })
})

test.describe('Net Worth — Keyboard Navigation', () => {
  test('closes AccountsModal with Escape key', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.openAccountsModal()
    await expect(nw.modal).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(nw.modal).not.toBeVisible()
  })

  test('submits account form with Enter key', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.openAccountsModal()
    await nw.modalAddBtn.click()
    await nw.accountNameInput.waitFor({ state: 'visible' })
    await nw.accountNameInput.fill('Keyboard Account')
    await page.keyboard.press('Enter')
    await expect(nw.getAccountName('Keyboard Account')).toBeVisible()
  })

  test('toggles chart type buttons with keyboard', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.chartsTab.click()
    const secondBtn = nw.getChartTypeBtn(1)
    await secondBtn.focus()
    await page.keyboard.press('Enter')
    await expect(secondBtn).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('Net Worth — Accessibility', () => {
  test('chart type toggle buttons have aria-pressed attribute', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.chartsTab.click()
    const firstBtn = nw.getChartTypeBtn(0)
    await expect(firstBtn).toHaveAttribute('aria-pressed', 'true')
    const secondBtn = nw.getChartTypeBtn(1)
    await expect(secondBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('account form fields have associated labels', async ({ page }) => {
    await seedNetWorthData(page)
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.openAccountsModal()
    await nw.modalAddBtn.click()
    await nw.accountForm.waitFor({ state: 'visible' })
    // Verify form fields have labels
    const labels = nw.accountForm.locator('label')
    const labelCount = await labels.count()
    expect(labelCount).toBeGreaterThan(0)
  })
})

test.describe('Net Worth — Performance', () => {
  test('renders large dataset (50 accounts, 36 months) within 5 seconds', async ({ page }) => {
    const { accounts, balances } = createLargeDataset(50, 36)
    await seedNetWorthData(page, { accounts, balances })
    const nw = new NetWorthPage(page)
    const start = Date.now()
    await nw.goto()
    await nw.spreadsheetTab.click()
    await expect(nw.spreadsheetWrap).toBeVisible()
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000)
  })
})

test.describe('Net Worth — Security', () => {
  test('XSS in account name is rendered as text, not executed', async ({ page }) => {
    let alertFired = false
    page.on('dialog', async (dialog) => {
      alertFired = true
      await dialog.dismiss()
    })

    const xssAccounts = [
      {
        ...ACCOUNTS[0],
        id: 99,
        name: '<script>alert("xss")</script>',
      },
    ]
    await seedNetWorthData(page, { accounts: xssAccounts, balances: [] })
    const nw = new NetWorthPage(page)
    await nw.goto()
    await nw.openAccountsModal()
    const nameCell = nw.modal.locator('.data-account-name')
    await expect(nameCell).toContainText('<script>')
    expect(alertFired).toBe(false)
  })
})
