import { useState, useEffect } from 'react'
import { appStorage } from '../utils/appStorage'

export interface Profile {
  name: string
  avatarDataUrl: string
  birthday: string
  partner?: {
    name: string
    avatarDataUrl: string
    birthday: string
  } | null
}

const STORAGE_KEY = 'user-profile'

const loadProfile = (): Profile => {
  try {
    return appStorage.getJSON<Profile>(STORAGE_KEY, { name: '', avatarDataUrl: '', birthday: '' })
  } catch {
    /* ignore */
  }
  return { name: '', avatarDataUrl: '', birthday: '' }
}

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile>(loadProfile)

  // Cross-tab sync: reload profile when another tab writes to storage
  useEffect(() => {
    const unsub = appStorage.subscribe(STORAGE_KEY, () => {
      setProfile(loadProfile())
    })
    return unsub
  }, [])

  const updateProfile = (updates: Partial<Profile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates }
      appStorage.setJSON(STORAGE_KEY, next)
      return next
    })
  }

  return { profile, updateProfile }
}
