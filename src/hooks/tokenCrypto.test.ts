import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from './tokenCrypto'

describe('tokenCrypto', () => {
  it('produces distinct ciphertext, salt, and IV each call', async () => {
    const token = 'ghp_abc123'
    const passphrase = 'my-secret'

    const result1 = await encryptToken(token, passphrase)
    const result2 = await encryptToken(token, passphrase)

    expect(result1.encryptedToken).not.toBe(result2.encryptedToken)
    expect(result1.tokenSalt).not.toBe(result2.tokenSalt)
    expect(result1.tokenIv).not.toBe(result2.tokenIv)
  })

  it('roundtrips encrypt then decrypt to recover original token', async () => {
    const token = 'ghp_realToken12345'
    const passphrase = 'strong-passphrase'

    const { encryptedToken, tokenSalt, tokenIv } = await encryptToken(token, passphrase)
    const decrypted = await decryptToken(encryptedToken, passphrase, tokenSalt, tokenIv)

    expect(decrypted).toBe(token)
  })

  it('throws when decrypting with wrong passphrase', async () => {
    const token = 'ghp_secret'
    const passphrase = 'correct-pass'

    const { encryptedToken, tokenSalt, tokenIv } = await encryptToken(token, passphrase)

    await expect(decryptToken(encryptedToken, 'wrong-pass', tokenSalt, tokenIv)).rejects.toThrow()
  })

  it('throws when decrypting with tampered IV', async () => {
    const token = 'ghp_secret'
    const passphrase = 'correct-pass'

    const { encryptedToken, tokenSalt, tokenIv } = await encryptToken(token, passphrase)

    // Tamper the IV by flipping a character
    const tamperedIv = tokenIv.slice(0, -1) + (tokenIv.slice(-1) === 'A' ? 'B' : 'A')

    await expect(decryptToken(encryptedToken, passphrase, tokenSalt, tamperedIv)).rejects.toThrow()
  })
})
