import { useState } from 'react'

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
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    /* ignore */
  }
  return { name: '', avatarDataUrl: '', birthday: '' }
}

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile>(loadProfile)

  const updateProfile = (updates: Partial<Profile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return { profile, updateProfile }
}
