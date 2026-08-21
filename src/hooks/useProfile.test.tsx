import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { useProfile, Profile, PROFILE_PATH } from './useProfile'
import { MemoryFileStore } from '../utils/memoryFileStore'
import { FileStoreTestProvider } from '../test/fileStoreTestUtils'

let fileStore: MemoryFileStore

const wrapper = ({ children }: { children: ReactNode }) => (
  <FileStoreTestProvider store={fileStore}>{children}</FileStoreTestProvider>
)

beforeEach(() => {
  fileStore = new MemoryFileStore()
})

describe('useProfile', () => {
  it('starts with an empty profile when profile.json does not exist', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.profile.name).toBe(''))
    expect(result.current.profile.avatarDataUrl).toBe('')
    expect(result.current.profile.birthday).toBe('')
  })

  it('loads a saved profile from profile.json', async () => {
    const saved: Profile = { name: 'Jane', avatarDataUrl: 'data:image/png;base64,abc', birthday: '1990-05-15' }
    await fileStore.writeJSON(PROFILE_PATH, saved)

    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.profile.name).toBe('Jane'))
    expect(result.current.profile.birthday).toBe('1990-05-15')
  })

  it('loads partner data alongside the primary profile', async () => {
    await fileStore.writeJSON(PROFILE_PATH, {
      name: 'Jane',
      avatarDataUrl: '',
      birthday: '1990-05-15',
      partner: { name: 'John', avatarDataUrl: '', birthday: '1988-03-20' },
    })

    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.profile.partner?.name).toBe('John'))
    expect(result.current.profile.partner?.birthday).toBe('1988-03-20')
  })

  it('preserves an explicitly null partner', async () => {
    await fileStore.writeJSON(PROFILE_PATH, {
      name: 'Solo',
      avatarDataUrl: '',
      birthday: '1995-01-01',
      partner: null,
    })

    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.profile.name).toBe('Solo'))
    expect(result.current.profile.partner).toBeNull()
  })

  it('falls back to an empty profile when profile.json is corrupt', async () => {
    await fileStore.writeCSV(PROFILE_PATH, [['{bad json']])

    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.profile.name).toBe(''))
  })

  it('writes merged updates back to profile.json', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.profile.name).toBe(''))

    act(() => {
      result.current.updateProfile({ name: 'Updated Name' })
    })

    await waitFor(() => expect(result.current.profile.name).toBe('Updated Name'))
    await expect(fileStore.readJSON<Profile>(PROFILE_PATH, {} as Profile)).resolves.toMatchObject({
      name: 'Updated Name',
      birthday: '',
    })
  })

  it('reloads the profile when the file changes in another tab', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.profile.name).toBe(''))

    await act(async () => {
      await fileStore.writeJSON(PROFILE_PATH, {
        name: 'Remote Name',
        avatarDataUrl: '',
        birthday: '1985-12-25',
      })
    })

    await waitFor(() => expect(result.current.profile.name).toBe('Remote Name'))
    expect(result.current.profile.birthday).toBe('1985-12-25')
  })
})
