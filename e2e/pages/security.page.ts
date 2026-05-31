import { Page, Locator, expect } from '@playwright/test'

/**
 * Page object for the Security pane inside the Settings modal.
 *
 * The pane has four mutually-exclusive form modes (`none` | `setup` | `change`
 * | `disable`), each with its own form and submit button. The trigger
 * buttons and the form submit buttons sometimes share label text (e.g.
 * "Enable Encryption", "Disable Encryption") — but the source ensures only
 * one is mounted at a time, so plain role-based queries work without
 * disambiguation.
 */
export class SecurityPage {
  readonly page: Page

  // Modal scaffolding
  readonly settingsButton: Locator
  readonly settingsModal: Locator
  readonly securityNavBtn: Locator
  readonly heading: Locator

  // Status indicator (role="status" with aria-live="polite")
  readonly status: Locator

  // Setup (enable) flow
  readonly enableTriggerBtn: Locator
  readonly setupForm: Locator
  readonly setupPassInput: Locator
  readonly setupConfirmInput: Locator
  readonly setupSubmitBtn: Locator
  readonly setupConfirmError: Locator

  // Change-passphrase flow
  readonly changeTriggerBtn: Locator
  readonly changeForm: Locator
  readonly changeCurrentInput: Locator
  readonly changeNewInput: Locator
  readonly changeConfirmInput: Locator
  readonly changeSubmitBtn: Locator
  readonly changeError: Locator
  readonly successFlash: Locator

  // Disable flow
  readonly disableTriggerBtn: Locator
  readonly disableForm: Locator
  readonly disablePassInput: Locator
  readonly disableSubmitBtn: Locator
  readonly disableError: Locator

  constructor(page: Page) {
    this.page = page

    this.settingsButton = page.getByRole('button', { name: 'Settings' })
    this.settingsModal = page.getByRole('dialog')
    this.securityNavBtn = this.settingsModal.getByRole('tab', { name: 'Security', exact: true })
    this.heading = this.settingsModal.getByRole('heading', { name: 'Security', level: 3 })

    this.status = this.settingsModal.getByRole('status').first()

    this.enableTriggerBtn = this.settingsModal.getByRole('button', { name: 'Enable Encryption', exact: true })
    this.setupForm = this.settingsModal.locator('form.security-setup-form')
    this.setupPassInput = this.setupForm.getByLabel('New passphrase', { exact: true })
    this.setupConfirmInput = this.setupForm.getByLabel('Confirm passphrase', { exact: true })
    this.setupSubmitBtn = this.setupForm.getByRole('button', { name: /^Enable Encryption$|^Encrypting…$/ })
    // PassphraseInput renders <p role="alert"> for every field (empty when no
    // error); scope to the confirm input's specific error region by its id.
    this.setupConfirmError = this.setupForm.locator('#setup-confirm-error')

    this.changeTriggerBtn = this.settingsModal.getByRole('button', { name: 'Change Passphrase', exact: true })
    this.changeForm = this.settingsModal.locator('form.security-change-form')
    this.changeCurrentInput = this.changeForm.getByLabel('Current passphrase', { exact: true })
    this.changeNewInput = this.changeForm.getByLabel('New passphrase', { exact: true })
    this.changeConfirmInput = this.changeForm.getByLabel('Confirm new passphrase', { exact: true })
    this.changeSubmitBtn = this.changeForm.getByRole('button', { name: /^Update Passphrase$|^Updating…$/ })
    this.changeError = this.changeForm.locator('#change-current-error')
    this.successFlash = this.settingsModal.locator('.settings-save-flash')

    this.disableTriggerBtn = this.settingsModal.getByRole('button', { name: 'Disable Encryption', exact: true })
    this.disableForm = this.settingsModal.locator('form.security-disable-confirm')
    this.disablePassInput = this.disableForm.getByLabel('Enter passphrase to confirm', { exact: true })
    this.disableSubmitBtn = this.disableForm.getByRole('button', { name: /^Disable Encryption$|^Disabling…$/ })
    this.disableError = this.disableForm.locator('#disable-passphrase-error')
  }

  /** Navigate to the app root and open Settings → Security. */
  async open(): Promise<void> {
    await this.page.goto('/finance-tracking/')
    await this.page.waitForLoadState('domcontentloaded')
    await this.settingsButton.click()
    await this.settingsModal.waitFor({ state: 'visible' })
    await this.securityNavBtn.click()
    await expect(this.heading).toBeVisible()
  }

  /**
   * Drive the enable flow to completion.
   *
   * The toHaveValue+toBeEnabled gates after each fill() are load-bearing.
   * Without them, Playwright submits before React commits the controlled-
   * input state, doubling the passphrase into the New input and leaving
   * Confirm empty. Root cause: Playwright→Chromium fill speed exceeds React
   * paint under headless throttling. Not reproducible at human typing speeds
   * in real browsers — no source-side fix needed. See #169.
   */
  async enable(passphrase: string, confirm: string = passphrase): Promise<void> {
    await this.enableTriggerBtn.click()
    await expect(this.setupForm).toBeVisible()
    await expect(this.setupPassInput).toBeVisible()
    await expect(this.setupConfirmInput).toBeVisible()
    await this.setupPassInput.fill(passphrase)
    await expect(this.setupPassInput).toHaveValue(passphrase)
    await this.setupConfirmInput.fill(confirm)
    await expect(this.setupConfirmInput).toHaveValue(confirm)
    await expect(this.setupSubmitBtn).toBeEnabled()
    await this.setupSubmitBtn.click()
    await expect(this.setupForm).toBeHidden()
    await expect(this.status).toHaveText(/Encryption enabled/)
  }

  /** Drive the change-passphrase flow. Asserts the success flash appears. */
  async changePassphrase(current: string, next: string, confirm: string = next): Promise<void> {
    await this.changeTriggerBtn.click()
    await expect(this.changeForm).toBeVisible()
    await this.changeCurrentInput.fill(current)
    await this.changeNewInput.fill(next)
    await this.changeConfirmInput.fill(confirm)
    await this.changeSubmitBtn.click()
    await expect(this.changeForm).toBeHidden()
    await expect(this.successFlash).toBeVisible()
  }

  /** Drive the disable flow to completion. Asserts the status indicator
   *  flips back to "Encryption disabled" before returning. */
  async disable(passphrase: string): Promise<void> {
    await this.disableTriggerBtn.click()
    await expect(this.disableForm).toBeVisible()
    await this.disablePassInput.fill(passphrase)
    await this.disableSubmitBtn.click()
    await expect(this.disableForm).toBeHidden()
    await expect(this.status).toHaveText(/Encryption disabled/)
  }
}
