/**
 * Capture-screenshots.ts
 *
 * Renders the finance-tracking app under Playwright with a fixed fake persona
 * ("Avery Chen") and writes 12 PNGs into docs/screenshots/ used by the user README.
 *
 * Assumes the Vite dev server is already running at http://localhost:5173/finance-tracking/
 * (run `npm run dev` in another terminal first). The npm script `npm run screenshots`
 * is the canonical entry point.
 *
 * The script disables encryption (`encryption-enabled` = '0') so it can seed plaintext
 * via localStorage. addInitScript runs on every navigation, so the seed survives reloads.
 */

import { chromium, type Page, type Browser } from '@playwright/test'
import { mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const OUT_DIR = join(__dirname, '..', 'docs', 'screenshots')
const APP_URL = 'http://localhost:5173/finance-tracking/'
const VIEWPORT = { width: 1440, height: 900 }
const DEVICE_SCALE_FACTOR = 2

/* ── Fake persona: "Avery Chen" ──────────────────────────────────
 *
 * Numbers are plausibly real (not round, not too neat) but obviously
 * synthetic. Six months of balance history with realistic growth.
 * Sum of latest month ≈ $287,000.
 */

const PROFILE = { name: 'Avery Chen', avatarDataUrl: '', birthday: '1990-08-22' }

// IDs are stable across all seeds so balance.accountId resolves consistently.
const ACCOUNTS = [
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
  {
    id: 2,
    name: 'Roth IRA',
    type: 'retirement',
    owner: 'primary',
    status: 'active',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'intl-stock',
    institution: 'Vanguard',
    group: 'Retirement',
  },
  {
    id: 3,
    name: 'Brokerage',
    type: 'non-retirement',
    owner: 'primary',
    status: 'active',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'us-stock',
    institution: 'Schwab',
    group: 'Taxable',
  },
  {
    id: 4,
    name: 'High-Yield Savings',
    type: 'liquid',
    owner: 'primary',
    status: 'active',
    goalType: 'gw',
    nature: 'asset',
    allocation: 'cash',
    institution: 'Marcus',
    group: 'Cash',
  },
  {
    id: 5,
    name: 'Checking',
    type: 'liquid',
    owner: 'primary',
    status: 'active',
    goalType: 'gw',
    nature: 'asset',
    allocation: 'cash',
    institution: 'Chase',
    group: 'Cash',
  },
  {
    id: 6,
    name: 'Home Equity',
    type: 'real-estate',
    owner: 'primary',
    status: 'active',
    goalType: 'gw',
    nature: 'asset',
    allocation: 'real-estate',
    institution: 'Property',
    group: 'Real Estate',
  },
]

// Six months ending May 2025. Monthly target totals:
// Dec 2024 ≈ $260,400, Jan 2025 ≈ $265,700, Feb ≈ $271,300,
// Mar ≈ $276,900, Apr ≈ $282,100, May ≈ $287,000.
const BALANCES = [
  // May 2025 — current month: $287,000
  { id: 1, accountId: 1, month: '2025-05', balance: 142_000 },
  { id: 2, accountId: 2, month: '2025-05', balance: 48_000 },
  { id: 3, accountId: 3, month: '2025-05', balance: 61_000 },
  { id: 4, accountId: 4, month: '2025-05', balance: 18_500 },
  { id: 5, accountId: 5, month: '2025-05', balance: 4_200 },
  { id: 6, accountId: 6, month: '2025-05', balance: 13_300 },
  // April 2025: ~$282,100
  { id: 7, accountId: 1, month: '2025-04', balance: 139_400 },
  { id: 8, accountId: 2, month: '2025-04', balance: 47_100 },
  { id: 9, accountId: 3, month: '2025-04', balance: 59_800 },
  { id: 10, accountId: 4, month: '2025-04', balance: 18_200 },
  { id: 11, accountId: 5, month: '2025-04', balance: 4_350 },
  { id: 12, accountId: 6, month: '2025-04', balance: 13_250 },
  // March 2025: ~$276,900
  { id: 13, accountId: 1, month: '2025-03', balance: 136_800 },
  { id: 14, accountId: 2, month: '2025-03', balance: 46_300 },
  { id: 15, accountId: 3, month: '2025-03', balance: 58_200 },
  { id: 16, accountId: 4, month: '2025-03', balance: 17_900 },
  { id: 17, accountId: 5, month: '2025-03', balance: 4_500 },
  { id: 18, accountId: 6, month: '2025-03', balance: 13_200 },
  // February 2025: ~$271,300
  { id: 19, accountId: 1, month: '2025-02', balance: 134_100 },
  { id: 20, accountId: 2, month: '2025-02', balance: 45_400 },
  { id: 21, accountId: 3, month: '2025-02', balance: 56_500 },
  { id: 22, accountId: 4, month: '2025-02', balance: 17_500 },
  { id: 23, accountId: 5, month: '2025-02', balance: 4_650 },
  { id: 24, accountId: 6, month: '2025-02', balance: 13_150 },
  // January 2025: ~$265,700
  { id: 25, accountId: 1, month: '2025-01', balance: 131_500 },
  { id: 26, accountId: 2, month: '2025-01', balance: 44_500 },
  { id: 27, accountId: 3, month: '2025-01', balance: 54_700 },
  { id: 28, accountId: 4, month: '2025-01', balance: 17_100 },
  { id: 29, accountId: 5, month: '2025-01', balance: 4_800 },
  { id: 30, accountId: 6, month: '2025-01', balance: 13_100 },
  // December 2024: ~$260,400
  { id: 31, accountId: 1, month: '2024-12', balance: 129_000 },
  { id: 32, accountId: 2, month: '2024-12', balance: 43_700 },
  { id: 33, accountId: 3, month: '2024-12', balance: 53_100 },
  { id: 34, accountId: 4, month: '2024-12', balance: 16_700 },
  { id: 35, accountId: 5, month: '2024-12', balance: 4_850 },
  { id: 36, accountId: 6, month: '2024-12', balance: 13_050 },
]

// Single FI goal: $1.25M (25× annual expenses of $50k). Numbers tuned so the
// projection page shows a meaningful "on track" trajectory rather than empty
// extremes.
const GOALS = [
  {
    id: 1,
    goalName: 'Financial Independence',
    createdAt: '2022-01-15T00:00:00.000Z',
    birthday: '1990-08-22',
    goalCreatedIn: '2022-01',
    goalEndYear: '2045',
    resetExpenseMonth: false,
    retirementAge: 55,
    expenseMonth: 5,
    expenseValue: 74_400,
    monthlyExpenseValue: 6_200,
    expenseValueMar2026: 76_632,
    expenseValue2047: 142_500,
    monthlyExpense2047: 11_875,
    inflationRate: 3,
    safeWithdrawalRate: 4,
    growth: 7,
    retirement: '2045-08',
    fiGoal: 1_250_000,
    progress: 23,
  },
]

const GW_GOALS: Array<Record<string, unknown>> = []

// One month of categorized transactions. Salary + side income on top, fixed and
// variable expenses below. Numbers tuned so the savings rate computes to ~37%:
//   income  = 9,800 + 600 = 10,400
//   expense = 2,150 + 1,800 + 145 + 320 + 410 + 245 + 92 + 67 + 1,260 = 6,489
//   savings = 3,911  →  ~37.6%
const BUDGET_CSV_MAY = [
  'Date,Category,Amount,Description',
  '2025-05-01,Salary,9800,Acme Payroll',
  '2025-05-15,Side Income,600,Freelance writeup',
  '2025-05-01,Rent,-2150,Apartment',
  '2025-05-03,Groceries,-187.42,Trader Joes',
  '2025-05-04,Subscriptions,-14.99,Streaming',
  '2025-05-06,Dining,-62.18,Sushi night',
  '2025-05-07,Transport,-48.30,Gas station',
  '2025-05-08,Utilities,-92.47,Electric',
  '2025-05-10,Groceries,-143.85,Whole Foods',
  '2025-05-11,Dining,-31.42,Coffee shop',
  '2025-05-12,Subscriptions,-9.99,Music',
  '2025-05-13,Subscriptions,-22.00,Gym',
  '2025-05-14,Transport,-65.10,Rideshare',
  '2025-05-16,Groceries,-78.93,Local market',
  '2025-05-18,Utilities,-52.84,Internet',
  '2025-05-19,Dining,-51.46,Restaurant',
  '2025-05-20,Transport,-22.40,Bus pass',
  '2025-05-21,Groceries,-91.13,Trader Joes',
  '2025-05-22,Subscriptions,-95.00,Cloud storage',
  '2025-05-24,Dining,-72.84,Brunch',
  '2025-05-25,Transport,-89.20,Car maintenance',
  '2025-05-26,Health,-1260,Dental work',
  '2025-05-28,Groceries,-67.18,Costco',
  '2025-05-30,Dining,-47.10,Takeout',
].join('\n')

const BUDGET_CSV_APR = [
  'Date,Category,Amount,Description',
  '2025-04-01,Salary,9800,Acme Payroll',
  '2025-04-12,Side Income,425,Freelance',
  '2025-04-01,Rent,-2150,Apartment',
  '2025-04-03,Groceries,-142.18,Whole Foods',
  '2025-04-06,Dining,-58.94,Restaurant',
  '2025-04-08,Utilities,-88.31,Electric',
  '2025-04-10,Transport,-55.20,Gas station',
  '2025-04-15,Subscriptions,-46.99,Streaming bundle',
  '2025-04-18,Groceries,-103.42,Costco',
  '2025-04-22,Dining,-41.30,Coffee',
  '2025-04-25,Transport,-72.80,Rideshare',
].join('\n')

const BUDGET_STORE = {
  csvs: {
    '2025-04': { month: '2025-04', csv: BUDGET_CSV_APR, uploadedAt: '2025-05-02T00:00:00.000Z' },
    '2025-05': { month: '2025-05', csv: BUDGET_CSV_MAY, uploadedAt: '2025-06-01T00:00:00.000Z' },
  },
  configs: {},
  years: [2025],
}

const BUDGET_CONFIG = {
  version: 1,
  years: [2025],
  categoryGroups: [
    { id: 'income', name: 'Income', categories: ['Salary', 'Side Income'] },
    { id: 'housing', name: 'Housing', categories: ['Rent', 'Utilities'] },
    { id: 'food', name: 'Food', categories: ['Groceries', 'Dining'] },
    { id: 'transport', name: 'Transport', categories: ['Transport'] },
    { id: 'subscriptions', name: 'Subscriptions', categories: ['Subscriptions'] },
    { id: 'health', name: 'Health', categories: ['Health'] },
    { id: 'others', name: 'Others', categories: [] },
    { id: 'removed', name: 'Remove from Budget', categories: [] },
  ],
}

const BUDGET_SUMMARY = {
  annualSavings: 43_200,
  saveRate: 37,
  monthsOfData: 6,
}

// Tax checklist for the current (clock-pinned) year 2025 — half the items "done"
// (files attached) to show a mixed-progress state in screenshots.
const TAX_STORE = {
  years: {
    2025: {
      items: [
        {
          id: 'tax-1',
          label: 'W-2 (Acme Corp)',
          owner: 'primary',
          category: 'paystub',
          accountIds: [],
          files: [
            {
              id: 'f1',
              name: 'w2-acme-2025.pdf',
              content: undefined,
              ext: 'pdf',
              uploadedAt: '2026-02-10T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'tax-2',
          label: '1099-INT (High-Yield Savings)',
          owner: 'primary',
          category: 'account',
          accountIds: [4],
          files: [
            {
              id: 'f2',
              name: '1099-int-marcus.pdf',
              content: undefined,
              ext: 'pdf',
              uploadedAt: '2026-02-12T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'tax-3',
          label: '1099-DIV (Brokerage)',
          owner: 'primary',
          category: 'account',
          accountIds: [3],
          files: [
            {
              id: 'f3',
              name: '1099-div-schwab.pdf',
              content: undefined,
              ext: 'pdf',
              uploadedAt: '2026-02-15T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'tax-4',
          label: '1099-R (401k)',
          owner: 'primary',
          category: 'account',
          accountIds: [1],
          files: [],
        },
        { id: 'tax-5', label: 'Mortgage interest (1098)', owner: 'primary', category: 'custom', accountIds: [], files: [] },
        { id: 'tax-6', label: 'Charitable donations', owner: 'primary', category: 'custom', accountIds: [], files: [] },
        {
          id: 'tax-7',
          label: 'Previous-year tax return',
          owner: 'primary',
          category: 'tax-return',
          accountIds: [],
          files: [
            {
              id: 'f4',
              name: 'tax-return-2024.pdf',
              content: undefined,
              ext: 'pdf',
              uploadedAt: '2025-04-15T00:00:00.000Z',
            },
          ],
        },
        { id: 'tax-8', label: 'HSA contributions (5498-SA)', owner: 'primary', category: 'custom', accountIds: [], files: [] },
      ],
    },
  },
}

const GH_CONFIG = {
  owner: 'avery-chen',
  repo: 'finance-vault',
  filePath: 'finance-goals.json',
  autoSync: true,
}

/* ── Seeding ─────────────────────────────────────────────────── */

interface SeedFlags {
  darkMode?: boolean
  /** Seed accounts (default true). */
  accounts?: boolean
  /** Seed balances (default true). */
  balances?: boolean
  /** Seed goals (default true). */
  goals?: boolean
  /** Seed budget store + config + summary (default true). */
  budget?: boolean
  /** Seed tax store (default true). */
  taxes?: boolean
  /** Seed profile (default true). */
  profile?: boolean
  /** Seed GitHub config (default true). */
  github?: boolean
  /** Dismiss onboarding banner (default true). */
  onboardingDismissed?: boolean
}

async function seed(page: Page, flags: SeedFlags = {}): Promise<void> {
  const {
    darkMode = false,
    accounts = true,
    balances = true,
    goals = true,
    budget = true,
    taxes = true,
    profile = true,
    github = true,
    onboardingDismissed = true,
  } = flags

  await page.addInitScript(
    ({ flags, data }) => {
      localStorage.clear()
      // Disable encryption so appStorage reads/writes plaintext for seeded keys.
      localStorage.setItem('encryption-enabled', '0')
      localStorage.setItem('darkMode', flags.darkMode ? '1' : '0')
      localStorage.setItem('onboarding-dismissed', flags.onboardingDismissed ? '1' : '0')

      if (flags.profile) localStorage.setItem('user-profile', JSON.stringify(data.profile))
      if (flags.accounts) localStorage.setItem('data-accounts', JSON.stringify(data.accounts))
      if (flags.balances) localStorage.setItem('data-balances', JSON.stringify(data.balances))
      if (flags.goals) {
        localStorage.setItem('financialGoals', JSON.stringify(data.goals))
        localStorage.setItem('gw-goals', JSON.stringify(data.gwGoals))
      }
      if (flags.budget) {
        localStorage.setItem('budget-store', JSON.stringify(data.budgetStore))
        localStorage.setItem('budget-config', JSON.stringify(data.budgetConfig))
        localStorage.setItem('budget-summary', JSON.stringify(data.budgetSummary))
      }
      if (flags.taxes) localStorage.setItem('tax-store', JSON.stringify(data.taxStore))
      if (flags.github) localStorage.setItem('github-sync-config', JSON.stringify(data.ghConfig))
    },
    {
      flags: { darkMode, accounts, balances, goals, budget, taxes, profile, github, onboardingDismissed },
      data: {
        profile: PROFILE,
        accounts: ACCOUNTS,
        balances: BALANCES,
        goals: GOALS,
        gwGoals: GW_GOALS,
        budgetStore: BUDGET_STORE,
        budgetConfig: BUDGET_CONFIG,
        budgetSummary: BUDGET_SUMMARY,
        taxStore: TAX_STORE,
        ghConfig: GH_CONFIG,
      },
    },
  )
}

/* ── Page helpers ────────────────────────────────────────────── */

/**
 * Wait for the app shell + fonts + at least one SVG (chart) to render. Avoids
 * flaky waitForTimeout. Times out after 15s in case a screen has no SVG.
 */
async function settle(page: Page, opts: { expectSvg?: boolean } = {}): Promise<void> {
  const { expectSvg = true } = opts
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  // Suppress all animations and transitions for deterministic screenshots.
  await page.addStyleTag({
    content:
      '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; } ' +
      'input, textarea { caret-color: transparent !important; }',
  })
  if (expectSvg) {
    await page
      .waitForFunction(() => document.querySelectorAll('svg').length > 0, undefined, { timeout: 5000 })
      .catch(() => {
        /* swallow — some screens render without SVGs */
      })
  }
  // Tiny settling pause for React Suspense + Recharts ResizeObserver rAF cycles.
  await page.waitForTimeout(400)
}

async function snap(page: Page, filename: string, opts: { fullPage?: boolean } = {}): Promise<void> {
  const path = join(OUT_DIR, filename)
  await page.screenshot({ path, fullPage: opts.fullPage ?? false, type: 'png', animations: 'disabled' })
  const bytes = statSync(path).size
  console.log(`  ✓ ${filename}  (${(bytes / 1024).toFixed(1)} KB)`)
}

async function navigate(page: Page, hash: string): Promise<void> {
  await page.goto(APP_URL + '#' + hash, { waitUntil: 'domcontentloaded' })
}

/* ── Captures ────────────────────────────────────────────────── */

async function captureHome(page: Page, mode: 'light' | 'dark'): Promise<void> {
  await seed(page, { darkMode: mode === 'dark' })
  await navigate(page, '/')
  await page.waitForSelector('.app-layout', { timeout: 10_000 })
  await page.waitForSelector('main.main-content', { timeout: 10_000 })
  await settle(page)
  // Sanity check: dark mode must apply body.dark before the shot.
  if (mode === 'dark') {
    const hasDark = await page.evaluate(() => document.body.classList.contains('dark'))
    if (!hasDark) throw new Error('Dark mode screenshot taken without body.dark class')
  }
  await snap(page, `home-${mode}.png`, { fullPage: false })
}

async function captureNetWorth(page: Page): Promise<void> {
  await seed(page)
  await navigate(page, '/net-worth')
  await page.waitForSelector('.app-layout', { timeout: 10_000 })
  await settle(page)
  // Switch to spreadsheet view so the multi-account, multi-month grid is the focal point.
  const spreadsheetTab = page.locator('button.data-view-tab', { hasText: 'Spreadsheet' })
  await spreadsheetTab.waitFor({ state: 'visible', timeout: 5_000 })
  await spreadsheetTab.click()
  await page
    .locator('button.data-view-tab.active', { hasText: 'Spreadsheet' })
    .waitFor({ state: 'visible', timeout: 5_000 })
  await settle(page, { expectSvg: false })
  await snap(page, 'networth.png', { fullPage: true })
}

async function captureGoals(page: Page): Promise<void> {
  await seed(page)
  // Open the Calculator route directly — the FI calculator is more visually rich
  // than the empty Plans list with a single goal card.
  await navigate(page, '/goal/calculator')
  await page.waitForSelector('.app-layout', { timeout: 10_000 })
  await page.waitForSelector('.goal-tab.active', { timeout: 5_000 }).catch(() => {})
  await settle(page)
  await snap(page, 'goals.png', { fullPage: true })
}

async function captureBudget(page: Page): Promise<void> {
  await seed(page)
  await navigate(page, '/budget')
  await page.waitForSelector('.app-layout', { timeout: 10_000 })
  // Try to land on detailed view if a view toggle is present.
  const detailedTab = page.locator('button', { hasText: /^Detailed$/ })
  if (await detailedTab.count()) await detailedTab.first().click().catch(() => {})
  await settle(page)
  await snap(page, 'budget.png', { fullPage: true })
}

async function captureTaxes(page: Page): Promise<void> {
  await seed(page)
  await navigate(page, '/taxes')
  await page.waitForSelector('.app-layout', { timeout: 10_000 })
  await settle(page, { expectSvg: false })
  await snap(page, 'taxes.png', { fullPage: true })
}

async function captureSettings(page: Page): Promise<void> {
  await seed(page)
  await navigate(page, '/')
  await page.waitForSelector('.app-layout', { timeout: 10_000 })
  await settle(page)
  // Open the Settings modal via the sidebar footer button, then GitHub Sync tab.
  await page.locator('button[aria-label="Settings"]').first().click()
  await page.waitForSelector('.settings-modal', { timeout: 5_000 })
  const ghTab = page.locator('.settings-modal-nav button', { hasText: 'GitHub Sync' })
  await ghTab.first().click()
  await page.waitForTimeout(300)
  await settle(page, { expectSvg: false })
  await snap(page, 'settings.png', { fullPage: false })
}

/* ── Quick-start screenshots ─────────────────────────────────── */

async function captureQuickstart1(page: Page): Promise<void> {
  // First-open empty state: nothing seeded, encryption disabled so unlock screen
  // doesn't block. Onboarding banner visible.
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '0')
    localStorage.setItem('onboarding-dismissed', '0')
  })
  await navigate(page, '/')
  await page.waitForSelector('.app-layout', { timeout: 10_000 })
  await settle(page, { expectSvg: false })
  await snap(page, 'quickstart-1.png', { fullPage: false })
}

async function captureQuickstart2(page: Page): Promise<void> {
  // Passphrase setup / unlock prompt — gating screen with encryption enabled and
  // a salt present, so the EncryptionProvider renders <UnlockScreen/>.
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('encryption-enabled', '1')
    // Salt and verify envelope must exist for the unlock UI to render in its
    // "ready to unlock" state. The values themselves don't matter because we
    // never submit the form in screenshot mode.
    localStorage.setItem('encryption-salt', 'AAAAAAAAAAAAAAAAAAAAAA==')
    localStorage.setItem(
      'encryption-verify',
      JSON.stringify({ iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }),
    )
  })
  await navigate(page, '/')
  await page.waitForSelector('.unlock-screen', { timeout: 10_000 })
  await settle(page, { expectSvg: false })
  await snap(page, 'quickstart-2.png', { fullPage: false })
}

async function captureQuickstart3(page: Page): Promise<void> {
  // Add Account form with sample data filled in. Start from net-worth empty state,
  // open the AccountsModal, then click the in-modal "+ Add Account" to reveal the form.
  await seed(page, { accounts: false, balances: false, budget: false, taxes: false, goals: false })
  await navigate(page, '/net-worth')
  await page.waitForSelector('.app-layout', { timeout: 10_000 })
  await settle(page, { expectSvg: false })
  // Empty-state CTA opens the AccountsModal.
  await page.locator('button.data-add-btn', { hasText: 'Add Account' }).first().click()
  // The modal opens with no accounts; click its inner "+ Add Account" to reveal AccountForm.
  const innerAddBtn = page.locator('button', { hasText: /\+ Add Account/ }).last()
  await innerAddBtn.waitFor({ state: 'visible', timeout: 5_000 })
  await innerAddBtn.click()
  // Fill the first text input (account name) with a sample value. The form lives
  // inside the modal; account-form-name id isn't stable, so we target by placeholder.
  const nameInput = page.locator('input[placeholder*="account" i], input[type="text"]').first()
  await nameInput.fill('High-Yield Savings').catch(() => {})
  await settle(page, { expectSvg: false })
  await snap(page, 'quickstart-3.png', { fullPage: false })
}

async function captureQuickstart4(page: Page): Promise<void> {
  // Net Worth spreadsheet with accounts present but only the latest column
  // partially filled — simulates the "entering balances for this month" state.
  const partialBalances = BALANCES.filter(b => b.month !== '2025-05').concat([
    { id: 101, accountId: 1, month: '2025-05', balance: 142_000 },
    { id: 102, accountId: 2, month: '2025-05', balance: 48_000 },
    // 3, 4, 5, 6 intentionally missing for May to convey "partially filled".
  ])
  await page.addInitScript(
    ({ accounts, balances, profile }) => {
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')
      localStorage.setItem('onboarding-dismissed', '1')
      localStorage.setItem('data-accounts', JSON.stringify(accounts))
      localStorage.setItem('data-balances', JSON.stringify(balances))
      localStorage.setItem('user-profile', JSON.stringify(profile))
    },
    { accounts: ACCOUNTS, balances: partialBalances, profile: PROFILE },
  )
  await navigate(page, '/net-worth')
  await page.waitForSelector('.app-layout', { timeout: 10_000 })
  await settle(page)
  const spreadsheetTab = page.locator('button.data-view-tab', { hasText: 'Spreadsheet' })
  await spreadsheetTab.waitFor({ state: 'visible', timeout: 5_000 })
  await spreadsheetTab.click()
  await page
    .locator('button.data-view-tab.active', { hasText: 'Spreadsheet' })
    .waitFor({ state: 'visible', timeout: 5_000 })
  await settle(page, { expectSvg: false })
  await snap(page, 'quickstart-4.png', { fullPage: false })
}

async function captureQuickstart5(page: Page): Promise<void> {
  // "First win" — one FI account (401k) with three months of balances so a
  // visible upward growth curve appears.
  const singleAccount = [ACCOUNTS[0]] // 401(k), FI
  const singleBalances = [
    { id: 1, accountId: 1, month: '2025-03', balance: 136_800 },
    { id: 2, accountId: 1, month: '2025-04', balance: 139_400 },
    { id: 3, accountId: 1, month: '2025-05', balance: 142_000 },
  ]
  await page.addInitScript(
    ({ accounts, balances, profile }) => {
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')
      localStorage.setItem('onboarding-dismissed', '1')
      localStorage.setItem('data-accounts', JSON.stringify(accounts))
      localStorage.setItem('data-balances', JSON.stringify(balances))
      localStorage.setItem('user-profile', JSON.stringify(profile))
    },
    { accounts: singleAccount, balances: singleBalances, profile: PROFILE },
  )
  await navigate(page, '/net-worth')
  await page.waitForSelector('.app-layout', { timeout: 10_000 })
  await settle(page)
  await snap(page, 'quickstart-5.png', { fullPage: false })
}

/* ── Orchestration ───────────────────────────────────────────── */

async function withFreshPage<T>(browser: Browser, fn: (page: Page) => Promise<T>): Promise<T> {
  // Each capture gets its own context so addInitScript / localStorage are isolated.
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR })
  const page = await context.newPage()
  // Freeze the clock to June 1, 2025 so the seeded May-2025 data is "last month"
  // for every screen that uses `new Date()` (budget year, taxes year, etc.).
  await page.clock.install({ time: new Date('2025-06-01T12:00:00Z') })
  try {
    return await fn(page)
  } finally {
    await context.close()
  }
}

async function ensureServerReady(): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(APP_URL)
      if (res.ok) return
    } catch {
      /* not ready yet */
    }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`Dev server not reachable at ${APP_URL}. Start it with 'npm run dev'.`)
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  await ensureServerReady()

  const browser = await chromium.launch({ headless: true })
  try {
    console.log('Capturing 12 screenshots → docs/screenshots/')

    await withFreshPage(browser, p => captureHome(p, 'light'))
    await withFreshPage(browser, p => captureHome(p, 'dark'))
    await withFreshPage(browser, captureNetWorth)
    await withFreshPage(browser, captureGoals)
    await withFreshPage(browser, captureBudget)
    await withFreshPage(browser, captureTaxes)
    await withFreshPage(browser, captureSettings)

    await withFreshPage(browser, captureQuickstart1)
    await withFreshPage(browser, captureQuickstart2)
    await withFreshPage(browser, captureQuickstart3)
    await withFreshPage(browser, captureQuickstart4)
    await withFreshPage(browser, captureQuickstart5)

    console.log('\nAll 12 screenshots written to', OUT_DIR)
  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
