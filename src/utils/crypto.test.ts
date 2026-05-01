import { describe, it, expect } from 'vitest'
import {
  deriveKey,
  encryptString,
  decryptString,
  encryptObject,
  decryptObject,
  bytesToB64,
  b64ToBytes,
  isEncryptedEnvelope,
} from './crypto'

// Helpers
const makeSalt = () => crypto.getRandomValues(new Uint8Array(16))
const makeKey = (passphrase = 'test-passphrase') => deriveKey(passphrase, makeSalt())

describe('bytesToB64 / b64ToBytes', () => {
  it('round-trips a byte array', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255])
    expect(Array.from(b64ToBytes(bytesToB64(original)))).toEqual(Array.from(original))
  })

  it('handles an empty array', () => {
    const empty = new Uint8Array([])
    expect(bytesToB64(empty)).toBe('')
    expect(Array.from(b64ToBytes(''))).toEqual([])
  })
})

describe('encryptString / decryptString', () => {
  it('round-trips a simple string', async () => {
    const key = await makeKey()
    const envelope = await encryptString('hello world', key)
    expect(await decryptString(envelope, key)).toBe('hello world')
  })

  it('round-trips an empty string', async () => {
    const key = await makeKey()
    const envelope = await encryptString('', key)
    expect(await decryptString(envelope, key)).toBe('')
  })

  it('round-trips a large payload (~100 KB)', async () => {
    const key = await makeKey()
    const large = 'x'.repeat(100_000)
    const envelope = await encryptString(large, key)
    expect(await decryptString(envelope, key)).toBe(large)
  })

  it('produces unique ciphertext per call (random IV)', async () => {
    const key = await makeKey()
    const e1 = await encryptString('same', key)
    const e2 = await encryptString('same', key)
    expect(e1.ct).not.toBe(e2.ct)
  })

  it('throws when decrypting with a different key', async () => {
    const salt = makeSalt()
    const key1 = await deriveKey('passphrase-1', salt)
    const key2 = await deriveKey('passphrase-2', salt)
    const envelope = await encryptString('secret', key1)
    await expect(decryptString(envelope, key2)).rejects.toThrow()
  })
})

describe('encryptObject / decryptObject', () => {
  it('round-trips a JSON object', async () => {
    const key = await makeKey()
    const obj = { name: 'Alice', accounts: [1, 2, 3] }
    const envelope = await encryptObject(obj, key)
    expect(await decryptObject(envelope, key)).toEqual(obj)
  })

  it('round-trips a large JSON object', async () => {
    const key = await makeKey()
    const items = Array.from({ length: 500 }, (_, i) => ({ id: i, value: `item-${i}` }))
    const envelope = await encryptObject(items, key)
    expect(await decryptObject(envelope, key)).toEqual(items)
  })
})

describe('isEncryptedEnvelope', () => {
  it('returns true for a valid envelope', () => {
    const envelope = JSON.stringify({ v: 1, iv: 'abc', ct: 'def' })
    expect(isEncryptedEnvelope(envelope)).toBe(true)
  })

  it('returns false for plain JSON', () => {
    expect(isEncryptedEnvelope(JSON.stringify({ name: 'Alice' }))).toBe(false)
  })

  it('returns false for a non-JSON string', () => {
    expect(isEncryptedEnvelope('not json at all')).toBe(false)
  })

  it('returns false for wrong version', () => {
    expect(isEncryptedEnvelope(JSON.stringify({ v: 2, iv: 'a', ct: 'b' }))).toBe(false)
  })

  it('returns false for missing fields', () => {
    expect(isEncryptedEnvelope(JSON.stringify({ v: 1, iv: 'a' }))).toBe(false)
    expect(isEncryptedEnvelope(JSON.stringify({ v: 1, ct: 'b' }))).toBe(false)
  })

  it('returns false for null / array', () => {
    expect(isEncryptedEnvelope('null')).toBe(false)
    expect(isEncryptedEnvelope('[1,2]')).toBe(false)
  })
})
