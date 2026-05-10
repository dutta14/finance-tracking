import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfilePane from './ProfilePane'
import { makeProfile } from '../../../test/factories'
import type { Profile } from '../../../hooks/useProfile'

const defaultProfile = makeProfile()

const renderPane = (overrides: Partial<Profile> = {}, onUpdate = vi.fn()) => {
  const profile = makeProfile(overrides)
  const onUpdateProfile = onUpdate
  const utils = render(<ProfilePane profile={profile} onUpdateProfile={onUpdateProfile} />)
  return { ...utils, onUpdateProfile, profile }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ProfilePane', () => {
  describe('view mode', () => {
    it('renders profile name in view mode', () => {
      renderPane({ name: 'Alice' })
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    it('renders "No name set" when name is empty', () => {
      renderPane({ name: '' })
      expect(screen.getByText('No name set')).toBeInTheDocument()
    })

    it('renders the Edit Profile button in view mode', () => {
      renderPane()
      expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument()
    })

    it('displays avatar image when avatarDataUrl is present', () => {
      renderPane({ avatarDataUrl: 'data:image/png;base64,abc' })
      expect(screen.getByAltText('Profile')).toBeInTheDocument()
    })

    it('displays placeholder when no avatar is set', () => {
      renderPane({ avatarDataUrl: '' })
      expect(screen.queryByAltText('Profile')).not.toBeInTheDocument()
    })

    it('renders partner card when partner exists', () => {
      renderPane({
        partner: { name: 'Bob', birthday: '1992-05-10', avatarDataUrl: '' },
      })
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Partner')).toBeInTheDocument()
    })

    it('does not render partner card when partner is null', () => {
      renderPane({ partner: null })
      expect(screen.queryByText('Partner')).not.toBeInTheDocument()
    })
  })

  describe('edit mode', () => {
    it('switches to edit mode on Edit Profile click', async () => {
      const user = userEvent.setup()
      renderPane()
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
      expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument()
    })

    it('shows name and birthday input fields in edit mode', async () => {
      const user = userEvent.setup()
      renderPane({ name: 'Alice', birthday: '1990-01-15' })
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
      expect(screen.getByDisplayValue('1990-01-15')).toBeInTheDocument()
    })

    it('shows Save Profile and Cancel buttons in edit mode', async () => {
      const user = userEvent.setup()
      renderPane()
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
      expect(screen.getByRole('button', { name: 'Save Profile' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('saves updated profile on Save Profile click', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const { onUpdateProfile } = renderPane({ name: 'Alice', birthday: '1990-01-15' })
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
      const nameInput = screen.getByDisplayValue('Alice')
      await user.clear(nameInput)
      await user.type(nameInput, 'Charlie')
      await user.click(screen.getByRole('button', { name: 'Save Profile' }))
      expect(onUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ name: 'Charlie' }))
    })

    it('reverts changes on Cancel click', async () => {
      const user = userEvent.setup()
      renderPane({ name: 'Alice' })
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
      const nameInput = screen.getByDisplayValue('Alice')
      await user.clear(nameInput)
      await user.type(nameInput, 'Changed')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('Changed')).not.toBeInTheDocument()
    })

    it('shows success flash after saving and hides it after timeout', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPane({ name: 'Alice' })
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
      await user.click(screen.getByRole('button', { name: 'Save Profile' }))
      expect(screen.getByText('Profile saved!')).toBeInTheDocument()
      vi.advanceTimersByTime(2000)
      await waitFor(() => {
        expect(screen.queryByText('Profile saved!')).not.toBeInTheDocument()
      })
    })

    it('uploads avatar via file input', async () => {
      let capturedOnload: ((event: unknown) => void) | null = null
      const readAsDataURLMock = vi.fn()

      const OriginalFileReader = window.FileReader
      vi.stubGlobal(
        'FileReader',
        class {
          onload: ((event: unknown) => void) | null = null
          readAsDataURL = (...args: unknown[]) => {
            readAsDataURLMock(...args)
            capturedOnload = this.onload
          }
        },
      )

      const user = userEvent.setup()
      renderPane()
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))

      const file = new File(['img'], 'photo.png', { type: 'image/png' })
      const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement

      fireEvent.change(fileInput, { target: { files: [file] } })
      expect(readAsDataURLMock).toHaveBeenCalledWith(file)
      capturedOnload?.({ target: { result: 'data:image/png;base64,mockdata' } })

      await waitFor(() => {
        expect(screen.getByAltText('Profile')).toHaveAttribute('src', 'data:image/png;base64,mockdata')
      })

      vi.stubGlobal('FileReader', OriginalFileReader)
    })
  })

  describe('partner section', () => {
    it('renders partner fields in edit mode when partner exists', async () => {
      const user = userEvent.setup()
      renderPane({
        partner: { name: 'Dana', birthday: '1993-03-20', avatarDataUrl: '' },
      })
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
      expect(screen.getByDisplayValue('Dana')).toBeInTheDocument()
      expect(screen.getByDisplayValue('1993-03-20')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    })

    it('adds partner section via Add Partner button', async () => {
      const user = userEvent.setup()
      renderPane({ partner: null })
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
      expect(screen.getByRole('button', { name: '+ Add Partner' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '+ Add Partner' }))
      expect(screen.getByPlaceholderText("Partner's name")).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '+ Add Partner' })).not.toBeInTheDocument()
    })

    it('removes partner section via Remove button', async () => {
      const user = userEvent.setup()
      renderPane({
        partner: { name: 'Dana', birthday: '1993-03-20', avatarDataUrl: '' },
      })
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
      await user.click(screen.getByRole('button', { name: 'Remove' }))
      expect(screen.queryByDisplayValue('Dana')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '+ Add Partner' })).toBeInTheDocument()
    })

    it('saves partner data when saving profile with partner', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const { onUpdateProfile } = renderPane({
        partner: { name: 'Dana', birthday: '1993-03-20', avatarDataUrl: '' },
      })
      await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
      const partnerInput = screen.getByDisplayValue('Dana')
      await user.clear(partnerInput)
      await user.type(partnerInput, 'Eve')
      await user.click(screen.getByRole('button', { name: 'Save Profile' }))
      expect(onUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          partner: expect.objectContaining({ name: 'Eve' }),
        }),
      )
    })
  })
})
