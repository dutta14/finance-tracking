import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('colorThemes.css dark mode native control overrides', () => {
  const cssPath = path.resolve(__dirname, 'colorThemes.css')
  const source = fs.readFileSync(cssPath, 'utf-8')

  it('inverts the webkit calendar picker indicator under body.dark for date/datetime-local/month/time inputs', () => {
    const block = source.match(
      /body\.dark input\[type='date'\]::-webkit-calendar-picker-indicator[\s\S]*?\{[\s\S]*?filter:\s*invert\(1\)\s*brightness\(1\.2\)[\s\S]*?\}/,
    )
    expect(block).not.toBeNull()
    const text = block![0]
    expect(text).toContain("input[type='date']::-webkit-calendar-picker-indicator")
    expect(text).toContain("input[type='datetime-local']::-webkit-calendar-picker-indicator")
    expect(text).toContain("input[type='month']::-webkit-calendar-picker-indicator")
    expect(text).toContain("input[type='time']::-webkit-calendar-picker-indicator")
    expect(text).toMatch(/cursor:\s*pointer/)
  })
})
