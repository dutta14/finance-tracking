import { describe, it, expect } from 'vitest'
import { toBase64, fromBase64 } from './base64Utils'

describe('base64Utils', () => {
  it('toBase64 then fromBase64 roundtrips ASCII', () => {
    const csv = 'Date,Category,Amount\n2025-01-15,Groceries,42.50'
    expect(fromBase64(toBase64(csv))).toBe(csv)
  })

  it('toBase64 then fromBase64 roundtrips UTF-8 with emoji', () => {
    const text = 'Savings 💰 €100'
    expect(fromBase64(toBase64(text))).toBe(text)
  })

  it('handles empty string', () => {
    expect(toBase64('')).toBe('')
    expect(fromBase64(toBase64(''))).toBe('')
  })

  it('fromBase64 throws on invalid input', () => {
    expect(() => fromBase64('!!!not-base64!!!')).toThrow()
  })
})
