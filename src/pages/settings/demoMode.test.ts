import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFileStore } from '../../utils/memoryFileStore'
import { seedDemoData } from './demoMode'

const freezeAt = (isoDate: string) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(isoDate))
}

describe('seedDemoData', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('writes the full demo dataset into the store', async () => {
    freezeAt('2026-08-27T12:00:00.000Z')
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const store = new MemoryFileStore()

    await seedDemoData(store)

    expect(randomSpy).toHaveBeenCalled()
    await expect(store.readJSON('profile.json', null)).resolves.toEqual(
      expect.objectContaining({ name: 'Alex', partner: expect.objectContaining({ name: 'Sam' }) }),
    )
    await expect(store.readJSON('goals.json', null)).resolves.toEqual(
      expect.objectContaining({
        financialGoals: expect.arrayContaining([expect.objectContaining({ goalName: 'Early Retirement' })]),
      }),
    )
    await expect(store.readJSON('accounts.json', [])).resolves.toHaveLength(5)
    await expect(store.exists('balances/2016.csv')).resolves.toBe(true)
    await expect(store.exists('balances/2026.csv')).resolves.toBe(true)
    await expect(store.exists('transactions/2024/2024-01.csv')).resolves.toBe(true)
    await expect(store.exists('transactions/2026/2026-08.csv')).resolves.toBe(true)
    await expect(store.readJSON('taxes/templates.json', [])).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Standard Filing' })]),
    )
    await expect(store.readJSON('allocation.json', [])).resolves.toHaveLength(2)
    await expect(store.readJSON('fi-simulations.json', [])).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Base Case' })]),
    )
  })

  it('also seeds valid data when optional random branches are skipped', async () => {
    freezeAt('2026-02-14T12:00:00.000Z')
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const store = new MemoryFileStore()

    await seedDemoData(store)

    const janCsv = await store.readCSV('transactions/2024/2024-01.csv')
    const currentYearCsv = await store.readCSV('transactions/2026/2026-02.csv')
    const taxes2026 = await store.readJSON<Record<string, unknown>>('taxes/2026.json', {})

    expect(janCsv[0]).toEqual(['Date', 'Category', 'Amount'])
    expect(currentYearCsv.length).toBeGreaterThan(5)
    expect(Object.keys(taxes2026)).toContain('items')
    await expect(store.readJSON('savings-tracker-overrides.json', null)).resolves.toEqual({})
  })
})
