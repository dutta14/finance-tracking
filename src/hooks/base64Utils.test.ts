import { describe, it, expect } from 'vitest'
import { toBase64, fromBase64 } from './base64Utils'

describe('base64Utils', () => {
  it('roundtrips ASCII text', () => {
    const input = 'Hello, World! 123'
    const encoded = toBase64(input)
    const decoded = fromBase64(encoded)

    expect(decoded).toBe(input)
  })

  it('roundtrips emoji and multi-byte characters', () => {
    const input = 'Savings 💰 €100'
    const encoded = toBase64(input)
    const decoded = fromBase64(encoded)

    expect(decoded).toBe(input)
  })

  it('roundtrips empty string to empty string', () => {
    const encoded = toBase64('')
    const decoded = fromBase64(encoded)

    expect(encoded).toBe('')
    expect(decoded).toBe('')
  })

  it('throws on invalid base64 input', () => {
    expect(() => fromBase64('!!!not-valid-base64!!!')).toThrow()
  })
})
