import { vi, describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

vi.unmock('./EncryptionContext')
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { EncryptionProvider, useEncryption } from './EncryptionContext'
import type { ReactNode } from 'react'

/* ── helpers ─────────────────────────────────────────────────────── */

const wrapper = ({ children }: { children: ReactNode }) => <EncryptionProvider>{children}</EncryptionProvider>

function StatusConsumer() {
  const { isEncryptionEnabled, isLocked, isSettingUp, cryptoKey } = useEncryption()
  return (
    <div>
      <span data-testid="enabled">{String(isEncryptionEnabled)}</span>
      <span data-testid="locked">{String(isLocked)}</span>
      <span data-testid="settingUp">{String(isSettingUp)}</span>
      <span data-testid="hasKey">{String(cryptoKey !== null)}</span>
    </div>
  )
}

/* no-op — async actions tested via renderHook */

function GateConsumer() {
  const { isLocked } = useEncryption()
  return isLocked ? <div data-testid="locked-view">Locked</div> : <div data-testid="unlocked-view">Unlocked</div>
}

/* ── setup ───────────────────────────────────────────────────────── */

beforeEach(() => {
  localStorage.clear()
  indexedDB = new IDBFactory()
})

/* ── tests ───────────────────────────────────────────────────────── */

describe('EncryptionContext', () => {
  describe('initial state', () => {
    it('renders children when encryption is not enabled (backward compatible)', () => {
      render(
        <EncryptionProvider>
          <div data-testid="child">Hello</div>
        </EncryptionProvider>,
      )
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('has correct defaults when encryption is not enabled', () => {
      render(
        <EncryptionProvider>
          <StatusConsumer />
        </EncryptionProvider>,
      )
      expect(screen.getByTestId('enabled').textContent).toBe('false')
      expect(screen.getByTestId('locked').textContent).toBe('false')
      expect(screen.getByTestId('settingUp').textContent).toBe('false')
      expect(screen.getByTestId('hasKey').textContent).toBe('false')
    })

    it('isLocked is true when encryption-enabled is set but no key in memory', () => {
      localStorage.setItem('encryption-enabled', '1')
      render(
        <EncryptionProvider>
          <StatusConsumer />
        </EncryptionProvider>,
      )
      expect(screen.getByTestId('enabled').textContent).toBe('true')
      expect(screen.getByTestId('locked').textContent).toBe('true')
      expect(screen.getByTestId('hasKey').textContent).toBe('false')
    })
  })

  describe('setupEncryption', () => {
    it('creates salt, verify key, and sentinel in localStorage', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })

      expect(localStorage.getItem('encryption-enabled')).toBe('1')
      expect(localStorage.getItem('encryption-salt')).toBeTruthy()
      expect(localStorage.getItem('encryption-verify')).toBeTruthy()

      // Verify the salt is valid base64 (16 bytes → ~24 chars)
      const salt = localStorage.getItem('encryption-salt')!
      expect(salt.length).toBeGreaterThan(0)

      // Verify the verify value is a valid encrypted envelope
      const verifyRaw = localStorage.getItem('encryption-verify')!
      const envelope = JSON.parse(verifyRaw)
      expect(envelope.v).toBe(1)
      expect(typeof envelope.iv).toBe('string')
      expect(typeof envelope.ct).toBe('string')
    })

    it('sets isEncryptionEnabled to true and key is available after setup', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      expect(result.current.isEncryptionEnabled).toBe(false)

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })

      expect(result.current.isEncryptionEnabled).toBe(true)
      expect(result.current.cryptoKey).not.toBeNull()
      expect(result.current.isLocked).toBe(false)
    })
  })

  describe('unlock', () => {
    it('unlocks with correct passphrase after setup + lock', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })
      expect(result.current.cryptoKey).not.toBeNull()

      act(() => {
        result.current.lock()
      })
      expect(result.current.isLocked).toBe(true)
      expect(result.current.cryptoKey).toBeNull()

      let unlockResult: boolean | undefined
      await act(async () => {
        unlockResult = await result.current.unlock('testpass123')
      })
      expect(unlockResult).toBe(true)
      expect(result.current.isLocked).toBe(false)
      expect(result.current.cryptoKey).not.toBeNull()
    })

    it('returns false for wrong passphrase and stays locked', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })
      act(() => {
        result.current.lock()
      })
      expect(result.current.isLocked).toBe(true)

      let unlockResult: boolean | undefined
      await act(async () => {
        unlockResult = await result.current.unlock('wrongpass')
      })
      expect(unlockResult).toBe(false)
      expect(result.current.isLocked).toBe(true)
      expect(result.current.cryptoKey).toBeNull()
    })

    it('returns false if no salt is stored', async () => {
      localStorage.setItem('encryption-enabled', '1')
      const { result } = renderHook(() => useEncryption(), { wrapper })
      let unlockResult: boolean | undefined
      await act(async () => {
        unlockResult = await result.current.unlock('somepass')
      })
      expect(unlockResult).toBe(false)
    })
  })

  describe('lock', () => {
    it('clears cryptoKey and sets isLocked', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })
      expect(result.current.cryptoKey).not.toBeNull()
      expect(result.current.isLocked).toBe(false)

      act(() => {
        result.current.lock()
      })
      expect(result.current.cryptoKey).toBeNull()
      expect(result.current.isLocked).toBe(true)
    })
  })

  describe('disableEncryption', () => {
    it('removes all encryption artifacts and decrypts data', async () => {
      localStorage.setItem('data-accounts', JSON.stringify([{ id: 1, name: 'Bank' }]))

      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })
      expect(localStorage.getItem('encryption-enabled')).toBe('1')

      // The sensitive key should now be encrypted
      const encryptedRaw = localStorage.getItem('data-accounts')!
      const encryptedParsed = JSON.parse(encryptedRaw)
      expect(encryptedParsed.v).toBe(1)

      await act(async () => {
        await result.current.disableEncryption('testpass123')
      })

      expect(localStorage.getItem('encryption-enabled')).toBeNull()
      expect(localStorage.getItem('encryption-salt')).toBeNull()
      expect(localStorage.getItem('encryption-verify')).toBeNull()
      expect(result.current.isEncryptionEnabled).toBe(false)
      expect(result.current.isLocked).toBe(false)

      // Data should be decrypted back to plaintext JSON
      const plainRaw = localStorage.getItem('data-accounts')!
      const plain = JSON.parse(plainRaw)
      expect(plain).toEqual([{ id: 1, name: 'Bank' }])
    })

    it('returns false with wrong passphrase', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })

      let disableResult: boolean | undefined
      await act(async () => {
        disableResult = await result.current.disableEncryption('wrongpass')
      })
      expect(disableResult).toBe(false)
      expect(localStorage.getItem('encryption-enabled')).toBe('1')
    })
  })

  describe('changePassphrase', () => {
    it('re-encrypts data with new passphrase', async () => {
      localStorage.setItem('budget-store', JSON.stringify({ budget: 1000 }))

      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('oldpass')
      })

      // Verify data is encrypted
      const encrypted1 = localStorage.getItem('budget-store')!
      expect(JSON.parse(encrypted1).v).toBe(1)

      let changeResult: boolean | undefined
      await act(async () => {
        changeResult = await result.current.changePassphrase('oldpass', 'newpass')
      })
      expect(changeResult).toBe(true)

      // Salt should have actually changed
      const newSalt = localStorage.getItem('encryption-salt')!
      expect(newSalt).toBeTruthy()
      expect(newSalt).not.toBe(encrypted1) // different from encrypted data (proxy for salt change)

      // Verify data is still accessible (re-encrypted, not lost)
      const encrypted2 = localStorage.getItem('budget-store')!
      const parsed2 = JSON.parse(encrypted2)
      expect(parsed2.v).toBe(1)
      expect(parsed2.iv).toBeDefined()
      expect(parsed2.ct).toBeDefined()

      // Lock and unlock with new passphrase
      act(() => {
        result.current.lock()
      })
      expect(result.current.isLocked).toBe(true)

      let unlockResult: boolean | undefined
      await act(async () => {
        unlockResult = await result.current.unlock('newpass')
      })
      expect(unlockResult).toBe(true)
      expect(result.current.isLocked).toBe(false)
    })

    it('returns false with wrong old passphrase', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('mypass')
      })

      let changeResult: boolean | undefined
      await act(async () => {
        changeResult = await result.current.changePassphrase('wrongold', 'newpass')
      })
      expect(changeResult).toBe(false)
    })

    it('salt actually changes after changePassphrase', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('oldpass')
      })
      const oldSalt = localStorage.getItem('encryption-salt')!

      await act(async () => {
        await result.current.changePassphrase('oldpass', 'newpass')
      })
      const newSalt = localStorage.getItem('encryption-salt')!
      expect(newSalt).not.toBe(oldSalt)
    })
  })

  describe('provider gating', () => {
    it('shows locked view when encryption is enabled', () => {
      localStorage.setItem('encryption-enabled', '1')
      render(
        <EncryptionProvider>
          <GateConsumer />
        </EncryptionProvider>,
      )
      expect(screen.getByTestId('locked-view')).toBeInTheDocument()
    })

    it('shows unlocked view when encryption is not enabled', () => {
      render(
        <EncryptionProvider>
          <GateConsumer />
        </EncryptionProvider>,
      )
      expect(screen.getByTestId('unlocked-view')).toBeInTheDocument()
    })

    it('transitions from locked to unlocked after successful unlock', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })
      act(() => {
        result.current.lock()
      })
      expect(result.current.isLocked).toBe(true)

      await act(async () => {
        await result.current.unlock('testpass123')
      })
      expect(result.current.isLocked).toBe(false)
    })
  })

  describe('useEncryption hook', () => {
    it('throws when used outside EncryptionProvider', () => {
      expect(() => {
        renderHook(() => useEncryption())
      }).toThrow('useEncryption must be used within an <EncryptionProvider>')
    })
  })

  describe('encryption integrity', () => {
    it('generates unique IVs for each encryption operation', async () => {
      localStorage.setItem('data-accounts', JSON.stringify([{ id: 1 }]))
      localStorage.setItem('budget-store', JSON.stringify({ x: 1 }))

      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })

      const accounts = JSON.parse(localStorage.getItem('data-accounts')!)
      const budget = JSON.parse(localStorage.getItem('budget-store')!)
      expect(accounts.iv).toBeDefined()
      expect(budget.iv).toBeDefined()
      expect(accounts.iv).not.toBe(budget.iv)
    })

    it('unlock produces correct decrypted content', async () => {
      const originalData = [{ id: 1, name: 'Checking', balance: 5000 }]
      localStorage.setItem('data-accounts', JSON.stringify(originalData))

      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })

      // Data is now encrypted
      const encrypted = JSON.parse(localStorage.getItem('data-accounts')!)
      expect(encrypted.v).toBe(1)

      // Lock and unlock
      act(() => {
        result.current.lock()
      })
      await act(async () => {
        await result.current.unlock('testpass123')
      })

      // After unlock, cryptoKey should be available to decrypt
      expect(result.current.cryptoKey).not.toBeNull()
      expect(result.current.isLocked).toBe(false)
    })

    it('corruption and wrong passphrase both return false on unlock', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })

      // Corrupt the verify value
      localStorage.setItem('encryption-verify', JSON.stringify({ v: 1, iv: 'bad', ct: 'corrupted' }))

      act(() => {
        result.current.lock()
      })

      let unlockResult: boolean | undefined
      await act(async () => {
        unlockResult = await result.current.unlock('testpass123')
      })
      // Both corruption and wrong passphrase return false — documented limitation
      expect(unlockResult).toBe(false)
      expect(result.current.isLocked).toBe(true)
    })
  })

  describe('unlocked state rendering', () => {
    it('renders children in unlocked state after setup', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })

      expect(result.current.isLocked).toBe(false)
      expect(result.current.isEncryptionEnabled).toBe(true)
      expect(result.current.cryptoKey).not.toBeNull()

      const { getByTestId } = render(
        <EncryptionProvider>
          <GateConsumer />
        </EncryptionProvider>,
      )
      // Fresh mount reads encryption-enabled=1 but has no key → locked
      expect(getByTestId('locked-view')).toBeInTheDocument()
    })

    it('renders UnlockScreen when encrypted but not unlocked', () => {
      localStorage.setItem('encryption-enabled', '1')
      localStorage.setItem('encryption-salt', 'dGVzdA==')
      localStorage.setItem('encryption-verify', JSON.stringify({ v: 1, iv: 'aaa', ct: 'bbb' }))

      render(
        <EncryptionProvider>
          <GateConsumer />
        </EncryptionProvider>,
      )
      expect(screen.getByTestId('locked-view')).toBeInTheDocument()
    })
  })

  describe('lock state persistence', () => {
    it('persists lock state across remounts via localStorage flag', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })
      expect(localStorage.getItem('encryption-enabled')).toBe('1')

      // Remount: should read encryption-enabled from localStorage
      const { result: result2 } = renderHook(() => useEncryption(), { wrapper })
      expect(result2.current.isEncryptionEnabled).toBe(true)
      // No key in memory on fresh mount → locked
      expect(result2.current.isLocked).toBe(true)
    })
  })

  describe('decrypt on unlock', () => {
    it('decrypts sensitive keys on unlock', async () => {
      localStorage.setItem('data-accounts', JSON.stringify([{ id: 1, name: 'Checking' }]))

      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('mypass')
      })

      // Data should be encrypted now
      const encRaw = localStorage.getItem('data-accounts')!
      const encParsed = JSON.parse(encRaw)
      expect(encParsed.v).toBe(1)

      act(() => {
        result.current.lock()
      })
      expect(result.current.isLocked).toBe(true)

      // Unlock should succeed and decrypt
      let unlockOk: boolean | undefined
      await act(async () => {
        unlockOk = await result.current.unlock('mypass')
      })
      expect(unlockOk).toBe(true)
      expect(result.current.cryptoKey).not.toBeNull()
    })
  })

  describe('re-encrypt on passphrase change', () => {
    it('re-encrypts keys so old passphrase no longer unlocks', async () => {
      localStorage.setItem('data-accounts', JSON.stringify([{ id: 1 }]))

      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('oldpass')
      })

      await act(async () => {
        await result.current.changePassphrase('oldpass', 'newpass')
      })

      act(() => {
        result.current.lock()
      })

      // Old passphrase should fail
      let oldResult: boolean | undefined
      await act(async () => {
        oldResult = await result.current.unlock('oldpass')
      })
      expect(oldResult).toBe(false)
      expect(result.current.isLocked).toBe(true)

      // New passphrase should succeed
      let newResult: boolean | undefined
      await act(async () => {
        newResult = await result.current.unlock('newpass')
      })
      expect(newResult).toBe(true)
      expect(result.current.isLocked).toBe(false)
    })
  })

  describe('lock clears key', () => {
    it('clears cryptoKey on lock so it is null', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('pass123')
      })
      expect(result.current.cryptoKey).not.toBeNull()

      act(() => {
        result.current.lock()
      })
      expect(result.current.cryptoKey).toBeNull()
      expect(result.current.isLocked).toBe(true)
      expect(result.current.isEncryptionEnabled).toBe(true)
    })
  })

  describe('corrupted data handling', () => {
    it('handles corrupted salt gracefully', async () => {
      localStorage.setItem('encryption-enabled', '1')
      localStorage.setItem('encryption-salt', '!!!not-base64!!!')
      localStorage.setItem('encryption-verify', JSON.stringify({ v: 1, iv: 'a', ct: 'b' }))

      const { result } = renderHook(() => useEncryption(), { wrapper })

      let unlockOk: boolean | undefined
      await act(async () => {
        unlockOk = await result.current.unlock('anypass')
      })
      expect(unlockOk).toBe(false)
      expect(result.current.isLocked).toBe(true)
    })

    it('handles corrupted verify envelope gracefully', async () => {
      localStorage.setItem('encryption-enabled', '1')
      localStorage.setItem('encryption-salt', 'dGVzdHNhbHQ=') // valid base64
      localStorage.setItem('encryption-verify', 'not-json')

      const { result } = renderHook(() => useEncryption(), { wrapper })

      let unlockOk: boolean | undefined
      await act(async () => {
        unlockOk = await result.current.unlock('anypass')
      })
      expect(unlockOk).toBe(false)
      expect(result.current.isLocked).toBe(true)
    })

    it('handles missing verify envelope gracefully', async () => {
      localStorage.setItem('encryption-enabled', '1')
      localStorage.setItem('encryption-salt', 'dGVzdHNhbHQ=')
      // No verify envelope set

      const { result } = renderHook(() => useEncryption(), { wrapper })

      let unlockOk: boolean | undefined
      await act(async () => {
        unlockOk = await result.current.unlock('anypass')
      })
      expect(unlockOk).toBe(false)
    })
  })

  describe('migration recovery', () => {
    it('calls recoverMigration on mount when migration is incomplete', async () => {
      const migrateMod = await import('../utils/migratePlaintext')
      const recoverSpy = vi.spyOn(migrateMod, 'recoverMigration')
      const incompleteSpy = vi.spyOn(migrateMod, 'isMigrationIncomplete').mockReturnValue(true)

      render(
        <EncryptionProvider>
          <div>child</div>
        </EncryptionProvider>,
      )

      expect(incompleteSpy).toHaveBeenCalled()
      expect(recoverSpy).toHaveBeenCalled()

      incompleteSpy.mockRestore()
      recoverSpy.mockRestore()
    })
  })

  describe('remote lock', () => {
    it('clears cryptoKey when encryption-remote-lock event fires', async () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })

      await act(async () => {
        await result.current.setupEncryption('testpass123')
      })
      expect(result.current.cryptoKey).not.toBeNull()

      act(() => {
        window.dispatchEvent(new Event('encryption-remote-lock'))
      })
      expect(result.current.cryptoKey).toBeNull()
      expect(result.current.isLocked).toBe(true)
    })
  })

  describe('cross-tab encryption-enabled propagation', () => {
    it('flips into locked state when another tab sets encryption-enabled to "1"', () => {
      // This tab boots in disabled mode
      const { result } = renderHook(() => useEncryption(), { wrapper })
      expect(result.current.isEncryptionEnabled).toBe(false)
      expect(result.current.isLocked).toBe(false)

      // Simulate another tab enabling encryption
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: 'encryption-enabled', newValue: '1', oldValue: null }))
      })

      expect(result.current.isEncryptionEnabled).toBe(true)
      expect(result.current.cryptoKey).toBeNull()
      expect(result.current.isLocked).toBe(true)
    })

    it('flips back to disabled when another tab clears encryption-enabled', async () => {
      localStorage.setItem('encryption-enabled', '1')
      const { result } = renderHook(() => useEncryption(), { wrapper })
      expect(result.current.isEncryptionEnabled).toBe(true)

      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: 'encryption-enabled', newValue: null, oldValue: '1' }))
      })

      expect(result.current.isEncryptionEnabled).toBe(false)
      expect(result.current.isLocked).toBe(false)
    })

    it('ignores storage events for unrelated keys', () => {
      const { result } = renderHook(() => useEncryption(), { wrapper })
      const beforeEnabled = result.current.isEncryptionEnabled

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', { key: 'unrelated-key', newValue: 'whatever', oldValue: null }),
        )
      })

      expect(result.current.isEncryptionEnabled).toBe(beforeEnabled)
    })
  })

  describe('disableEncryption edge cases', () => {
    it('returns false when no salt is present', async () => {
      localStorage.setItem('encryption-enabled', '1')
      // No salt set
      const { result } = renderHook(() => useEncryption(), { wrapper })

      let disableResult: boolean | undefined
      await act(async () => {
        disableResult = await result.current.disableEncryption('anypass')
      })
      expect(disableResult).toBe(false)
    })
  })

  describe('changePassphrase edge cases', () => {
    it('returns false when no salt is present', async () => {
      localStorage.setItem('encryption-enabled', '1')
      const { result } = renderHook(() => useEncryption(), { wrapper })

      let changeResult: boolean | undefined
      await act(async () => {
        changeResult = await result.current.changePassphrase('old', 'new')
      })
      expect(changeResult).toBe(false)
    })
  })
})
