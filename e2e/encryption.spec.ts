import { test, expect } from '@playwright/test'
import { SecurityPage } from './pages/security.page'
import {
  SENSITIVE_KEYS,
  type SensitiveKey,
  assertAllKeysAreEnvelopes,
  assertAllKeysMatchPlaintextSnapshot,
  dispatchRemoteLock,
  isEnvelope,
  readEnvelope,
  seedAllSensitiveKeys,
  seedEmptyEncryptionState,
} from './fixtures/encryption.fixtures'

const PASSPHRASE = 'TestPass123'
const NEW_PASSPHRASE = 'NewTestPass456'

test.describe('Encryption Lifecycle, Cross-Tab & Envelope Verification', () => {
  test.describe('Security Pane Lifecycle', () => {
    test('shows disabled state initially', async ({ page }) => {
      // (was #60 test 15) — fresh app, no encryption set up.
      await seedEmptyEncryptionState(page)
      const security = new SecurityPage(page)
      await security.open()

      await expect(security.status).toHaveText(/Encryption disabled/)
      await expect(security.enableTriggerBtn).toBeVisible()
      await expect(security.changeTriggerBtn).toHaveCount(0)
      await expect(security.disableTriggerBtn).toHaveCount(0)
      expect(await page.evaluate(() => localStorage.getItem('encryption-enabled'))).not.toBe('1')
    })

    test('enabling encryption with a passphrase shows success', async ({ page }) => {
      // (was #60 test 16) — happy-path enable.
      await seedEmptyEncryptionState(page)
      const security = new SecurityPage(page)
      await security.open()

      await security.enable(PASSPHRASE)

      await expect(security.status).toHaveText(/Encryption enabled/)
      await expect(security.changeTriggerBtn).toBeVisible()
      await expect(security.disableTriggerBtn).toBeVisible()
      expect(await page.evaluate(() => localStorage.getItem('encryption-enabled'))).toBe('1')
    })

    test('enabling encryption with mismatched confirm shows error', async ({ page }) => {
      // (was #60 test 17) — typo guard.
      await seedEmptyEncryptionState(page)
      const security = new SecurityPage(page)
      await security.open()

      await security.enableTriggerBtn.click()
      await expect(security.setupForm).toBeVisible()
      await security.setupPassInput.fill(PASSPHRASE)
      await security.setupConfirmInput.fill('DifferentPass')

      // The mismatch error is visible immediately on confirm change.
      await expect(security.setupConfirmError).toHaveText(/Passphrases don't match/)
      // Submit is disabled while mismatched — clicking does nothing.
      await expect(security.setupSubmitBtn).toBeDisabled()

      // Form remains open; state did not change.
      await expect(security.setupForm).toBeVisible()
      expect(await page.evaluate(() => localStorage.getItem('encryption-enabled'))).not.toBe('1')
      expect(await page.evaluate(() => localStorage.getItem('encryption-salt'))).toBeNull()
    })

    test('changing passphrase requires current passphrase and rotates the key', async ({ page }) => {
      // (was #60 test 18) — change passphrase + bonus key-rotation roundtrip.
      await seedEmptyEncryptionState(page)
      const security = new SecurityPage(page)
      await security.open()
      await security.enable(PASSPHRASE)

      await security.changePassphrase(PASSPHRASE, NEW_PASSPHRASE)
      await expect(security.successFlash).toHaveText(/Passphrase updated/)

      // Bonus assertion: the KEY actually rotated, not just the verifier.
      // Dispatch `encryption-remote-lock` in the current tab — the
      // EncryptionContext listener clears the in-memory key without
      // reloading (which would re-run addInitScript and wipe state).
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('encryption-remote-lock')))

      const passInput = page.getByLabel(/passphrase/i).first()
      const unlockBtn = page.getByRole('button', { name: /^Unlock$|^Unlocking…$/ })

      await expect(page.getByRole('heading', { name: /unlock/i })).toBeVisible()

      // Old passphrase must fail.
      await passInput.fill(PASSPHRASE)
      await unlockBtn.click()
      await expect(page.getByRole('alert').filter({ hasText: /Wrong passphrase/ })).toBeVisible()

      // New passphrase must succeed — UnlockScreen disappears.
      await passInput.fill(NEW_PASSPHRASE)
      await unlockBtn.click()
      await expect(page.getByRole('heading', { name: /unlock/i })).toBeHidden()
    })

    test('disabling encryption requires current passphrase', async ({ page }) => {
      // (was #60 test 19) — happy-path disable.
      await seedEmptyEncryptionState(page)
      const security = new SecurityPage(page)
      await security.open()
      await security.enable(PASSPHRASE)

      await security.disable(PASSPHRASE)

      await expect(security.status).toHaveText(/Encryption disabled/)
      await expect(security.enableTriggerBtn).toBeVisible()
      expect(await page.evaluate(() => localStorage.getItem('encryption-enabled'))).not.toBe('1')
      expect(await page.evaluate(() => localStorage.getItem('encryption-salt'))).toBeNull()
      expect(await page.evaluate(() => localStorage.getItem('encryption-verify'))).toBeNull()
    })

    test('incorrect passphrase on disable shows error and preserves envelopes', async ({ page }) => {
      // (was #60 test 20) — wrong passphrase must not leak data.
      await seedAllSensitiveKeys(page)
      const security = new SecurityPage(page)
      await security.open()
      await security.enable(PASSPHRASE)

      // Sanity: confirm we are in the encrypted-at-rest state before the attack.
      await assertAllKeysAreEnvelopes(page)

      await security.disableTriggerBtn.click()
      await expect(security.disableForm).toBeVisible()
      await security.disablePassInput.fill('WrongPassphrase')
      await security.disableSubmitBtn.click()

      await expect(security.disableError).toHaveText(/Incorrect passphrase/)
      // Encryption remains enabled; envelopes intact across every sensitive key.
      await expect(security.status).toHaveText(/Encryption enabled/)
      expect(await page.evaluate(() => localStorage.getItem('encryption-enabled'))).toBe('1')
      await assertAllKeysAreEnvelopes(page)
    })
  })

  test.describe('Cross-Tab', () => {
    test('lock signal from tab A propagates UnlockScreen to tab B via encryption-remote-lock', async ({
      context,
      page,
    }) => {
      // (was #60 test 29) — stale-tab attack prevention.
      // Tab A enables encryption, then tab B opens and unlocks. Then tab A
      // writes the cross-tab lock signal: tab B's appStorage receives the
      // native `storage` event, dispatches `encryption-remote-lock`, and
      // EncryptionContext clears the in-memory key.
      await seedEmptyEncryptionState(context)
      const securityA = new SecurityPage(page)
      await securityA.open()
      await securityA.enable(PASSPHRASE)

      const tabB = await context.newPage()
      await tabB.goto('/finance-tracking/')
      await tabB.waitForLoadState('domcontentloaded')

      // Tab B mounts with encryption-enabled=1 and no in-memory key → locked.
      await expect(tabB.getByRole('heading', { name: /unlock/i })).toBeVisible()

      // Unlock tab B by entering the passphrase.
      await tabB.getByLabel(/passphrase/i).first().fill(PASSPHRASE)
      await tabB.getByRole('button', { name: /^Unlock$/ }).click()
      await expect(tabB.getByRole('heading', { name: /unlock/i })).toBeHidden()

      // Tab A dispatches the cross-tab lock signal (the real mechanism that
      // appStorage.lock() uses). The native storage event fires in tab B
      // only — tab A does not receive its own write.
      await dispatchRemoteLock(page)

      // Tab B locks: UnlockScreen reappears.
      await expect(tabB.getByRole('heading', { name: /unlock/i })).toBeVisible()
      await expect(tabB.getByLabel(/passphrase/i).first()).toBeVisible()
    })

    test('enable in tab A triggers UnlockScreen in tab B via native storage event', async ({ context, page }) => {
      // (was #60 test 30) — enable propagates across tabs natively. No
      // synthetic event dispatch — we let the browser's native `storage`
      // event fire when tab A writes `encryption-enabled=1`.
      await seedEmptyEncryptionState(context)

      // Open tab A (the default `page`) and tab B in parallel, both on the
      // app root. Both start in the disabled, unlocked state.
      await page.goto('/finance-tracking/')
      await page.waitForLoadState('domcontentloaded')

      const tabB = await context.newPage()
      await tabB.goto('/finance-tracking/')
      await tabB.waitForLoadState('domcontentloaded')

      // Sanity: tab B is unlocked (no Unlock heading visible).
      await expect(tabB.getByRole('heading', { name: /unlock/i })).toHaveCount(0)

      // In tab A, drive the real enable flow.
      const securityA = new SecurityPage(page)
      await securityA.settingsButton.click()
      await securityA.settingsModal.waitFor({ state: 'visible' })
      await securityA.securityNavBtn.click()
      await securityA.enable(PASSPHRASE)

      // Tab B detects the native storage event for `encryption-enabled=1`
      // (handled by the new listener in EncryptionContext) and flips into
      // the locked state — UnlockScreen appears without any reload.
      await expect(tabB.getByRole('heading', { name: /unlock/i })).toBeVisible()
      await expect(tabB.getByLabel(/passphrase/i).first()).toBeVisible()

      // Both tabs show consistent encryption state.
      expect(await page.evaluate(() => localStorage.getItem('encryption-enabled'))).toBe('1')
      expect(await tabB.evaluate(() => localStorage.getItem('encryption-enabled'))).toBe('1')
    })
  })

  test.describe('Envelope Verification', () => {
    test('enabling encryption converts all 13 sensitive keys to envelope format', async ({ page }) => {
      // (was #60 test 36) — every sensitive key must hold { v, iv, ct }
      // after enable. One assertion per key with the key name in the
      // failure message.
      await seedAllSensitiveKeys(page)

      const security = new SecurityPage(page)
      await security.open()

      // Sanity (post-navigation): every key is present as plaintext, not an
      // envelope, before enabling encryption. The app may have normalized
      // some seeded values during boot, but no key should look encrypted yet.
      for (const key of SENSITIVE_KEYS) {
        const value = await readEnvelope(page, key)
        expect(value, `${key} should be present before enable`).not.toBeNull()
        expect(isEnvelope(value), `${key} should NOT look like an envelope before enable`).toBe(false)
      }

      await security.enable(PASSPHRASE)

      // Every sensitive key now holds an EncryptedEnvelope.
      await assertAllKeysAreEnvelopes(page)
    })

    test('disabling encryption converts all 13 sensitive keys back to plaintext', async ({ page }) => {
      // (was #60 test 37) — roundtrip: plaintext-before === plaintext-after.
      await seedAllSensitiveKeys(page)

      const security = new SecurityPage(page)
      await security.open()

      // Snapshot the actual plaintext in localStorage at this moment. The
      // app may normalize seeded values during boot (e.g. budget-config
      // gains default category groups), so the roundtrip must compare
      // against the POST-NAVIGATION plaintext, not the raw seed payload.
      const snapshot = {} as Record<SensitiveKey, unknown>
      for (const key of SENSITIVE_KEYS) {
        snapshot[key] = await readEnvelope(page, key)
      }

      await security.enable(PASSPHRASE)
      await assertAllKeysAreEnvelopes(page)

      await security.disable(PASSPHRASE)

      // Every sensitive key now holds plaintext that matches the captured
      // snapshot exactly. Not toMatchObject, not toBeDefined — structural
      // equality with the original plaintext value.
      await assertAllKeysMatchPlaintextSnapshot(page, snapshot)

      // Encryption lifecycle keys are gone.
      expect(await page.evaluate(() => localStorage.getItem('encryption-enabled'))).not.toBe('1')
      expect(await page.evaluate(() => localStorage.getItem('encryption-salt'))).toBeNull()
      expect(await page.evaluate(() => localStorage.getItem('encryption-verify'))).toBeNull()
    })
  })
})
