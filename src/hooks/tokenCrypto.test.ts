import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from './tokenCrypto'

describe('tokenCrypto', () => {
  const token = 'ghp_abc123XYZ_testToken'
  const passphrase = 'my-secure-passphrase'

  it('encryptToken returns distinct ciphertext, salt, and IV per call', async () => {
    const result1 = await encryptToken(token, passphrase)
    const result2 = await encryptToken(token, passphrase)

    expect(result1.encryptedToken).toBeTruthy()
    expect(result1.tokenSalt).toBeTruthy()
    expect(result1.tokenIv).toBeTruthy()

    expect(result1.encryptedToken).not.toBe(result2.encryptedToken)
    expect(result1.tokenSalt).not.toBe(result2.tokenSalt)
    expect(result1.tokenIv).not.toBe(result2.tokenIv)
  })

  it('decryptToken recovers the original token', async () => {
    const { encryptedToken, tokenSalt, tokenIv } = await encryptToken(token, passphrase)
    const decrypted = await decryptToken(encryptedToken, passphrase, tokenSalt, tokenIv)

    expect(decrypted).toBe(token)
  })

  it('decryptToken throws on wrong passphrase', async () => {
    const { encryptedToken, tokenSalt, tokenIv } = await encryptToken(token, passphrase)

    await expect(decryptToken(encryptedToken, 'wrong-passphrase', tokenSalt, tokenIv)).rejects.toThrow()
  })

  it('decryptToken throws on tampered IV', async () => {
    const { encryptedToken, tokenSalt, tokenIv } = await encryptToken(token, passphrase)
    const tamperedIv = tokenIv.slice(0, -2) + 'AA'

    await expect(decryptToken(encryptedToken, passphrase, tokenSalt, tamperedIv)).rejects.toThrow()
  })
})
