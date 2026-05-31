import { Page } from '@playwright/test'

/**
 * Seed helpers for the navigation E2E suites (#141 / 61a–d).
 *
 * The navigation tests do not need rich domain data — they only need
 * each page (Home, Goals, Net Worth, Budget, Taxes, Drive) to mount its
 * top-level layout (h1 + main content) without console errors. Each
 * page renders its h1 unconditionally, so `seedNav` only has to:
 *
 *   1. clear localStorage (so prior tests don't bleed in),
 *   2. disable encryption (avoid the UnlockScreen),
 *   3. dismiss the Home onboarding card so its hero h1 is the first
 *      heading on the page.
 *
 * Sub-issues 61b (search), 61c (mobile), and 61d (keyboard) extend the
 * same seed surface. Add only navigation-shared keys here. Page-specific
 * fixtures belong in their own files.
 */

export interface NavSeedOptions {
  /** Optional profile name to personalize the Home greeting. */
  profileName?: string
  /** Set viewport-affecting flags. Reserved for 61c (mobile). */
  extra?: Record<string, string>
}

/** App base path under Vite dev server. */
export const APP_BASE = '/finance-tracking/'

/** Build a hash-router URL: `hashUrl('/goal')` → `/finance-tracking/#/goal`. */
export function hashUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${APP_BASE}#${clean}`
}

/**
 * Seed minimal localStorage state so the app mounts without onboarding
 * or unlock screens. Uses `addInitScript` so it runs before app code on
 * every navigation (including reloads triggered inside the test).
 *
 * The feature-flags API mock is handled globally by the base fixture
 * (`e2e/fixtures/base.ts`), so individual seed helpers no longer need
 * to register their own route intercept.
 */
export async function seedNav(page: Page, options: NavSeedOptions = {}): Promise<void> {
  const { profileName, extra } = options
  const profile = profileName
    ? JSON.stringify({ name: profileName, birthday: '', avatarDataUrl: '', partner: null })
    : null
  await page.addInitScript(
    ({ profile, extra }) => {
      localStorage.clear()
      localStorage.setItem('encryption-enabled', '0')
      localStorage.setItem('onboarding-dismissed', '1')
      if (profile) localStorage.setItem('user-profile', profile)
      if (extra) for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v)
    },
    { profile, extra: extra ?? null },
  )
}

/** The ordered list of sidebar nav buttons covered by 61a. */
export const PRIMARY_NAV_LINKS = ['Home', 'Goals', 'Net Worth', 'Budget', 'Taxes'] as const
export type PrimaryNavLink = (typeof PRIMARY_NAV_LINKS)[number]

/** Hash path each nav link routes to. */
export const NAV_PATHS: Record<PrimaryNavLink | 'Drive', string> = {
  Home: '/',
  Goals: '/goal',
  'Net Worth': '/net-worth',
  Budget: '/budget',
  Taxes: '/taxes',
  Drive: '/drive',
}

/** The h1 text rendered on each route (regex tolerates the dynamic Home greeting). */
export const PAGE_HEADINGS: Record<PrimaryNavLink | 'Drive', RegExp> = {
  Home: /^Good (morning|afternoon|evening)/,
  Goals: /^Goals$/,
  'Net Worth': /^Net Worth$/,
  Budget: /^Budget$/,
  Taxes: /^Taxes$/,
  Drive: /^Drive$/,
}
