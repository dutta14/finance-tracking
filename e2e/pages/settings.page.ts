import { Page, Locator, expect } from '@playwright/test'

/**
 * Page object for the Settings modal — non-security panes (Profile,
 * Appearance, Advanced, Labs) plus the modal shell and Import/Export.
 *
 * The Security pane has its own page object (e2e/pages/security.page.ts).
 * This object only exposes nav items for the panes covered by #128.
 */
export class SettingsPage {
  readonly page: Page

  // Trigger + modal scaffolding
  readonly settingsButton: Locator
  readonly dialog: Locator
  readonly backdrop: Locator
  readonly closeButton: Locator

  // Tablist nav (aria-selected="true" on the active tab)
  readonly navProfile: Locator
  readonly navAppearance: Locator
  readonly navAdvanced: Locator
  readonly navLabs: Locator

  // Pane headings (h3 inside each pane)
  readonly profileHeading: Locator
  readonly appearanceHeading: Locator
  readonly advancedHeading: Locator
  readonly labsHeading: Locator

  // Profile pane
  readonly editProfileBtn: Locator
  readonly saveProfileBtn: Locator
  readonly cancelProfileBtn: Locator
  readonly profileNameInput: Locator
  readonly profileBirthdayInput: Locator
  readonly addPartnerBtn: Locator
  readonly partnerNameInput: Locator
  readonly partnerBirthdayInput: Locator
  readonly profileSavedFlash: Locator
  readonly viewName: Locator
  readonly viewPartnerName: Locator

  // Appearance pane
  readonly lightThemeBtn: Locator
  readonly darkThemeBtn: Locator

  // Advanced pane
  readonly allowCsvToggle: Locator
  readonly exportBtn: Locator
  readonly importBtn: Locator
  readonly importFileInput: Locator
  readonly factoryResetBtn: Locator
  readonly factoryResetConfirmBtn: Locator

  // Labs pane
  readonly labPdfToCsvToggle: Locator
  readonly demoModeToggle: Locator

  constructor(page: Page) {
    this.page = page

    this.settingsButton = page.getByRole('button', { name: 'Settings' })
    this.dialog = page.getByRole('dialog', { name: 'Settings' })
    // The modal backdrop is the parent of role=dialog; clicking it
    // triggers onClose via the source's stopPropagation guard.
    this.backdrop = page.locator('.settings-modal-backdrop')
    this.closeButton = this.dialog.getByRole('button', { name: 'Close' })

    this.navProfile = this.dialog.getByRole('tab', { name: 'Profile', exact: true })
    this.navAppearance = this.dialog.getByRole('tab', { name: 'Appearance', exact: true })
    this.navAdvanced = this.dialog.getByRole('tab', { name: 'Advanced', exact: true })
    this.navLabs = this.dialog.getByRole('tab', { name: 'Labs', exact: true })

    this.profileHeading = this.dialog.getByRole('heading', { name: 'Profile', level: 3 })
    this.appearanceHeading = this.dialog.getByRole('heading', { name: 'Appearance', level: 3 })
    this.advancedHeading = this.dialog.getByRole('heading', { name: 'Advanced', level: 3 })
    this.labsHeading = this.dialog.getByRole('heading', { name: 'Labs', level: 3 })

    this.editProfileBtn = this.dialog.getByRole('button', { name: 'Edit Profile' })
    this.saveProfileBtn = this.dialog.getByRole('button', { name: 'Save Profile' })
    this.cancelProfileBtn = this.dialog.getByRole('button', { name: 'Cancel' })
    // Two "Name" fields exist when partner is present — disambiguate by
    // scoping to the primary settings-profile-card (the first one in the
    // edit view).
    // The profile <label> elements aren't wired to inputs via htmlFor, so
    // we can't use getByLabel here. Scope by card + input attributes
    // instead: each settings-profile-card (edit mode) has exactly one
    // text input (Name, placeholder "Your name" / "Partner's name") and
    // one date input (Birthday).
    const editProfileCards = this.dialog.locator('.settings-profile-card:not(.settings-profile-card--view)')
    this.profileNameInput = editProfileCards.first().locator('input[type="text"]')
    this.profileBirthdayInput = editProfileCards.first().locator('input[type="date"]')
    this.addPartnerBtn = this.dialog.getByRole('button', { name: '+ Add Partner' })
    this.partnerNameInput = editProfileCards.nth(1).locator('input[type="text"]')
    this.partnerBirthdayInput = editProfileCards.nth(1).locator('input[type="date"]')
    this.profileSavedFlash = this.dialog.locator('.settings-save-flash')
    this.viewName = this.dialog.locator('.settings-profile-view-name').first()
    this.viewPartnerName = this.dialog.locator('.settings-profile-view-name').nth(1)

    // Appearance buttons don't carry aria-label; their accessible names
    // come from the nested `<span class="settings-theme-name">` text. Use
    // class-scoped locators to avoid relying on accessible-name parsing
    // of buttons that also contain SVG preview chrome.
    this.lightThemeBtn = this.dialog.locator('.settings-theme-option').filter({ hasText: 'Light' })
    this.darkThemeBtn = this.dialog.locator('.settings-theme-option').filter({ hasText: 'Dark' })

    // Advanced pane toggle button has role="switch" but no accessible
    // name on the button itself (the label is a sibling span). It's the
    // only switch on the Advanced pane, so scope by pane heading then
    // pick the switch role.
    this.allowCsvToggle = this.dialog
      .locator('.settings-section')
      .filter({ has: page.getByRole('heading', { name: 'Advanced', level: 3 }) })
      .getByRole('switch')
    this.exportBtn = this.dialog.getByRole('button', { name: 'Export' })
    this.importBtn = this.dialog.getByRole('button', { name: 'Import' })
    this.importFileInput = this.dialog.locator('input[type="file"][accept=".json"]')
    this.factoryResetBtn = this.dialog.getByRole('button', { name: 'Factory Reset App' })
    this.factoryResetConfirmBtn = this.dialog.getByRole('button', { name: 'Yes, Reset Everything' })

    this.labPdfToCsvToggle = this.dialog.getByRole('switch', { name: 'PDF → CSV' })
    this.demoModeToggle = this.dialog.getByRole('switch', { name: 'Demo Mode' })
  }

  /** Navigate to the app root and open the Settings modal. */
  async open(): Promise<void> {
    await this.page.goto('/finance-tracking/')
    await this.page.waitForLoadState('domcontentloaded')
    await this.settingsButton.click()
    await expect(this.dialog).toBeVisible()
  }

  /** Open the modal without navigating (assumes the page is already loaded). */
  async openInPlace(): Promise<void> {
    await this.settingsButton.click()
    await expect(this.dialog).toBeVisible()
  }

  /**
   * Click a nav item and wait for the matching pane heading to render.
   * Uses aria-selected="true" as the active-state contract (tablist pattern).
   */
  async navTo(section: 'profile' | 'appearance' | 'advanced' | 'labs'): Promise<void> {
    const map = {
      profile: { btn: this.navProfile, heading: this.profileHeading },
      appearance: { btn: this.navAppearance, heading: this.appearanceHeading },
      advanced: { btn: this.navAdvanced, heading: this.advancedHeading },
      labs: { btn: this.navLabs, heading: this.labsHeading },
    }
    const { btn, heading } = map[section]
    await btn.click()
    await expect(btn).toHaveAttribute('aria-selected', 'true')
    await expect(heading).toBeVisible()
  }
}
