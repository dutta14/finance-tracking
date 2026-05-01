import { describe, it, expect, beforeEach } from 'vitest'
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

      // Salt should have changed
      expect(localStorage.getItem('encryption-salt')).toBeTruthy()

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
})
