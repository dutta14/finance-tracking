import { describe, it, expect } from 'vitest'
import { validateImportPayload, ALLOWED_ACCENT_THEMES } from './importValidator'

/* ── Helpers ────────────────────────────────────────────────────── */

const validGoal = {
  id: 1,
  goalName: 'Retire Early',
  createdAt: '2024-01-01',
  birthday: '1990-01-01',
  goalCreatedIn: '2024',
  goalEndYear: '2050',
  resetExpenseMonth: false,
  retirementAge: 50,
  expenseMonth: 5000,
  expenseValue: 60000,
  monthlyExpenseValue: 5000,
  expenseValueMar2026: 62000,
  expenseValue2047: 100000,
  monthlyExpense2047: 8300,
  safeWithdrawalRate: 4,
  growth: 7,
  retirement: '2040-01-01',
  fiGoal: 1500000,
  progress: 42,
}

const validAccount = {
  id: 1,
  name: '401k',
  type: 'retirement',
  owner: 'primary',
  status: 'active',
  goalType: 'fi',
  nature: 'asset',
  allocation: 'us-stock',
}

const validBalance = {
  id: 1,
  accountId: 1,
  month: '2025-01',
  balance: 50000,
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    version: 2,
    exportedAt: '2025-01-01T00:00:00.000Z',
    goals: [validGoal],
    profile: { name: 'Alice', birthday: '1990-01-01', avatarDataUrl: '' },
    settings: { accentTheme: 'blue', darkMode: false, allowCsvImport: false, goalViewMode: 'grid' },
    ...overrides,
  }
}

/* ── Tests ──────────────────────────────────────────────────────── */

