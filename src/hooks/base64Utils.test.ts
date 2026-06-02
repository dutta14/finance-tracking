import { describe, it, expect } from 'vitest'
import { toBase64, fromBase64 } from './base64Utils'

describe('base64Utils', () => {
  it('toBase64 then fromBase64 roundtrips a UTF-8 string', () => {
    const str = 'Hello, world! Café résumé naïve'
    expect(fromBase64(toBase64(str))).toBe(str)
  })

  it('handles emoji and multi-byte characters', () => {
    const str = '💰 Savings: €1,000 — 日本語テスト 🎉'
    expect(fromBase64(toBase64(str))).toBe(str)
  })

  it('fromBase64 throws on invalid input', () => {
    expect(() => fromBase64('!!!not-valid-base64!!!')).toThrow()
  })
})
