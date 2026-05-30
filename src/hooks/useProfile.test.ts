import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProfile, Profile } from './useProfile'
import { appStorage } from '../utils/appStorage'

const STORAGE_KEY = 'user-profile'

beforeEach(() => {
  localStorage.clear()
})

describe('Profile loading logic', () => {
  it('returns empty profile when nothing stored', () => {
    const profile = appStorage.getJSON<Profile>(STORAGE_KEY, { name: '', avatarDataUrl: '', birthday: '' })
    expect(profile.name).toBe('')
    expect(profile.avatarDataUrl).toBe('')
    expect(profile.birthday).toBe('')
  })

  it('loads saved profile from appStorage', () => {
    const saved: Profile = {
      name: 'Jane',
      avatarDataUrl: 'data:image/png;base64,abc',
      birthday: '1990-05-15',
    }
    appStorage.setJSON(STORAGE_KEY, saved)
    const profile = appStorage.getJSON<Profile>(STORAGE_KEY, { name: '', avatarDataUrl: '', birthday: '' })
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
    appStorage.setJSON(STORAGE_KEY, saved)
    const profile = appStorage.getJSON<Profile>(STORAGE_KEY, { name: '', avatarDataUrl: '', birthday: '' })
    expect(profile.partner?.name).toBe('John')
    expect(profile.partner?.birthday).toBe('1988-03-20')
  })

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{bad json')
    const profile = appStorage.getJSON<Profile>(STORAGE_KEY, { name: '', avatarDataUrl: '', birthday: '' })
    expect(profile.name).toBe('')
  })

  it('handles profile with null partner', () => {
    const saved: Profile = {
      name: 'Solo',
      avatarDataUrl: '',
      birthday: '1995-01-01',
      partner: null,
    }
    appStorage.setJSON(STORAGE_KEY, saved)
    const profile = appStorage.getJSON<Profile>(STORAGE_KEY, { name: '', avatarDataUrl: '', birthday: '' })
    expect(profile.name).toBe('Solo')
    expect(profile.partner).toBeNull()
  })
})

describe('useProfile cross-tab sync', () => {
  let subscribeSpy: ReturnType<typeof vi.spyOn>
  let capturedCallback: ((value: string | null) => void) | undefined
  let unsub: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    localStorage.clear()
    capturedCallback = undefined
    unsub = vi.fn(() => undefined)
    subscribeSpy = vi.spyOn(appStorage, 'subscribe').mockImplementation((key, cb) => {
      if (key === 'user-profile') capturedCallback = cb
      return () => unsub()
    })
  })

  afterEach(() => {
    subscribeSpy.mockRestore()
  })

  it('subscribes to user-profile on mount', () => {
    renderHook(() => useProfile())
    expect(subscribeSpy).toHaveBeenCalledWith('user-profile', expect.any(Function))
  })

  it('reloads profile when subscriber callback fires', () => {
    const { result } = renderHook(() => useProfile())
    expect(result.current.profile.name).toBe('')

    const updatedProfile: Profile = {
      name: 'Updated Name',
      avatarDataUrl: 'data:image/png;base64,xyz',
      birthday: '1985-12-25',
    }
    appStorage.setJSON(STORAGE_KEY, updatedProfile)

    act(() => {
      capturedCallback!(null)
    })

    expect(result.current.profile.name).toBe('Updated Name')
    expect(result.current.profile.birthday).toBe('1985-12-25')
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useProfile())
    expect(unsub).not.toHaveBeenCalled()
    unmount()
    expect(unsub).toHaveBeenCalled()
  })
})
