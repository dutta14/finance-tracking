import { describe, it, expect } from 'vitest'

describe('settings/index exports', () => {
  it('exports SettingsModal component', async () => {
    const mod = await import('./index')
    expect(mod.SettingsModal).toBeDefined()
  })

  it('exports SettingsMenu component', async () => {
    const mod = await import('./index')
    expect(mod.SettingsMenu).toBeDefined()
  })
})
