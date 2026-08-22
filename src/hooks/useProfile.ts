import { useState, useEffect, useCallback } from 'react'
import { useFileStore } from '../contexts/FileStoreContext'

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

export const PROFILE_PATH = 'profile.json'

const EMPTY_PROFILE: Profile = { name: '', avatarDataUrl: '', birthday: '' }

export const useProfile = () => {
  const { fileStore } = useFileStore()
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)

  useEffect(() => {
    let cancelled = false

    const refresh = () => {
      fileStore
        .readJSON<Profile>(PROFILE_PATH, EMPTY_PROFILE)
        .then(next => {
          if (!cancelled) setProfile(next)
        })
        .catch(console.error)
    }

    refresh()
    const unsubscribe = fileStore.subscribe(PROFILE_PATH, refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [fileStore])

  const updateProfile = useCallback(
    (updates: Partial<Profile>) => {
      setProfile(prev => {
        const next = { ...prev, ...updates }
        fileStore.writeJSON(PROFILE_PATH, next).catch(console.error)
        return next
      })
    },
    [fileStore],
  )

  return { profile, updateProfile }
}
