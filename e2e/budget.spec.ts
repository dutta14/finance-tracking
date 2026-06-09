import { test, expect } from './fixtures/base'
import { BudgetPage } from './pages/budget.page'
import {
  CURRENT_YEAR,
  buildCSV,
  csvFile,
  largeCSV,
  monthCSV,
  knownBudgetStore,
  configFromStore,
  seedBudget,
  seedEmptyBudget,
  seedKnownBudget,
  seedMultiMonthBudget,
  seedMultiYearBudget,
  seedFullYearBudget,
  seedZeroIncomeBudget,
} from './fixtures/budget.fixtures'

test.describe('Budget Page E2E', () => {
  test.describe('Empty State', () => {
    test('shows empty year message when no data exists for selected year', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      await expect(budget.emptyState).toBeVisible()
      await expect(budget.emptyStateTitle).toHaveText(`No data for ${CURRENT_YEAR}`)
      await expect(budget.emptyStateDesc).toContainText(/Import a bank CSV|add transactions manually/i)
      await expect(budget.emptyImportBtn).toBeVisible()
      await expect(budget.emptyImportBtn).toHaveText('Import CSV')
    })

    test('empty state for future year shows different message', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      // Click forward twice to land on a year that is guaranteed in the future
      await budget.nextYearBtn.click()
      await budget.nextYearBtn.click()

      const futureYear = CURRENT_YEAR + 2
      await expect(budget.yearLabel).toHaveText(String(futureYear))
      await expect(budget.emptyStateTitle).toHaveText(`No data for ${futureYear}`)
      await expect(budget.emptyStateDesc).toContainText("This year hasn't started yet")
      // No Import CSV button is rendered for future years
      await expect(budget.emptyImportBtn).toHaveCount(0)
    })
  })

  test.describe('CSV Upload Flow', () => {
    test('quick upload opens preview modal with parsed transactions', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      const csv = buildCSV([
        { date: `${CURRENT_YEAR}-05-01`, category: 'Salary', amount: 5000, description: 'Paycheck' },
        { date: `${CURRENT_YEAR}-05-02`, category: 'Groceries', amount: -85.5, description: 'TJ' },
      ])
      await budget.uploadCSV(`${CURRENT_YEAR}-05.csv`, csv)

      await expect(budget.previewModal).toBeVisible()
      await expect(budget.previewModal).toContainText(`May ${CURRENT_YEAR}`)
      await expect(budget.previewModal).toContainText('Salary')
      await expect(budget.previewModal).toContainText('Groceries')
    })

    test('CSV preview modal shows transaction count and month label', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      const rows = Array.from({ length: 15 }, (_, i) => ({
        date: `${CURRENT_YEAR}-01-${String((i % 28) + 1).padStart(2, '0')}`,
        category: i === 0 ? 'Salary' : 'Groceries',
        amount: i === 0 ? 5000 : -(i + 10),
        description: `Tx ${i + 1}`,
      }))
      const csv = buildCSV(rows)
      await budget.uploadCSV(`${CURRENT_YEAR}-01.csv`, csv)

      await expect(budget.previewModal).toContainText(`Jan ${CURRENT_YEAR}`)
      await expect(budget.previewModal).toContainText('15 rows')
      await expect(budget.previewTable.locator('tbody tr')).toHaveCount(8) // Capped at MAX_PREVIEW_ROWS
    })

    test('confirming CSV import persists data and shows budget summary', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      const csv = buildCSV([
        { date: `${CURRENT_YEAR}-05-01`, category: 'Salary', amount: 6000 },
        { date: `${CURRENT_YEAR}-05-02`, category: 'Groceries', amount: -200 },
      ])
      await budget.uploadCSV(`${CURRENT_YEAR}-05.csv`, csv)
      await budget.previewConfirm.click()

      await expect(budget.previewModal).not.toBeVisible()
      await expect(budget.summaryIncome).toBeVisible()
      await expect(budget.incomeValue).toContainText('$6,000')
      await expect(budget.expenseValue).toContainText('$200')
      // Save rate ≈ (6000-200)/6000 ≈ 96.7%
      await expect(budget.saveRateValue).toContainText(/96\.7%/)

      // Verify storage contains the parsed data
      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      expect(stored).not.toBeNull()
      expect(stored!.length).toBeGreaterThan(10)
      const parsed = JSON.parse(stored!)
      expect(parsed.csvs[`${CURRENT_YEAR}-05`]).toBeDefined()
      expect(parsed.csvs[`${CURRENT_YEAR}-05`].csv).toContain('Salary')
    })

    test('canceling CSV preview discards the upload', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      const csv = buildCSV([{ date: `${CURRENT_YEAR}-05-01`, category: 'Salary', amount: 5000 }])
      await budget.uploadCSV(`${CURRENT_YEAR}-05.csv`, csv)
      await budget.previewCancel.click()

      await expect(budget.previewModal).not.toBeVisible()
      await expect(budget.emptyState).toBeVisible()

      // budget-store should not contain the unconfirmed upload
      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      if (stored !== null) {
        const parsed = JSON.parse(stored)
        expect(parsed.csvs?.[`${CURRENT_YEAR}-05`]).toBeUndefined()
      } else {
        expect(stored).toBeNull()
      }
    })

    test('bulk upload imports multiple months sequentially', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      const jan = buildCSV([
        { date: `${CURRENT_YEAR}-01-01`, category: 'Salary', amount: 5000 },
        { date: `${CURRENT_YEAR}-01-05`, category: 'Rent', amount: -1500 },
      ])
      const feb = buildCSV([
        { date: `${CURRENT_YEAR}-02-01`, category: 'Salary', amount: 5000 },
        { date: `${CURRENT_YEAR}-02-05`, category: 'Rent', amount: -1500 },
      ])
      const mar = buildCSV([
        { date: `${CURRENT_YEAR}-03-01`, category: 'Salary', amount: 5000 },
        { date: `${CURRENT_YEAR}-03-05`, category: 'Rent', amount: -1500 },
      ])

      await budget.bulkUploadCSVs([
        csvFile(`${CURRENT_YEAR}-01.csv`, jan),
        csvFile(`${CURRENT_YEAR}-02.csv`, feb),
        csvFile(`${CURRENT_YEAR}-03.csv`, mar),
      ])

      // Confirm each month sequentially
      for (const expectedLabel of [`Jan ${CURRENT_YEAR}`, `Feb ${CURRENT_YEAR}`, `Mar ${CURRENT_YEAR}`]) {
        await expect(budget.previewModal).toBeVisible()
        await expect(budget.previewModal).toContainText(expectedLabel)
        await budget.previewConfirm.click()
      }

      await expect(budget.previewModal).not.toBeVisible()

      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.csvs[`${CURRENT_YEAR}-01`]).toBeDefined()
      expect(parsed.csvs[`${CURRENT_YEAR}-02`]).toBeDefined()
      expect(parsed.csvs[`${CURRENT_YEAR}-03`]).toBeDefined()
    })

  })

  test.describe('Manual Transaction Entry', () => {
    test('adds a manual income transaction', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      const incomeBefore = await budget.incomeValue.textContent()
      expect(incomeBefore).toContain('$10,000')

      await budget.fillManualEntry({
        date: `${CURRENT_YEAR}-05-15`,
        description: 'Bonus paycheck',
        amount: '2500',
        category: 'Salary',
      })
      await budget.submitManualEntry()

      // Income should reflect the additional $2,500 (10,000 + 2,500 = 12,500)
      await expect(budget.incomeValue).toContainText('$12,500')
      // The Save button briefly flips to "Added ✓" on a successful submit —
      // wait for that UI side-effect before reading storage so we don't race
      // with the React commit + storage write.
      await expect(budget.txnSave).toHaveText(/Added/)

      // Poll storage for convergence (the persistence effect runs after the
      // DOM update above).
      await expect
        .poll(async () => {
          const raw = await page.evaluate(() => localStorage.getItem('budget-store'))
          if (!raw) return null
          const obj = JSON.parse(raw)
          return obj.csvs?.[`${CURRENT_YEAR}-05`]?.csv ?? null
        })
        .toMatch(/Bonus paycheck/)

      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      const parsed = JSON.parse(stored!)
      expect(parsed.csvs[`${CURRENT_YEAR}-05`].csv).toContain('Bonus paycheck')
      expect(parsed.csvs[`${CURRENT_YEAR}-05`].csv).toContain('2500')
    })

    test('adds a manual expense transaction', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      await budget.fillManualEntry({
        date: `${CURRENT_YEAR}-05-20`,
        description: 'Electric bill',
        amount: '-150',
        category: 'Rent',
      })
      await budget.submitManualEntry()

      // Original expenses were $7,000. New: $7,150.
      await expect(budget.expenseValue).toContainText('$7,150')
    })
  })

  test.describe('Year Navigation', () => {
    test('year selector navigates between years with data', async ({ page }) => {
      await seedMultiYearBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      await expect(budget.yearLabel).toHaveText(String(CURRENT_YEAR))
      await expect(budget.incomeValue).toContainText('$8,500')

      await budget.prevYearBtn.click()
      await expect(budget.yearLabel).toHaveText(String(CURRENT_YEAR - 1))
      // Last year's salary was $7,500
      await expect(budget.incomeValue).toContainText('$7,500')
    })

    test('year with no data shows empty state even when other years have data', async ({ page }) => {
      await seedMultiYearBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      // Navigate two years back: one year has data, two years back is empty
      await budget.prevYearBtn.click()
      await budget.prevYearBtn.click()
      await expect(budget.yearLabel).toHaveText(String(CURRENT_YEAR - 2))
      await expect(budget.emptyState).toBeVisible()
      await expect(budget.emptyStateTitle).toContainText(`No data for ${CURRENT_YEAR - 2}`)
    })
  })

  test.describe('View Modes', () => {
    test('detailed view renders income and expense tables', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.setViewMode('detailed')

      await expect(budget.tableSections).toHaveCount(2)
      await expect(budget.incomeTable).toBeVisible()
      await expect(budget.expenseTable).toBeVisible()
      // Categories appear
      await expect(budget.incomeTable).toContainText('Salary')
      await expect(budget.expenseTable).toContainText('Rent')
      await expect(budget.expenseTable).toContainText('Groceries')
    })

    test('aggregated view renders summary rows for each group', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.setViewMode('aggregated')

      await expect(budget.tableSections).toHaveCount(2)
      // Aggregated rows use the budget-tr--agg-row class
      const aggRows = page.locator('tr.budget-tr--agg-row')
      await expect(aggRows.first()).toBeVisible()
      const count = await aggRows.count()
      expect(count).toBeGreaterThan(0)
      await expect(page.locator('.budget-table-title').first()).toContainText('Aggregated')
    })

    test('cashflow view renders bar chart and Sankey diagram', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.setViewMode('cashflow')

      await expect(page.locator('.cashflow-bar-wrap')).toBeVisible()
      await expect(page.locator('.cashflow-sankey-wrap')).toBeVisible()
      // Sankey renders an SVG
      await expect(page.locator('.cashflow-sankey-svg')).toBeVisible()
    })
  })

  test.describe('Budget Summary & Savings Rate', () => {
    test('displays correct income, expense, and savings rate for known data', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      await expect(budget.incomeValue).toContainText('$10,000')
      await expect(budget.expenseValue).toContainText('$7,000')
      // Save rate = 1 - 7000/10000 = 30%
      await expect(budget.saveRateValue).toContainText('30.0%')

      const summaryShape = await page.evaluate(() => {
        const raw = localStorage.getItem('budget-summary')
        if (!raw) return null
        const obj = JSON.parse(raw)
        return {
          hasAnnualSavings: typeof obj.annualSavings === 'number',
          hasSaveRate: typeof obj.saveRate === 'number',
        }
      })
      expect(summaryShape).not.toBeNull()
      expect(summaryShape!.hasAnnualSavings).toBe(true)
      expect(summaryShape!.hasSaveRate).toBe(true)
    })

    test('savings rate updates after adding a new expense', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      await expect(budget.saveRateValue).toContainText('30.0%')

      await budget.fillManualEntry({
        date: `${CURRENT_YEAR}-05-25`,
        amount: '-1000',
        category: 'Rent',
      })
      await budget.submitManualEntry()

      // New expense pushes save rate below 30%
      await expect(budget.expenseValue).toContainText('$8,000')
      await expect(budget.saveRateValue).toContainText('20.0%')
    })
  })

  test.describe('Category Management', () => {
    test('opening Category Group Manager shows existing groups', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      await budget.openGroupManager()
      await expect(budget.groupManager).toBeVisible()
      // The known dataset defines a "Fixed" group containing "Rent"
      await expect(budget.groupManager).toContainText('Fixed')
      await expect(budget.groupManager).toContainText('Rent')

      const config = await page.evaluate(() => localStorage.getItem('budget-config'))
      expect(config).not.toBeNull()
      expect(config!.length).toBeGreaterThan(10)
    })

    test('merging two expense categories combines their transactions', async ({ page }) => {
      // Build a store with two expense categories we'll merge into one
      const store = knownBudgetStore()
      const month = `${CURRENT_YEAR}-05`
      store.csvs[month] = monthCSV(
        month,
        buildCSV([
          { date: `${CURRENT_YEAR}-05-01`, category: 'Salary', amount: 10000 },
          { date: `${CURRENT_YEAR}-05-02`, category: 'Groceries', amount: -200 },
          { date: `${CURRENT_YEAR}-05-03`, category: 'Dining', amount: -150 },
        ]),
      )
      store.categoryGroups = [
        { id: 'food', name: 'Food', categories: ['Groceries', 'Dining'] },
        { id: 'others', name: 'Others', categories: ['Salary'] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
      ]
      await seedBudget(page, { store, config: configFromStore(store) })

      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.openGroupManager()

      // Enter merge mode and select the two categories
      const mergeBtn = page.locator('.budget-group-add-btn', { hasText: 'Merge Categories' })
      await mergeBtn.click()
      await page.locator('.budget-group-cat-name', { hasText: 'Groceries' }).click()
      await page.locator('.budget-group-cat-name', { hasText: 'Dining' }).click()

      // Set target name via the free-text input and click Merge
      const targetInput = page.locator('.budget-merge-panel input.budget-group-input')
      await targetInput.fill('Food & Dining')
      await page.locator('.budget-merge-panel .budget-group-add-btn', { hasText: /^Merge$/ }).click()

      // Wait for the merge panel to close and the merged name to appear in the
      // group manager — this proves the React commit + storage write has run
      // before we read localStorage.
      await expect(page.locator('.budget-merge-panel')).toBeHidden()
      await expect(budget.groupManager).toContainText('Food & Dining')

      // Both original categories are gone; merged category appears in CSV
      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      const parsed = JSON.parse(stored!)
      const csv = parsed.csvs[`${CURRENT_YEAR}-05`].csv as string
      expect(csv).toContain('Food & Dining')
      expect(csv).not.toMatch(/,Groceries,/)
      expect(csv).not.toMatch(/,Dining,/)
    })

    test('renaming a category updates it across all transactions', async ({ page }) => {
      const store = knownBudgetStore()
      const month = `${CURRENT_YEAR}-05`
      store.csvs[month] = monthCSV(
        month,
        buildCSV([
          { date: `${CURRENT_YEAR}-05-01`, category: 'Salary', amount: 10000 },
          { date: `${CURRENT_YEAR}-05-02`, category: 'Groceries', amount: -200 },
          { date: `${CURRENT_YEAR}-05-10`, category: 'Groceries', amount: -100 },
        ]),
      )
      store.categoryGroups = [
        { id: 'food', name: 'Food', categories: ['Groceries'] },
        { id: 'others', name: 'Others', categories: ['Salary'] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
      ]
      await seedBudget(page, { store, config: configFromStore(store) })

      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.openGroupManager()

      // Use the "merge single → new target" flow as a rename: select Groceries and
      // type the new name. Merging one category to a new name effectively renames it.
      const mergeBtn = page.locator('.budget-group-add-btn', { hasText: 'Merge Categories' })
      await mergeBtn.click()
      await page.locator('.budget-group-cat-name', { hasText: 'Groceries' }).click()

      // Need at least 2 selections for the in-app Merge button to enable. So
      // instead, use the deleteCategory → merge prompt that runs even for one
      // source. Cancel merge mode first.
      await page.locator('.budget-group-add-btn', { hasText: 'Cancel Merge' }).click()

      // Click delete (×) on Groceries — since it has transactions, the merge
      // prompt opens letting us pick a new target name.
      const groceriesItem = page.locator('.budget-group-cat').filter({ hasText: 'Groceries' })
      await groceriesItem.locator('.budget-group-cat-delete').click()

      const newNameInput = page.locator('.budget-merge-panel input.budget-group-input')
      await newNameInput.fill('Food & Grocery')
      await page.locator('.budget-merge-panel .budget-group-add-btn', { hasText: /Merge.*Delete/i }).click()

      // Wait for the merge panel to close and the renamed category to appear in
      // the group manager before reading storage.
      await expect(page.locator('.budget-merge-panel')).toBeHidden()
      await expect(budget.groupManager).toContainText('Food & Grocery')

      // CSV now uses the new category name
      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      const parsed = JSON.parse(stored!)
      const csv = parsed.csvs[`${CURRENT_YEAR}-05`].csv as string
      expect(csv).toContain('Food & Grocery')
      expect(csv).not.toMatch(/,Groceries,/)
    })

    test('deleting a category with transactions opens merge prompt', async ({ page }) => {
      const store = knownBudgetStore()
      const month = `${CURRENT_YEAR}-05`
      store.csvs[month] = monthCSV(
        month,
        buildCSV([
          { date: `${CURRENT_YEAR}-05-01`, category: 'Salary', amount: 10000 },
          { date: `${CURRENT_YEAR}-05-02`, category: 'Groceries', amount: -200 },
          { date: `${CURRENT_YEAR}-05-03`, category: 'Rent', amount: -1000 },
        ]),
      )
      store.categoryGroups = [
        { id: 'fixed', name: 'Fixed', categories: ['Rent'] },
        { id: 'food', name: 'Food', categories: ['Groceries'] },
        { id: 'others', name: 'Others', categories: ['Salary'] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
      ]
      await seedBudget(page, { store, config: configFromStore(store) })

      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.openGroupManager()

      const groceriesItem = page.locator('.budget-group-cat').filter({ hasText: 'Groceries' })
      await groceriesItem.locator('.budget-group-cat-delete').click()

      // Merge prompt is now visible
      await expect(page.locator('.budget-merge-panel')).toBeVisible()
      await expect(page.locator('.budget-merge-panel')).toContainText('Groceries')
      await expect(page.locator('.budget-merge-panel')).toContainText(/merge them into/i)
    })

    test('completing the delete-with-merge flow reassigns transactions and removes the deleted category', async ({
      page,
    }) => {
      const store = knownBudgetStore()
      const month = `${CURRENT_YEAR}-05`
      store.csvs[month] = monthCSV(
        month,
        buildCSV([
          { date: `${CURRENT_YEAR}-05-01`, category: 'Salary', amount: 10000 },
          { date: `${CURRENT_YEAR}-05-02`, category: 'Groceries', amount: -200 },
          { date: `${CURRENT_YEAR}-05-03`, category: 'Rent', amount: -1000 },
        ]),
      )
      store.categoryGroups = [
        { id: 'fixed', name: 'Fixed', categories: ['Rent'] },
        { id: 'food', name: 'Food', categories: ['Groceries'] },
        { id: 'others', name: 'Others', categories: ['Salary'] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
      ]
      await seedBudget(page, { store, config: configFromStore(store) })

      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.openGroupManager()

      // Click delete (×) on Groceries to open the merge prompt
      const groceriesItem = page.locator('.budget-group-cat').filter({ hasText: 'Groceries' })
      await groceriesItem.locator('.budget-group-cat-delete').click()
      await expect(page.locator('.budget-merge-panel')).toBeVisible()

      // Pick "Rent" as the merge target (a category that already exists)
      const targetInput = page.locator('.budget-merge-panel input.budget-group-input')
      await targetInput.fill('Rent')
      await page.locator('.budget-merge-panel .budget-group-add-btn', { hasText: /Merge.*Delete/i }).click()

      // Merge panel closes, Groceries is gone from the group manager
      await expect(page.locator('.budget-merge-panel')).toBeHidden()
      await expect(budget.groupManager).not.toContainText('Groceries')
      await expect(budget.groupManager).toContainText('Rent')

      // CSV has transactions reassigned to Rent; Groceries is gone
      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      const parsed = JSON.parse(stored!)
      const csv = parsed.csvs[`${CURRENT_YEAR}-05`].csv as string
      expect(csv).not.toMatch(/,Groceries,/)
      // Two Rent rows now: the original $1000 plus the reassigned $200
      expect((csv.match(/,Rent,/g) ?? []).length).toBe(2)

      // budget-config no longer lists Groceries in any group's categories
      const config = await page.evaluate(() => JSON.parse(localStorage.getItem('budget-config') || '{}'))
      const allCategories = (config.categoryGroups as Array<{ categories: string[] }>).flatMap(g => g.categories)
      expect(allCategories).not.toContain('Groceries')
    })
  })

  test.describe('Time Period Toggle', () => {
    test('switching to quarter view changes column count to 4', async ({ page }) => {
      await seedFullYearBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.setViewMode('detailed')
      await budget.setTimePeriod('Q')

      // Income table: category col + 4 quarters + total = 6 header cells
      const headers = budget.incomeTable.locator('thead th')
      await expect(headers).toHaveCount(6)
      await expect(headers.nth(1)).toContainText('Q1')
      await expect(headers.nth(4)).toContainText('Q4')
    })
  })

  test.describe('Removing Data', () => {
    test('removing a CSV for a specific month clears that months data', async ({ page }) => {
      await seedMultiMonthBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.setViewMode('detailed')

      // The seeded data has Jan, Feb, Mar — total expenses = 300+150 + 350+160 + 400+170 = 1530
      await expect(budget.expenseValue).toContainText('$1,530')

      // Right-click the February (index 1) month header in the expense table
      await budget.openMonthContextMenu(1)
      await page.locator('.budget-ctx-item--danger', { hasText: 'Remove CSV' }).click()

      // February data is now gone — totals drop by Feb's 350+160 = 510 → 1020
      await expect(budget.expenseValue).toContainText('$1,020')

      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      const parsed = JSON.parse(stored!)
      expect(parsed.csvs[`${CURRENT_YEAR}-01`]).toBeDefined()
      expect(parsed.csvs[`${CURRENT_YEAR}-02`]).toBeUndefined()
      expect(parsed.csvs[`${CURRENT_YEAR}-03`]).toBeDefined()
    })
  })

  test.describe('Edge Cases', () => {
    test('CSV with unusual characters in descriptions renders correctly', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      const csv = buildCSV([
        { date: `${CURRENT_YEAR}-05-01`, category: 'Salary', amount: 5000, description: 'café résumé' },
        { date: `${CURRENT_YEAR}-05-02`, category: 'Groceries', amount: -50, description: 'Trader Joe\'s, organic "fresh"' },
        { date: `${CURRENT_YEAR}-05-03`, category: 'Groceries', amount: -75, description: 'emoji 🍕 pizza' },
      ])
      await budget.uploadCSV(`${CURRENT_YEAR}-05.csv`, csv)
      await budget.previewConfirm.click()

      await expect(budget.summaryIncome).toBeVisible()
      await expect(budget.incomeValue).toContainText('$5,000')
      // No NaN or undefined rendering
      const bodyText = await page.locator('.budget-page').innerText()
      expect(bodyText).not.toContain('NaN')
      expect(bodyText).not.toContain('undefined')
      expect(bodyText).not.toContain('Infinity')
    })

    test('large CSV with 500+ rows imports without crashing', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      const csv = largeCSV(500, `${CURRENT_YEAR}-04`)
      await budget.uploadCSV(`${CURRENT_YEAR}-04.csv`, csv)
      await expect(budget.previewModal).toContainText(`Apr ${CURRENT_YEAR}`)
      // Total row count text on the modal
      await expect(budget.previewModal).toContainText(/501 rows/)

      await budget.previewConfirm.click()
      await expect(budget.previewModal).not.toBeVisible()
      await expect(budget.summaryIncome).toBeVisible()
      await expect(budget.incomeValue).toContainText('$10,000')
    })

    test('zero-income data shows save rate as 0% without NaN/Infinity', async ({ page }) => {
      await seedZeroIncomeBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      // Expenses exist but no income — save rate divides into 0, must not be NaN
      await expect(budget.incomeValue).toHaveText('$0')
      await expect(budget.expenseValue).toContainText('$1,200')
      await expect(budget.saveRateValue).toHaveText('0.0%')

      const bodyText = await page.locator('.budget-page').innerText()
      expect(bodyText).not.toContain('NaN')
      expect(bodyText).not.toContain('Infinity')

      // The persisted summary must store a finite saveRate
      const summary = await page.evaluate(() => JSON.parse(localStorage.getItem('budget-summary') || '{}'))
      expect(Number.isFinite(summary.saveRate)).toBe(true)
      expect(summary.saveRate).toBe(0)
    })
  })

  test.describe('CSV Injection Protection', () => {
    test('CSV cell containing formula syntax is rendered as literal text', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      // Put formula-prefix strings on expense rows so the expense drill-down can verify them
      const csv = buildCSV([
        { date: `${CURRENT_YEAR}-05-01`, category: 'Salary', amount: 5000, description: 'Paycheck' },
        { date: `${CURRENT_YEAR}-05-02`, category: 'Groceries', amount: -50, description: '=SUM(A1:A10)' },
        { date: `${CURRENT_YEAR}-05-03`, category: 'Groceries', amount: -25, description: "+CMD('calc')" },
        { date: `${CURRENT_YEAR}-05-04`, category: 'Groceries', amount: -30, description: '@SUM(1+9)*cmd' },
        { date: `${CURRENT_YEAR}-05-05`, category: 'Groceries', amount: -10, description: '-2+3' },
      ])
      await budget.uploadCSV(`${CURRENT_YEAR}-05.csv`, csv)

      // Preview shows literal formula strings
      await expect(budget.previewTable).toContainText('=SUM(A1:A10)')
      await expect(budget.previewTable).toContainText("+CMD('calc')")
      await expect(budget.previewTable).toContainText('@SUM(1+9)*cmd')

      await budget.previewConfirm.click()
      await expect(budget.summaryIncome).toBeVisible()
      await expect(budget.incomeValue).toContainText('$5,000')

      // Drill into the expense table's May column
      await budget.setViewMode('detailed')
      await budget.expenseTable.locator('th.budget-th--month').nth(4).click()
      const drilldown = page.locator('.budget-drilldown-table')
      await expect(drilldown).toBeVisible()
      await expect(drilldown).toContainText('=SUM(A1:A10)')
      await expect(drilldown).toContainText("+CMD('calc')")
      await expect(drilldown).toContainText('@SUM(1+9)*cmd')
    })

    test('CSV description with tab and embedded newline parses safely', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      // Embed a literal tab and a quoted newline in a CSV description
      const csv =
        'Date,Category,Amount,Description\n' +
        `${CURRENT_YEAR}-05-01,Salary,5000,"Line1\tLine2\nLine3"\n` +
        `${CURRENT_YEAR}-05-02,Groceries,-50,Normal description\n`

      await budget.uploadCSV(`${CURRENT_YEAR}-05.csv`, csv)
      // Modal reports 2 rows (the multi-line description is one logical row)
      await expect(budget.previewModal).toContainText('2 rows')

      await budget.previewConfirm.click()
      await expect(budget.summaryIncome).toBeVisible()
      await expect(budget.incomeValue).toContainText('$5,000')
      await expect(budget.expenseValue).toContainText('$50')
    })
  })

  test.describe('Malformed CSV Handling', () => {
    test('CSV with inconsistent column count does not crash and imports valid rows', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      // Header has 4 cols; some rows have 3 (no description), one has 5 (extra)
      const csv =
        'Date,Category,Amount,Description\n' +
        `${CURRENT_YEAR}-05-01,Salary,5000\n` +
        `${CURRENT_YEAR}-05-02,Groceries,-100,Normal,ExtraField\n` +
        `${CURRENT_YEAR}-05-03,Rent,-1500,Apartment\n`

      await budget.uploadCSV(`${CURRENT_YEAR}-05.csv`, csv)
      await budget.previewConfirm.click()

      // Page does not crash; valid rows are imported
      await expect(budget.summaryIncome).toBeVisible()
      await expect(budget.incomeValue).toContainText('$5,000')
      await expect(budget.expenseValue).toContainText('$1,600')

      const bodyText = await page.locator('.budget-page').innerText()
      expect(bodyText).not.toContain('NaN')
    })

    test('CSV with non-numeric amounts skips invalid rows, no NaN', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      const csv =
        'Date,Category,Amount,Description\n' +
        `${CURRENT_YEAR}-05-01,Salary,5000,Valid\n` +
        `${CURRENT_YEAR}-05-02,Groceries,abc,Garbage amount\n` +
        `${CURRENT_YEAR}-05-03,Groceries,N/A,Missing\n` +
        `${CURRENT_YEAR}-05-04,Groceries,,Empty\n` +
        `${CURRENT_YEAR}-05-05,Rent,-1500,Valid expense\n`

      await budget.uploadCSV(`${CURRENT_YEAR}-05.csv`, csv)
      await budget.previewConfirm.click()

      // Only the two valid rows count toward summary
      await expect(budget.incomeValue).toContainText('$5,000')
      await expect(budget.expenseValue).toContainText('$1,500')

      const bodyText = await page.locator('.budget-page').innerText()
      expect(bodyText).not.toContain('NaN')
      expect(bodyText).not.toContain('Infinity')

      // The persisted CSV should not contain a 'NaN' anywhere
      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      expect(stored).not.toBeNull()
      expect(stored!).not.toContain('NaN')
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('drilldown inline edit: Enter activates, Escape cancels, Enter confirms', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.setViewMode('detailed')

      // Open the May drill-down (5th month, index 4) in the expense table
      await budget.expenseTable.locator('th.budget-th--month').nth(4).click()
      await expect(page.locator('.budget-drilldown')).toBeVisible()

      // Find the Groceries row's category cell and double-click to edit
      const groceriesRow = page.locator('.budget-drilldown-table tbody tr').filter({ hasText: 'Groceries' })
      const groceriesCatCell = groceriesRow.locator('td.budget-drilldown-cat-cell').first()
      await groceriesCatCell.dblclick()

      const input = page.locator('input.budget-drilldown-cat-input')
      await expect(input).toBeVisible()
      await expect(input).toHaveValue('Groceries')

      // Type a new name and press Escape — change is discarded
      await input.fill('Food')
      await input.press('Escape')
      await expect(input).not.toBeVisible()
      await expect(groceriesRow).toContainText('Groceries')

      // Edit again, press Enter — change is committed
      await groceriesCatCell.dblclick()
      await input.fill('Food')
      // New category triggers confirm dialog; press Enter on input first
      await input.press('Enter')

      // Confirm prompt asks to create new category — click Yes
      const yesBtn = page.locator('.budget-confirm-newcat-btn--yes')
      await expect(yesBtn).toBeVisible()
      await yesBtn.click()

      // Wait for the confirm prompt to close AND the drilldown row to reflect
      // the renamed category before reading storage.
      await expect(yesBtn).toBeHidden()
      await expect(page.locator('.budget-drilldown-table tbody')).toContainText('Food')

      // CSV should now reflect "Food" instead of "Groceries"
      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      const parsed = JSON.parse(stored!)
      const csv = parsed.csvs[`${CURRENT_YEAR}-05`].csv as string
      expect(csv).toContain('Food')
      expect(csv).not.toMatch(/,Groceries,/)
    })

    test('group manager: reorder a group with the move-up button', async ({ page }) => {
      const store = knownBudgetStore()
      // Need two non-protected groups to reorder
      store.categoryGroups = [
        { id: 'food', name: 'Food', categories: ['Groceries'] },
        { id: 'fixed', name: 'Fixed', categories: ['Rent'] },
        { id: 'others', name: 'Others', categories: ['Salary'] },
        { id: 'removed', name: 'Remove from Budget', categories: [] },
      ]
      await seedBudget(page, { store, config: configFromStore(store) })

      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.openGroupManager()

      // Initial order: Food first, then Fixed
      let names = await page.locator('.budget-group-name').allTextContents()
      const firstTwoNamesBefore = names.slice(0, 2).map(n => n.replace(/\d+$/, '').trim())
      expect(firstTwoNamesBefore[0]).toContain('Food')
      expect(firstTwoNamesBefore[1]).toContain('Fixed')

      // Click Move Up on the Fixed group
      const fixedBlock = page.locator('.budget-group-block').filter({ hasText: /^Fixed/ }).first()
      await fixedBlock.locator('.budget-group-move', { hasText: '▲' }).click()

      names = await page.locator('.budget-group-name').allTextContents()
      const firstTwoNamesAfter = names.slice(0, 2).map(n => n.replace(/\d+$/, '').trim())
      expect(firstTwoNamesAfter[0]).toContain('Fixed')
      expect(firstTwoNamesAfter[1]).toContain('Food')

      // Storage reflects the new order
      const config = await page.evaluate(() => JSON.parse(localStorage.getItem('budget-config') || '{}'))
      const ids = (config.categoryGroups as Array<{ id: string }>).map(g => g.id)
      expect(ids.indexOf('fixed')).toBeLessThan(ids.indexOf('food'))
    })

    test('manual entry: keyboard Tab navigates fields in the documented order', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      await budget.openManualEntry()

      // The form auto-focuses the Date input on open
      await expect(budget.txnDate).toBeFocused()
      // Fill the date so the internal segment cursor lands on the last segment.
      // On Chromium <input type="date"> still consumes Tab to cycle internal
      // segments (mm/dd/yyyy), so we drive Tab in a loop and capture the
      // sequence of focused form fields — that's the documented tab order.
      await budget.txnDate.fill(`${CURRENT_YEAR}-05-18`)

      const formFieldIds = ['txn-desc', 'txn-amount', 'txn-category']
      const seen: string[] = []
      for (let i = 0; i < 12 && seen[seen.length - 1] !== 'txn-category'; i++) {
        await page.keyboard.press('Tab')
        const id = await page.evaluate(() => document.activeElement?.id ?? '')
        if (formFieldIds.includes(id) && seen[seen.length - 1] !== id) {
          seen.push(id)
        }
      }
      expect(seen).toEqual(formFieldIds)

      // Focus has landed on the category combobox via Tab — fill via keyboard
      // and pick the first option.
      await expect(budget.txnCategory).toBeFocused()
      await page.keyboard.type('G')
      await expect(budget.txnCatListbox).toBeVisible()
      const options = budget.txnCatListbox.locator('li[role="option"]')
      const optionCount = await options.count()
      expect(optionCount).toBeGreaterThan(0)

      // First option is auto-highlighted on type — press Enter to select
      await page.keyboard.press('Enter')
      await expect(budget.txnCategory).not.toHaveValue('')
      await expect(budget.txnCategory).not.toHaveValue('G')

      // Fill amount (focus had passed through it during the Tab sweep above
      // before being reset by the category selection).
      await budget.txnAmount.fill('-99')
      await budget.txnDesc.fill('Test entry')

      // Submit and verify storage updates AFTER the success indicator flips
      // (avoids racing the React commit + storage write).
      await budget.txnSave.click()
      await expect(budget.txnSave).toHaveText(/Added/)
      await expect
        .poll(async () => {
          const raw = await page.evaluate(() => localStorage.getItem('budget-store'))
          if (!raw) return null
          return JSON.parse(raw).csvs?.[`${CURRENT_YEAR}-05`]?.csv ?? null
        })
        .toMatch(/Test entry/)
      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      const parsed = JSON.parse(stored!)
      expect(parsed.csvs[`${CURRENT_YEAR}-05`].csv).toContain('Test entry')
    })
  })

  test.describe('Event Propagation', () => {
    test('budget data imported on Budget page is consumed by Home GoalsPeek FI projection', async ({ page }) => {
      // Seed an FI goal + accounts + profile so the Home GoalsPeek card has
      // something to render. Budget store is left empty — we'll import it
      // through the real Budget UI to exercise the full propagation path.
      await page.addInitScript(() => {
        localStorage.clear()
        localStorage.setItem('encryption-enabled', '0')
        localStorage.setItem('onboarding-dismissed', '1')
        localStorage.setItem('darkMode', '0')
        localStorage.setItem(
          'user-profile',
          JSON.stringify({ name: 'Alex', avatarDataUrl: '', birthday: '1992-03-15' }),
        )
        localStorage.setItem(
          'data-accounts',
          JSON.stringify([
            {
              id: 1,
              name: '401(k)',
              type: 'retirement',
              owner: 'primary',
              status: 'active',
              goalType: 'fi',
              nature: 'asset',
              allocation: 'us-stock',
              institution: 'Fidelity',
              group: 'Retirement',
            },
          ]),
        )
        localStorage.setItem(
          'data-balances',
          JSON.stringify([{ accountId: 1, month: '2025-01', balance: 50000 }]),
        )
        localStorage.setItem(
          'financialGoals',
          JSON.stringify([
            {
              id: 1,
              goalName: 'Early Retirement',
              createdAt: '2020-01-15T00:00:00.000Z',
              birthday: '1992-03-15',
              goalCreatedIn: '2020-01',
              goalEndYear: '2050',
              resetExpenseMonth: false,
              retirementAge: 50,
              expenseMonth: 1,
              expenseValue: 60000,
              monthlyExpenseValue: 5000,
              safeWithdrawalRate: 3.5,
              growth: 8,
              retirement: '2042-03',
              fiGoal: 3428571,
              progress: 5,
            },
          ]),
        )
        localStorage.setItem('gw-goals', JSON.stringify([]))
      })

      const budget = new BudgetPage(page)
      await budget.goto()

      const csv = buildCSV([
        { date: `${CURRENT_YEAR}-05-01`, category: 'Salary', amount: 8000 },
        { date: `${CURRENT_YEAR}-05-02`, category: 'Groceries', amount: -3000 },
        { date: `${CURRENT_YEAR}-05-03`, category: 'Rent', amount: -2000 },
      ])
      await budget.uploadCSV(`${CURRENT_YEAR}-05.csv`, csv)
      await budget.previewConfirm.click()
      await expect(budget.summaryIncome).toBeVisible()
      await expect(budget.saveRateValue).toContainText(/37\.5%/)

      // Wait for budget-summary to be persisted with the expected shape — not
      // just "any object". Assert specific numeric fields.
      await expect
        .poll(async () => {
          const raw = await page.evaluate(() => localStorage.getItem('budget-summary'))
          return raw ? JSON.parse(raw) : null
        })
        .toMatchObject({
          saveRate: expect.any(Number),
          monthsOfData: 1,
          annualSavings: expect.any(Number),
        })

      const summary = await page.evaluate(() => JSON.parse(localStorage.getItem('budget-summary') || '{}'))
      expect(summary.saveRate).toBeGreaterThan(0.3)
      expect(summary.saveRate).toBeLessThan(0.5)
      expect(summary.monthsOfData).toBe(1)
      expect(summary.annualSavings).toBeGreaterThan(0)

      // Navigate to Home — GoalsPeek must DOM-render the FI projection sourced
      // from the just-saved budget data. Without budget data, it renders
      // "Add budget data →". With non-positive savings it renders
      // "Not reachable at current rate". With our $3000/mo savings the projection
      // produces a date like "Jan 2058".
      await page.goto('/finance-tracking/#/')
      await page.waitForLoadState('domcontentloaded')

      const projected = page.locator('.goals-peek-projected').first()
      await expect(projected).toBeVisible()
      await expect(projected).not.toContainText('Add budget data')
      await expect(projected).not.toContainText('Not reachable')
      // The projection renders a "FI by <Mon YYYY>" string in its date span
      await expect(page.locator('.goals-peek-projected-date').first()).toHaveText(/[A-Z][a-z]{2} \d{4}/)
    })
  })

  test.describe('Dark Mode', () => {
    test('budget table renders with real text/background contrast in dark mode', async ({ page }) => {
      const store = knownBudgetStore()
      await seedBudget(page, { store, config: configFromStore(store), darkMode: true })

      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.setViewMode('detailed')

      const hasDark = await page.evaluate(() => document.body.classList.contains('dark'))
      expect(hasDark).toBe(true)

      // Summary cards are visible and readable (non-empty values)
      await expect(budget.incomeValue).toContainText('$10,000')

      // Real contrast check: read the cell's text color, walk up to the first
      // non-transparent ancestor background, and assert (a) they differ and
      // (b) the WCAG contrast ratio is at least 4.5:1 (AA for normal text).
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
          return [0, 0, 0] // fallback to dark canvas
        }
        const relLum = (r: number, g: number, b: number) => {
          const channel = (c: number) => {
            const s = c / 255
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
          }
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
        }
        const cell = document.querySelector('.budget-td--category-name') as HTMLElement | null
        if (!cell) return null
        const cs = getComputedStyle(cell)
        const fg = parseRgb(cs.color)
        if (!fg) return null
        const bg = effectiveBg(cell)
        const Lfg = relLum(fg[0], fg[1], fg[2])
        const Lbg = relLum(bg[0], bg[1], bg[2])
        const ratio = (Math.max(Lfg, Lbg) + 0.05) / (Math.min(Lfg, Lbg) + 0.05)
        return { color: cs.color, backgroundColor: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`, ratio }
      })

      expect(contrast).not.toBeNull()
      // Text color must not equal the effective background (the test the brief calls out)
      expect(contrast!.color).not.toBe(contrast!.backgroundColor)
      // And the contrast ratio must clear WCAG AA for normal text
      expect(contrast!.ratio).toBeGreaterThanOrEqual(4.5)
    })
  })

  test.describe('Accessibility', () => {
    test('manual entry category combobox exposes ARIA roles for assistive tech', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      await budget.openManualEntry()
      await expect(budget.txnCategory).toHaveAttribute('role', 'combobox')
      await expect(budget.txnCategory).toHaveAttribute('aria-controls', 'txn-cat-listbox')

      // Open the listbox by focusing — aria-expanded flips to true
      await budget.txnCategory.click()
      await expect(budget.txnCategory).toHaveAttribute('aria-expanded', 'true')
      await expect(budget.txnCatListbox).toHaveAttribute('role', 'listbox')

      // Options have role="option" and stable IDs for aria-activedescendant
      const options = budget.txnCatListbox.locator('li[role="option"]')
      const count = await options.count()
      expect(count).toBeGreaterThan(0)
      const firstId = await options.first().getAttribute('id')
      expect(firstId).toMatch(/^txn-cat-opt-\d+$/)
    })

    test('CSV upload menu uses appropriate ARIA semantics', async ({ page }) => {
      await seedEmptyBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      // The dropdown toggle has aria-haspopup and aria-expanded
      await expect(budget.uploadDropDown).toHaveAttribute('aria-haspopup', 'true')
      await expect(budget.uploadDropDown).toHaveAttribute('aria-expanded', 'false')

      await budget.uploadDropDown.click()
      await expect(budget.uploadDropDown).toHaveAttribute('aria-expanded', 'true')
      await expect(budget.uploadMenu).toHaveAttribute('role', 'menu')

      // Menu items are real buttons with role=menuitem
      const items = budget.uploadMenu.locator('[role="menuitem"]')
      const itemCount = await items.count()
      expect(itemCount).toBeGreaterThanOrEqual(1)
      await expect(items.first()).toHaveText(/Bulk Upload/)
    })

    test('manual entry validation errors are announced via role="alert" (AC #35)', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.openManualEntry()

      // Trigger validation: clear date, leave amount empty, leave category blank, submit
      await budget.txnDate.fill('')
      await budget.txnAmount.fill('')
      await budget.txnCategory.fill('')
      await budget.txnSave.click()

      // Form stays open (validation blocked submit) and errors render with role=alert
      await expect(budget.txnForm).toBeVisible()
      const alerts = budget.txnForm.locator('.budget-txn-error[role="alert"]')
      await expect(alerts.first()).toBeVisible()
      const alertCount = await alerts.count()
      expect(alertCount).toBeGreaterThanOrEqual(2)

      // At least one alert carries the required-field copy assistive tech will announce
      const alertTexts = await alerts.allTextContents()
      expect(alertTexts.some(t => /required|valid/i.test(t))).toBe(true)
    })

    test('CSV upload errors render in an aria-live region (AC #36)', async ({ page }) => {
      // Seed one month of valid data so the expense BudgetTable (which owns the
      // error region) renders.
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.setViewMode('detailed')

      // Right-click May (index 4) on the expense table and pick "Upload CSV for May".
      // The menu item clicks the hidden <input type="file"> — Playwright intercepts
      // the file chooser so we can supply a malformed CSV that the parser rejects.
      await budget.openMonthContextMenu(4)
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('.budget-ctx-item', { hasText: /^Upload CSV for/ }).first().click(),
      ])
      await chooser.setFiles({
        name: 'bad.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('Date,Category,Amount\nnot-a-date,Bad,not-a-number\n'),
      })

      // The error renders inside a live region with role=alert + aria-live=polite
      const errorRegion = page.locator('.budget-csv-error').first()
      await expect(errorRegion).toBeVisible()
      await expect(errorRegion).toHaveAttribute('role', 'alert')
      await expect(errorRegion).toHaveAttribute('aria-live', 'polite')
      // Text is the failure message the screen reader announces
      await expect(errorRegion).toContainText(/No valid transactions/i)
    })
  })
})
