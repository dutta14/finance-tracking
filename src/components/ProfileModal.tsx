import { FC, useState, useRef, useEffect } from 'react'
import { Profile } from '../hooks/useProfile'
import '../styles/ProfileModal.css'

interface ProfileModalProps {
  profile: Profile
  onSave: (updates: Partial<Profile>) => void
  onClose: () => void
}

const ProfileModal: FC<ProfileModalProps> = ({ profile, onSave, onClose }) => {
  const [name, setName] = useState(profile.name)
  const [birthday, setBirthday] = useState(profile.birthday || '')
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarDataUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setAvatarPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    onSave({ name: name.trim(), avatarDataUrl: avatarPreview, birthday })
    onClose()
  }

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div
        className="profile-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
      >
        <div className="profile-modal-header">
          <h2>Profile</h2>
          <button className="profile-modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="profile-modal-body">
          {/* Avatar */}
          <div className="profile-avatar-section">
            <button
              className="profile-avatar-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Click to upload a photo"
              aria-label="Upload profile picture"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder">
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <circle cx="18" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
                    <path d="M4 32c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
              <div className="profile-avatar-overlay">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M3 17h14M10 3l4 4-7 7H3v-4l7-7z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <p className="profile-avatar-hint">Click to upload</p>
          </div>

          {/* Name */}
          <div className="profile-field">
            <label className="profile-label" htmlFor="profile-name">Display Name</label>
            <input
              id="profile-name"
              className="profile-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              autoFocus
            />
          </div>

          {/* Birthday */}
          <div className="profile-field">
            <label className="profile-label" htmlFor="profile-birthday">Birthday</label>
            <input
              id="profile-birthday"
              className="profile-input"
              type="date"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
            />
          </div>
        </div>

        <div className="profile-modal-footer">
          <button className="profile-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="profile-save-btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default ProfileModal
