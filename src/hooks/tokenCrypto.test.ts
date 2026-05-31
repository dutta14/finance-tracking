import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from './tokenCrypto'

describe('tokenCrypto', () => {
  const token = 'ghp_abc123TestToken'
  const passphrase = 'my-secret-passphrase'

  it('encryptToken returns distinct ciphertext, salt, and IV per call', async () => {
    const a = await encryptToken(token, passphrase)
    const b = await encryptToken(token, passphrase)
    expect(a.encryptedToken).not.toBe(b.encryptedToken)
    expect(a.tokenSalt).not.toBe(b.tokenSalt)
    expect(a.tokenIv).not.toBe(b.tokenIv)
  })

  it('decryptToken recovers the original token', async () => {
    const { encryptedToken: ct, tokenSalt, tokenIv } = await encryptToken(token, passphrase)
    const result = await decryptToken(ct, passphrase, tokenSalt, tokenIv)
    expect(result).toBe(token)
  })

  it('decryptToken throws on wrong passphrase', async () => {
    const { encryptedToken: ct, tokenSalt, tokenIv } = await encryptToken(token, passphrase)
    await expect(decryptToken(ct, 'wrong-passphrase', tokenSalt, tokenIv)).rejects.toThrow()
  })

  it('decryptToken throws on tampered IV', async () => {
    const { encryptedToken: ct, tokenSalt, tokenIv } = await encryptToken(token, passphrase)
    // Flip the first character of the IV to corrupt it
    const tamperedIv = String.fromCharCode(tokenIv.charCodeAt(0) ^ 0xff) + tokenIv.slice(1)
    await expect(decryptToken(ct, passphrase, tokenSalt, tamperedIv)).rejects.toThrow()
  })
})