describe('validateImportPayload', () => {
  describe('valid payloads', () => {
    it('accepts a valid v2 export payload', () => {
      const result = validateImportPayload(makePayload())
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.sanitized).toBeDefined()
      expect(result.sanitized!.goals).toHaveLength(1)
    })

    it('accepts a payload with all optional fields', () => {
      const result = validateImportPayload(
        makePayload({
          gwGoals: [
            {
              id: 1,
              fiGoalId: 1,
              label: 'House',
              createdAt: '2024-01-01',
              disburseAge: 40,
              disburseAmount: 200000,
              growthRate: 7,
              currentSavings: 50000,
            },
          ],
          dataAccounts: [validAccount],
          dataBalances: [validBalance],
          budgetCsvs: { '2025-01': { month: '2025-01', csv: 'a,b,c', uploadedAt: '2025-01-01' } },
          budgetConfig: { years: [2025], categoryGroups: [] },
          fiSimulations: [{ id: 1 }],
          sgtOverrides: { key: 'value' },
          allocationCustomRatios: [{ ratio: 0.5 }],
          taxStore: { years: {} },
          taxTemplates: [{ id: 't1', name: 'Default', items: [] }],
        }),
      )
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.sanitized!.dataAccounts).toHaveLength(1)
      expect(result.sanitized!.dataBalances).toHaveLength(1)
      expect(result.sanitized!.taxTemplates).toHaveLength(1)
    })

    it('accepts legacy array format (goals at top level)', () => {
      const result = validateImportPayload([validGoal])
      expect(result.valid).toBe(true)
      expect(result.sanitized!.goals).toHaveLength(1)
    })

    it('accepts legacy "plans" key', () => {
      const result = validateImportPayload({ plans: [validGoal] })
      expect(result.valid).toBe(true)
      expect(result.sanitized!.goals).toHaveLength(1)
    })
  })

  describe('missing or invalid goals', () => {
    it('rejects payload with no goals array', () => {
      const result = validateImportPayload({ version: 2, profile: { name: 'Alice' } })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing required "goals" array')
    })

    it('rejects payload where goals is not an array', () => {
      const result = validateImportPayload({ goals: 'not an array' })
      expect(result.valid).toBe(false)
    })

    it('reports per-goal warnings for invalid goal shapes', () => {
      const result = validateImportPayload(makePayload({ goals: [{ id: 'bad' }, validGoal] }))
      expect(result.valid).toBe(true) // one valid goal survives
      expect(result.sanitized!.goals).toHaveLength(1)
      expect(result.warnings.some(w => w.includes('goals[0]'))).toBe(true)
    })

    it('rejects when all goals are invalid', () => {
      const result = validateImportPayload(makePayload({ goals: [{ id: 'a' }, {}] }))
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('No valid goals found'))).toBe(true)
    })

    it('rejects goal missing goalName', () => {
      const result = validateImportPayload(makePayload({ goals: [{ id: 1 }] }))
      expect(result.valid).toBe(false)
      expect(result.warnings.some(w => w.includes('goalName'))).toBe(true)
    })
  })

  describe('account validation', () => {
    it('rejects account missing id', () => {
      const result = validateImportPayload(makePayload({ dataAccounts: [{ name: 'test' }] }))
      expect(result.warnings.some(w => w.includes('dataAccounts[0]') && w.includes('id'))).toBe(true)
    })

    it('rejects account missing name', () => {
      const result = validateImportPayload(makePayload({ dataAccounts: [{ id: 1 }] }))
      expect(result.warnings.some(w => w.includes('dataAccounts[0]') && w.includes('name'))).toBe(true)
    })

    it('ignores dataAccounts that is not an array', () => {
      const result = validateImportPayload(makePayload({ dataAccounts: 'nope' }))
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('dataAccounts'))).toBe(true)
    })
  })

  describe('balance validation', () => {
    it('rejects balance with invalid month format', () => {
      const result = validateImportPayload(
        makePayload({ dataBalances: [{ id: 1, accountId: 1, month: 'January', balance: 100 }] }),
      )
      expect(result.warnings.some(w => w.includes('dataBalances[0]') && w.includes('month'))).toBe(true)
    })

    it('rejects balance missing balance field', () => {
      const result = validateImportPayload(makePayload({ dataBalances: [{ id: 1, accountId: 1, month: '2025-01' }] }))
      expect(result.warnings.some(w => w.includes('balance'))).toBe(true)
    })
  })

  describe('profile sanitization', () => {
    it('strips HTML from profile.name', () => {
      const result = validateImportPayload(
        makePayload({
          profile: { name: '<script>alert("xss")</script>Alice', birthday: '1990-01-01', avatarDataUrl: '' },
        }),
      )
      expect(result.valid).toBe(true)
      expect(result.sanitized!.profile!.name).toBe('alert("xss")Alice')
      expect(result.sanitized!.profile!.name).not.toMatch(/<[^>]*>/)
      expect(result.warnings.some(w => w.includes('profile.name'))).toBe(true)
    })

    it('truncates profile.name to 100 chars', () => {
      const longName = 'A'.repeat(200)
      const result = validateImportPayload(
        makePayload({ profile: { name: longName, birthday: '', avatarDataUrl: '' } }),
      )
      expect(result.sanitized!.profile!.name).toHaveLength(100)
    })

    it('strips HTML from partner name', () => {
      const result = validateImportPayload(
        makePayload({ profile: { name: 'Alice', partner: { name: '<b>Bob</b>', birthday: '', avatarDataUrl: '' } } }),
      )
      expect(result.sanitized!.profile!.partner!.name).toBe('Bob')
      expect(result.sanitized!.profile!.partner!.name).not.toMatch(/<[^>]*>/)
    })

    it('drops oversized avatar data URLs', () => {
      const hugeAvatar = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024)
      const result = validateImportPayload(makePayload({ profile: { name: 'Alice', avatarDataUrl: hugeAvatar } }))
      expect(result.sanitized!.profile!.avatarDataUrl).toBeUndefined()
      expect(result.warnings.some(w => w.includes('avatarDataUrl'))).toBe(true)
    })

    it('allows null partner', () => {
      const result = validateImportPayload(makePayload({ profile: { name: 'Alice', partner: null } }))
      expect(result.valid).toBe(true)
      expect(result.sanitized!.profile!.partner).toBeNull()
    })
  })

  describe('settings validation', () => {
    it('accepts valid accent themes', () => {
      for (const theme of ALLOWED_ACCENT_THEMES) {
        const result = validateImportPayload(makePayload({ settings: { accentTheme: theme } }))
        expect(result.valid).toBe(true)
        expect(result.sanitized!.settings!.accentTheme).toBe(theme)
      }
    })

    it('rejects unknown accent theme', () => {
      const result = validateImportPayload(makePayload({ settings: { accentTheme: '<img src=x onerror=alert(1)>' } }))
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('accentTheme') && e.includes('not an allowed theme'))).toBe(true)
    })

    it('rejects CSS injection in accent theme', () => {
      const result = validateImportPayload(makePayload({ settings: { accentTheme: 'blue; background: url(evil)' } }))
      expect(result.valid).toBe(false)
    })

    it('accepts valid goal view modes', () => {
      for (const mode of ['grid', 'list', '']) {
        const result = validateImportPayload(makePayload({ settings: { accentTheme: 'blue', goalViewMode: mode } }))
        expect(result.valid).toBe(true)
        expect(result.sanitized!.settings!.goalViewMode).toBe(mode)
      }
    })

    it('ignores unknown goal view mode with warning', () => {
      const result = validateImportPayload(makePayload({ settings: { accentTheme: 'blue', goalViewMode: 'timeline' } }))
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('goalViewMode'))).toBe(true)
      expect(result.sanitized!.settings!.goalViewMode).toBeUndefined()
    })

    it('accepts legacy fiTheme key', () => {
      const result = validateImportPayload(makePayload({ settings: { fiTheme: 'teal' } }))
      expect(result.valid).toBe(true)
      expect(result.sanitized!.settings!.accentTheme).toBe('teal')
    })

    it('passes boolean flags through', () => {
      const result = validateImportPayload(
        makePayload({ settings: { accentTheme: 'blue', darkMode: true, allowCsvImport: true } }),
      )
      expect(result.sanitized!.settings!.darkMode).toBe(true)
      expect(result.sanitized!.settings!.allowCsvImport).toBe(true)
    })
  })

  describe('gwGoals validation', () => {
    it('validates gwGoal shape', () => {
      const result = validateImportPayload(makePayload({ gwGoals: [{ id: 'not-a-number', label: 'Test' }] }))
      expect(result.warnings.some(w => w.includes('gwGoals[0]'))).toBe(true)
    })

    it('accepts legacy gwPlans key', () => {
      const result = validateImportPayload(
        makePayload({
          gwPlans: [
            {
              id: 1,
              fiGoalId: 1,
              label: 'House',
              createdAt: '2024-01-01',
              disburseAge: 40,
              disburseAmount: 200000,
              growthRate: 7,
              currentSavings: 0,
            },
          ],
        }),
      )
      expect(result.valid).toBe(true)
      expect(result.sanitized!.gwGoals).toHaveLength(1)
    })
  })

  describe('tax templates validation', () => {
    it('rejects template missing id', () => {
      const result = validateImportPayload(makePayload({ taxTemplates: [{ name: 'T', items: [] }] }))
      expect(result.warnings.some(w => w.includes('taxTemplates[0]'))).toBe(true)
    })

    it('rejects template with non-array items', () => {
      const result = validateImportPayload(makePayload({ taxTemplates: [{ id: 't1', name: 'T', items: 'bad' }] }))
      expect(result.warnings.some(w => w.includes('taxTemplates[0]') && w.includes('items'))).toBe(true)
    })
  })

  describe('size limits', () => {
    it('rejects oversized payload', () => {
      const result = validateImportPayload({}, 60 * 1024 * 1024)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('50 MB')
    })

    it('accepts payload within size limit', () => {
      const result = validateImportPayload(makePayload(), 1024)
      expect(result.valid).toBe(true)
    })
  })

  describe('top-level validation', () => {
    it('rejects null', () => {
      const result = validateImportPayload(null)
      expect(result.valid).toBe(false)
    })

    it('rejects primitive', () => {
      const result = validateImportPayload('hello')
      expect(result.valid).toBe(false)
    })

    it('rejects undefined-like number', () => {
      const result = validateImportPayload(42)
      expect(result.valid).toBe(false)
    })

    it('does not include sanitized when validation fails', () => {
      const result = validateImportPayload({ goals: 'not an array' })
      expect(result.valid).toBe(false)
      expect(result.sanitized).toBeUndefined()
    })

    it('treats non-number version as warning', () => {
      const result = validateImportPayload(makePayload({ version: 'v2' }))
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('version'))).toBe(true)
      expect(result.sanitized!.version).toBeUndefined()
    })
  })

  describe('goal edge cases', () => {
    it('skips goal with whitespace-only goalName', () => {
      const result = validateImportPayload(makePayload({ goals: [{ id: 1, goalName: '   ' }] }))
      expect(result.valid).toBe(false)
      expect(result.warnings.some(w => w.includes('goalName'))).toBe(true)
    })

    it('skips goal that is not an object (e.g. string)', () => {
      const result = validateImportPayload(makePayload({ goals: ['not-a-goal', validGoal] }))
      expect(result.valid).toBe(true)
      expect(result.sanitized!.goals).toHaveLength(1)
      expect(result.warnings.some(w => w.includes('goals[0]') && w.includes('not an object'))).toBe(true)
    })
  })

  describe('gwGoals edge cases', () => {
    it('warns when gwGoals is not an array', () => {
      const result = validateImportPayload(makePayload({ gwGoals: 'not-array' }))
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('gwGoals') && w.includes('not an array'))).toBe(true)
    })

    it('skips gwGoal missing fiGoalId', () => {
      const result = validateImportPayload(makePayload({ gwGoals: [{ id: 1, label: 'Test' }] }))
      expect(result.warnings.some(w => w.includes('gwGoals[0]') && w.includes('fiGoalId'))).toBe(true)
    })

    it('skips gwGoal with empty label', () => {
      const result = validateImportPayload(makePayload({ gwGoals: [{ id: 1, fiGoalId: 1, label: '  ' }] }))
      expect(result.warnings.some(w => w.includes('gwGoals[0]') && w.includes('label'))).toBe(true)
    })

    it('skips gwGoal that is not an object', () => {
      const result = validateImportPayload(makePayload({ gwGoals: [42] }))
      expect(result.warnings.some(w => w.includes('gwGoals[0]') && w.includes('not an object'))).toBe(true)
    })
  })

  describe('profile edge cases', () => {
    it('ignores profile that is not an object', () => {
      const result = validateImportPayload(makePayload({ profile: 'not-an-object' }))
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('profile') && w.includes('not an object'))).toBe(true)
    })

    it('drops oversized partner avatar data URL', () => {
      const hugeAvatar = 'data:image/png;base64,' + 'B'.repeat(3 * 1024 * 1024)
      const result = validateImportPayload(
        makePayload({
          profile: { name: 'Alice', partner: { name: 'Bob', birthday: '', avatarDataUrl: hugeAvatar } },
        }),
      )
      expect(result.sanitized!.profile!.partner!.avatarDataUrl).toBe('')
      expect(result.warnings.some(w => w.includes('partner.avatarDataUrl'))).toBe(true)
    })
  })

  describe('settings edge cases', () => {
    it('ignores settings that is not an object', () => {
      const result = validateImportPayload(makePayload({ settings: 'string' }))
      expect(result.valid).toBe(true)
      expect(result.sanitized!.settings).toBeUndefined()
    })

    it('coerces truthy non-boolean darkMode value', () => {
      const result = validateImportPayload(makePayload({ settings: { accentTheme: 'blue', darkMode: 1 } }))
      expect(result.sanitized!.settings!.darkMode).toBe(true)
    })

    it('coerces falsy non-boolean allowCsvImport value', () => {
      const result = validateImportPayload(makePayload({ settings: { accentTheme: 'blue', allowCsvImport: 0 } }))
      expect(result.sanitized!.settings!.allowCsvImport).toBe(false)
    })

    it('sanitizes homeCardOrder string', () => {
      const result = validateImportPayload(
        makePayload({ settings: { accentTheme: 'blue', homeCardOrder: '[0,1,2,3]' } }),
      )
      expect(result.sanitized!.settings!.homeCardOrder).toBe('[0,1,2,3]')
    })
  })

  describe('optional field type mismatches', () => {
    it('warns when budgetConfig is not an object', () => {
      const result = validateImportPayload(makePayload({ budgetConfig: [1, 2] }))
      expect(result.warnings.some(w => w.includes('budgetConfig'))).toBe(true)
    })

    it('warns when fiSimulations is not an array', () => {
      const result = validateImportPayload(makePayload({ fiSimulations: 'nope' }))
      expect(result.warnings.some(w => w.includes('fiSimulations'))).toBe(true)
    })

    it('warns when sgtOverrides is not an object', () => {
      const result = validateImportPayload(makePayload({ sgtOverrides: [1] }))
      expect(result.warnings.some(w => w.includes('sgtOverrides'))).toBe(true)
    })

    it('warns when allocationCustomRatios is not an array', () => {
      const result = validateImportPayload(makePayload({ allocationCustomRatios: {} }))
      expect(result.warnings.some(w => w.includes('allocationCustomRatios'))).toBe(true)
    })

    it('warns when taxStore is not an object', () => {
      const result = validateImportPayload(makePayload({ taxStore: 'bad' }))
      expect(result.warnings.some(w => w.includes('taxStore'))).toBe(true)
    })

    it('warns when taxTemplates is not an array', () => {
      const result = validateImportPayload(makePayload({ taxTemplates: {} }))
      expect(result.warnings.some(w => w.includes('taxTemplates'))).toBe(true)
    })

    it('warns when gitHubConfig is not an object', () => {
      const result = validateImportPayload(makePayload({ gitHubConfig: 'nope' }))
      expect(result.warnings.some(w => w.includes('gitHubConfig'))).toBe(true)
    })

    it('warns when budgetCsvs is not an object', () => {
      const result = validateImportPayload(makePayload({ budgetCsvs: [1] }))
      expect(result.warnings.some(w => w.includes('budgetCsvs'))).toBe(true)
    })
  })

  describe('account/balance edge cases', () => {
    it('skips dataAccounts item that is not an object', () => {
      const result = validateImportPayload(makePayload({ dataAccounts: [42, validAccount] }))
      expect(result.sanitized!.dataAccounts).toHaveLength(1)
      expect(result.warnings.some(w => w.includes('dataAccounts[0]') && w.includes('not an object'))).toBe(true)
    })

    it('skips account with whitespace-only name', () => {
      const result = validateImportPayload(makePayload({ dataAccounts: [{ id: 1, name: '   ' }] }))
      expect(result.warnings.some(w => w.includes('dataAccounts[0]') && w.includes('name'))).toBe(true)
    })

    it('skips dataBalances item that is not an object', () => {
      const result = validateImportPayload(makePayload({ dataBalances: ['nope', validBalance] }))
      expect(result.sanitized!.dataBalances).toHaveLength(1)
      expect(result.warnings.some(w => w.includes('dataBalances[0]') && w.includes('not an object'))).toBe(true)
    })

    it('skips balance missing id', () => {
      const result = validateImportPayload(
        makePayload({ dataBalances: [{ accountId: 1, month: '2025-01', balance: 100 }] }),
      )
      expect(result.warnings.some(w => w.includes('dataBalances[0]') && w.includes('id'))).toBe(true)
    })

    it('skips balance missing accountId', () => {
      const result = validateImportPayload(makePayload({ dataBalances: [{ id: 1, month: '2025-01', balance: 100 }] }))
      expect(result.warnings.some(w => w.includes('dataBalances[0]') && w.includes('accountId'))).toBe(true)
    })
  })

  describe('tax template edge cases', () => {
    it('skips template missing name', () => {
      const result = validateImportPayload(makePayload({ taxTemplates: [{ id: 't1', items: [] }] }))
      expect(result.warnings.some(w => w.includes('taxTemplates[0]') && w.includes('name'))).toBe(true)
    })

    it('skips template that is not an object', () => {
      const result = validateImportPayload(makePayload({ taxTemplates: ['bad'] }))
      expect(result.warnings.some(w => w.includes('taxTemplates[0]') && w.includes('not an object'))).toBe(true)
    })
  })

  describe('XSS payload handling', () => {
    it('strips HTML from profile names but does not strip from goal names', () => {
      const xssGoal = { ...validGoal, goalName: '<script>alert("xss")</script>Evil Goal' }
      const result = validateImportPayload(
        makePayload({
          goals: [xssGoal],
          profile: { name: '<img onerror=alert(1)>Alice', birthday: '', avatarDataUrl: '' },
        }),
      )
      expect(result.valid).toBe(true)
      // Goals pass through as-is (caller must escape on render)
      expect(result.sanitized!.goals[0].goalName).toBe('<script>alert("xss")</script>Evil Goal')
      // Profile names are sanitized
      expect(result.sanitized!.profile!.name).toBe('Alice')
    })
  })

  describe('dataBalances edge cases', () => {
    it('warns when dataBalances is not an array', () => {
      const result = validateImportPayload(makePayload({ dataBalances: 'not-an-array' }))
      expect(result.warnings.some(w => w.includes('dataBalances') && w.includes('not an array'))).toBe(true)
    })

    it('filters out invalid balance entries with missing accountId', () => {
      const result = validateImportPayload(makePayload({ dataBalances: [{ id: 1, month: '2024-01', balance: 1000 }] }))
      expect(result.warnings.some(w => w.includes('dataBalances[0]'))).toBe(true)
    })
  })

  describe('profile edge cases', () => {
    it('returns undefined profile when profile is not an object', () => {
      const result = validateImportPayload(makePayload({ profile: 'not-an-object' }))
      expect(result.sanitized!.profile).toBeUndefined()
    })

    it('returns undefined profile when profile is null', () => {
      const result = validateImportPayload(makePayload({ profile: null }))
      expect(result.sanitized!.profile).toBeUndefined()
    })
  })
})
