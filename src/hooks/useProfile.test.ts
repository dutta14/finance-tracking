import { describe, it, expect, beforeEach } from 'vitest'
import { Profile } from './useProfile'

const STORAGE_KEY = 'user-profile'

const loadProfile = (): Profile => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return { name: '', avatarDataUrl: '', birthday: '' }
}

beforeEach(() => {
  localStorage.clear()
})

describe('Profile loading logic', () => {
  it('returns empty profile when nothing stored', () => {
    const profile = loadProfile()
    expect(profile.name).toBe('')
    expect(profile.avatarDataUrl).toBe('')
    expect(profile.birthday).toBe('')
  })

  it('loads saved profile from localStorage', () => {
    const saved: Profile = {
      name: 'Jane',
      avatarDataUrl: 'data:image/png;base64,abc',
      birthday: '1990-05-15',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    const profile = loadProfile()
    expect(profile.name).toBe('Jane')
    expect(profile.birthday).toBe('1990-05-15')
  })

  it('loads profile with partner data', () => {
    const saved: Profile = {
      name: 'Jane',
      avatarDataUrl: '',
      birthday: '1990-05-15',
      partner: {
        name: 'John',
        avatarDataUrl: '',
        birthday: '1988-03-20',
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    const profile = loadProfile()
    expect(profile.partner?.name).toBe('John')
    expect(profile.partner?.birthday).toBe('1988-03-20')
  })

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{bad json')
    const profile = loadProfile()
    expect(profile.name).toBe('')
  })

  it('handles profile with null partner', () => {
    const saved: Profile = {
      name: 'Solo',
      avatarDataUrl: '',
      birthday: '1995-01-01',
      partner: null,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    const profile = loadProfile()
    expect(profile.name).toBe('Solo')
    expect(profile.partner).toBeNull()
  })
})
