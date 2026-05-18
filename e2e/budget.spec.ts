import { test, expect } from '@playwright/test'
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
      if (stored) {
        const parsed = JSON.parse(stored)
        expect(parsed.csvs[`${CURRENT_YEAR}-05`]).toBeUndefined()
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

      // CSV should now reflect "Food" instead of "Groceries"
      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      const parsed = JSON.parse(stored!)
      const csv = parsed.csvs[`${CURRENT_YEAR}-05`].csv as string
      expect(csv).toContain('Food')
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

    test('manual entry: fields are focusable in order and category autocomplete works', async ({ page }) => {
      await seedKnownBudget(page)
      const budget = new BudgetPage(page)
      await budget.goto()

      await budget.openManualEntry()
      // Date field receives focus on open
      await expect(budget.txnDate).toBeFocused()

      // Each form field is individually focusable (focus() reliably puts focus
      // there even on date inputs that consume Tab for internal segments)
      await budget.txnDate.fill(`${CURRENT_YEAR}-05-18`)
      await budget.txnDesc.focus()
      await expect(budget.txnDesc).toBeFocused()
      await budget.txnDesc.fill('Test entry')
      await budget.txnAmount.focus()
      await expect(budget.txnAmount).toBeFocused()
      await budget.txnAmount.fill('-99')
      await budget.txnCategory.focus()
      await expect(budget.txnCategory).toBeFocused()

      // Type "G" — listbox shows matching options
      await page.keyboard.type('G')
      await expect(budget.txnCatListbox).toBeVisible()
      const options = budget.txnCatListbox.locator('li[role="option"]')
      const optionCount = await options.count()
      expect(optionCount).toBeGreaterThan(0)

      // First option is auto-highlighted on type — press Enter to select
      await page.keyboard.press('Enter')
      await expect(budget.txnCategory).not.toHaveValue('')
      await expect(budget.txnCategory).not.toHaveValue('G')

      // Submit and verify storage updates
      await budget.txnSave.click()
      const stored = await page.evaluate(() => localStorage.getItem('budget-store'))
      const parsed = JSON.parse(stored!)
      expect(parsed.csvs[`${CURRENT_YEAR}-05`].csv).toContain('Test entry')
    })
  })

  test.describe('Event Propagation', () => {
    test('budget-summary key is updated after a CSV import (cross-page propagation)', async ({ page }) => {
      await seedEmptyBudget(page)
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

      // Wait for the summary to be persisted (set inside a useEffect after summary calc)
      await expect
        .poll(async () => {
          const raw = await page.evaluate(() => localStorage.getItem('budget-summary'))
          if (!raw) return null
          return JSON.parse(raw)
        })
        .toMatchObject({})

      const summary = await page.evaluate(() => JSON.parse(localStorage.getItem('budget-summary') || '{}'))
      expect(summary.saveRate).toBeGreaterThan(0.3) // (8000-5000)/8000 = 37.5%
      expect(summary.saveRate).toBeLessThan(0.5)
      expect(summary.monthsOfData).toBe(1)

      // Navigate to Home and verify the budget-summary survives (cross-page read works)
      await page.goto('/finance-tracking/#/')
      await page.waitForLoadState('domcontentloaded')
      const summaryAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('budget-summary') || '{}'))
      expect(summaryAfter.saveRate).toBeCloseTo(summary.saveRate, 5)
    })
  })

  test.describe('Dark Mode', () => {
    test('budget table renders correctly in dark mode', async ({ page }) => {
      const store = knownBudgetStore()
      await seedBudget(page, { store, config: configFromStore(store), darkMode: true })

      const budget = new BudgetPage(page)
      await budget.goto()
      await budget.setViewMode('detailed')

      const hasDark = await page.evaluate(() => document.body.classList.contains('dark'))
      expect(hasDark).toBe(true)

      // Summary cards are visible and readable (non-empty values)
      await expect(budget.incomeValue).toContainText('$10,000')

      // Compute contrast for a category cell: must have non-empty bg + text colors
      const cellStyles = await page.evaluate(() => {
        const cell = document.querySelector('.budget-td--category-name') as HTMLElement | null
        if (!cell) return null
        const cs = getComputedStyle(cell)
        return { color: cs.color, backgroundColor: cs.backgroundColor }
      })
      expect(cellStyles).not.toBeNull()
      expect(cellStyles!.color).not.toBe('')
      // Text color is not transparent
      expect(cellStyles!.color).not.toBe('rgba(0, 0, 0, 0)')
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
  })
})
