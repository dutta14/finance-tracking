import { test, expect } from '@playwright/test'
import { DrivePage } from './pages/drive.page'
import {
  APR_2024_CSV,
  APR_2024_FILENAME,
  FIXTURE_YEAR,
  JAN_2024_ROWS,
  SORT_FILE_A,
  SORT_FILE_B,
  SORT_FILE_C,
  SORT_PROFILE,
  seedDrive,
  seedDriveData,
  seedDriveEmpty,
  seedDriveWithOwners,
} from './fixtures/drive.fixtures'

test.describe('Drive — File Manager E2E', () => {
  test.describe('Folder navigation', () => {
    test('1. Drive page shows folder tree organized by year', async ({ page }) => {
      // Drive's buildBudgetTree wraps year folders inside a top-level "Budget"
      // folder, so the year folder is visible after navigating into Budget.
      // We assert both halves of the tree are reachable: top-level "Budget"
      // at /drive, and year "2024" at /drive/budget.
      await seedDriveData(page)
      const drive = new DrivePage(page)
      await drive.goto()

      await expect(drive.folder('Budget')).toBeVisible()

      await drive.goto('budget')
      await expect(page).toHaveURL(/#\/drive\/budget$/)
      await expect(drive.folder('2024')).toBeVisible()
      // The three seeded months become files inside /drive/budget/2024.
      // Default sort is by display name (alphabetical), so Feb < Jan < Mar.
      await drive.goto('budget/2024')
      const names = await drive.fileRowNames()
      expect(names).toEqual(['Feb 2024', 'Jan 2024', 'Mar 2024'])
    })

    test('2. Clicking a folder navigates into it (URL updates and breadcrumb appears)', async ({ page }) => {
      await seedDriveData(page)
      const drive = new DrivePage(page)
      await drive.goto('budget')

      // At /drive/budget, the breadcrumb has Drive > Budget; clicking the
      // 2024 folder must update the URL and extend the breadcrumb.
      await drive.folder('2024').click()
      await expect(page).toHaveURL(/#\/drive\/budget\/2024$/)
      await expect(drive.crumb('Drive')).toBeVisible()
      await expect(drive.crumb('Budget')).toBeVisible()
      await expect(drive.crumb('2024')).toBeVisible()
      // The active crumb is 2024.
      await expect(drive.breadcrumb.locator('.drive-breadcrumb-item.active')).toHaveText('2024')
    })

    test('3. Clicking back (..) row returns to the parent directory', async ({ page }) => {
      await seedDriveData(page)
      const drive = new DrivePage(page)
      await drive.goto('budget/2024')

      // The .. row is the in-list back affordance (test 9 covers the browser
      // back button separately).
      await expect(drive.backRow).toBeVisible()
      await drive.backRow.click()
      await expect(page).toHaveURL(/#\/drive\/budget$/)
      await expect(drive.folder('2024')).toBeVisible()

      // Going up once more lands at root, where the .. row is absent.
      await drive.backRow.click()
      await expect(page).toHaveURL(/#\/drive$/)
      await expect(drive.folder('Budget')).toBeVisible()
      await expect(drive.backRow).toHaveCount(0)
    })
  })

  test.describe('File preview', () => {
    test('4. Clicking a CSV file opens the CSVViewer with parsed contents', async ({ page }) => {
      await seedDriveData(page)
      const drive = new DrivePage(page)
      await drive.goto('budget/2024')

      await drive.file('Jan 2024').click()
      await expect(page).toHaveURL(/#\/drive\/budget\/2024\/2024-01$/)
      await expect(drive.viewer).toBeVisible()
      await expect(drive.viewerTitle).toHaveText('Jan 2024')
      await expect(drive.viewerTable).toBeVisible()

      // Header row matches the seeded CSV header columns exactly.
      // allTextContents returns DOM text (uppercase CSS transform is visual only).
      const headerTexts = await drive.viewerTable.locator('thead th').allTextContents()
      expect(headerTexts).toEqual(['Date', 'Category', 'Amount', 'Description'])

      // Body rows match the seeded data (3 rows, in seeded order).
      const bodyRows = await drive.viewerTable.locator('tbody tr').all()
      expect(bodyRows).toHaveLength(JAN_2024_ROWS.length)
      for (let i = 0; i < JAN_2024_ROWS.length; i++) {
        const cells = await bodyRows[i].locator('td').allInnerTexts()
        const row = JAN_2024_ROWS[i]
        expect(cells).toEqual([row.date, row.category, String(row.amount), row.description ?? ''])
      }

      // The viewer's meta line reports the row count.
      await expect(page.locator('.drive-viewer-meta')).toHaveText(`${JAN_2024_ROWS.length} rows`)
    })
  })

  test.describe('Upload flow', () => {
    test('5. Drag-and-drop upload triggers CSVPreviewModal with parsed content', async ({ page }) => {
      await seedDriveData(page)
      const drive = new DrivePage(page)
      // Drop zone is only rendered when !isRoot, so navigate into a folder.
      await drive.goto('budget/2024')
      await expect(drive.dropZone).toBeVisible()

      await drive.dropCsvFile(APR_2024_FILENAME, APR_2024_CSV)

      await expect(drive.previewModal).toBeVisible()
      // Month label is derived from the filename's YYYY-MM (Apr 2024).
      await expect(drive.previewModalHeading).toHaveText('Preview — Apr 2024')
      // Modal meta line reports 2 rows × 4 columns from APR_2024_CSV.
      await expect(drive.previewModal.locator('.csv-preview-meta')).toHaveText('2 rows · 4 columns')
      // Header columns and a row value from the dropped file are rendered.
      const headerTexts = await drive.previewModal.locator('.csv-preview-table thead th .csv-col-name').allInnerTexts()
      expect(headerTexts).toEqual(['Date', 'Category', 'Amount', 'Description'])
      await expect(drive.previewModal.locator('.csv-preview-table tbody')).toContainText('Trader Joes')
      await expect(drive.previewModal.locator('.csv-preview-table tbody')).toContainText('8100')
    })

    test('6. File upload via hidden input also triggers the import preview flow', async ({ page }) => {
      await seedDriveData(page)
      const drive = new DrivePage(page)
      // Different entry point than test 5 (setInputFiles, not synthesized
      // DataTransfer drop) — but the rendered preview content must match.
      await drive.goto('budget/2024')
      await expect(drive.fileInput).toHaveCount(1)

      await drive.uploadCsvViaInput(APR_2024_FILENAME, APR_2024_CSV)

      await expect(drive.previewModal).toBeVisible()
      await expect(drive.previewModalHeading).toHaveText('Preview — Apr 2024')
      await expect(drive.previewModal.locator('.csv-preview-meta')).toHaveText('2 rows · 4 columns')
      const headerTexts = await drive.previewModal.locator('.csv-preview-table thead th .csv-col-name').allInnerTexts()
      expect(headerTexts).toEqual(['Date', 'Category', 'Amount', 'Description'])
      await expect(drive.previewModal.locator('.csv-preview-table tbody')).toContainText('Trader Joes')
    })
  })

  test.describe('Empty state', () => {
    test('7. Drive shows no files and no year folders when nothing has been uploaded', async ({ page }) => {
      // ADAPTATION: buildBudgetTree always pushes a top-level "Budget"
      // folder, so the .drive-empty message in Drive.tsx is unreachable
      // under realistic data. The empty state the user actually sees is:
      // a single "Budget" folder at /drive with "0 items", and zero file
      // rows anywhere in the tree. Filed follow-up to revisit the dead
      // .drive-empty branch (see report).
      await seedDriveEmpty(page)
      const drive = new DrivePage(page)
      await drive.goto()

      // Root shows only the empty Budget folder, with explicit "0 items" meta.
      await expect(drive.folder('Budget')).toBeVisible()
      await expect(drive.folder('Budget').locator('.drive-row-meta')).toHaveText('0 items')
      // Zero CSV files anywhere on the page.
      await expect(page.locator('.drive-row--file')).toHaveCount(0)

      // Drilling into the empty Budget folder shows no folders, no files,
      // just the .. back row and the drop zone prompt.
      await drive.folder('Budget').click()
      await expect(page).toHaveURL(/#\/drive\/budget$/)
      await expect(drive.backRow).toBeVisible()
      await expect(page.locator('.drive-row--folder')).toHaveCount(0)
      await expect(page.locator('.drive-row--file')).toHaveCount(0)
      await expect(drive.dropZone).toBeVisible()
      await expect(drive.dropZone).toContainText(/Drag & drop CSV files/)
    })
  })

  test.describe('Sorting', () => {
    test('8. Sorting by name, owner, and date each produces a distinct file order', async ({ page }) => {
      // Files with meta.owner come from the tax-store branch of the tree.
      // The fixture is designed so name/owner/date give three orthogonal
      // orderings (see drive.fixtures.ts SORT_FILE_* definitions).
      await seedDriveWithOwners(page)
      const drive = new DrivePage(page)
      await drive.goto(`taxes/${FIXTURE_YEAR}`)

      // All three sort controls are rendered (filter bar visibility depends
      // on hasMetaFiles being true).
      await expect(drive.sortByName).toBeVisible()
      await expect(drive.sortByOwner).toBeVisible()
      await expect(drive.sortByDate).toBeVisible()

      // Default sort is by name. Source: Drive.tsx initial sortField = 'name'.
      await expect(drive.sortByName).toHaveClass(/\bactive\b/)
      const byNameInitial = await drive.fileRowNames()
      expect(byNameInitial).toEqual([SORT_FILE_B.name, SORT_FILE_C.name, SORT_FILE_A.name])

      // Owner sort: ownerLabel(primary)=Alex, joint=Joint, partner=Sam.
      // Alphabetical Alex < Joint < Sam → file A, file C, file B.
      await drive.sortByOwner.click()
      await expect(drive.sortByOwner).toHaveClass(/\bactive\b/)
      await expect.poll(() => drive.fileRowNames()).toEqual([SORT_FILE_A.name, SORT_FILE_C.name, SORT_FILE_B.name])
      // Sanity: each row carries the expected owner tag.
      await expect(drive.file(SORT_FILE_A.name).locator('.drive-row-tag').first()).toHaveText(SORT_PROFILE.name)
      await expect(drive.file(SORT_FILE_C.name).locator('.drive-row-tag').first()).toHaveText('Joint')
      await expect(drive.file(SORT_FILE_B.name).locator('.drive-row-tag').first()).toHaveText(SORT_PROFILE.partner!.name)

      // Date sort: newest uploadedAt first → B (Mar), C (Feb), A (Jan).
      await drive.sortByDate.click()
      await expect(drive.sortByDate).toHaveClass(/\bactive\b/)
      await expect.poll(() => drive.fileRowNames()).toEqual([SORT_FILE_B.name, SORT_FILE_C.name, SORT_FILE_A.name])

      // Re-selecting name returns to the original alphabetic order, and the
      // previous (date) sort is no longer active.
      await drive.sortByName.click()
      await expect(drive.sortByName).toHaveClass(/\bactive\b/)
      await expect(drive.sortByDate).not.toHaveClass(/\bactive\b/)
      await expect.poll(() => drive.fileRowNames()).toEqual([SORT_FILE_B.name, SORT_FILE_C.name, SORT_FILE_A.name])
    })
  })

  test.describe('Browser navigation', () => {
    test('9. Browser back and forward update both URL and visible folder contents', async ({ page }) => {
      // Seed budget data so each navigation step has a distinguishable URL/content signature.
      await seedDrive(page, {
        store: {
          csvs: {
            '2024-01': { month: '2024-01', csv: 'Date,Category,Amount\n2024-01-01,Salary,1', uploadedAt: '2024-01-15T00:00:00.000Z' },
          },
          configs: {},
          years: [2024],
        },
      })

      const drive = new DrivePage(page)
      await drive.goto()
      await expect(page).toHaveURL(/#\/drive$/)
      await expect(drive.folder('Budget')).toBeVisible()

      // Step into Budget, then into 2024 — building a 3-step history.
      await drive.folder('Budget').click()
      await expect(page).toHaveURL(/#\/drive\/budget$/)
      await expect(drive.folder('2024')).toBeVisible()

      await drive.folder('2024').click()
      await expect(page).toHaveURL(/#\/drive\/budget\/2024$/)
      await expect(drive.file('Jan 2024')).toBeVisible()

      // Back: 2024 → budget. URL AND visible content both rewind.
      await page.goBack()
      await expect(page).toHaveURL(/#\/drive\/budget$/)
      await expect(drive.folder('2024')).toBeVisible()
      await expect(drive.file('Jan 2024')).toHaveCount(0)

      // Back again: budget → root.
      await page.goBack()
      await expect(page).toHaveURL(/#\/drive$/)
      await expect(drive.folder('Budget')).toBeVisible()
      await expect(drive.folder('2024')).toHaveCount(0)

      // Forward: root → budget, content matches the prior /drive/budget state.
      await page.goForward()
      await expect(page).toHaveURL(/#\/drive\/budget$/)
      await expect(drive.folder('2024')).toBeVisible()

      // Forward: budget → 2024, file list reappears.
      await page.goForward()
      await expect(page).toHaveURL(/#\/drive\/budget\/2024$/)
      await expect(drive.file('Jan 2024')).toBeVisible()
    })
  })
})
