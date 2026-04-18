import { FC, useState, useRef } from 'react'
import type { ProfilePaneProps } from '../types'

const ProfilePane: FC<ProfilePaneProps> = ({ profile, onUpdateProfile }) => {
  const [name, setName] = useState(profile.name || '')
  const [birthday, setBirthday] = useState(profile.birthday || '')
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarDataUrl || '')
  const [hasPartner, setHasPartner] = useState(!!profile.partner)
  const [partnerName, setPartnerName] = useState(profile.partner?.name || '')
  const [partnerBirthday, setPartnerBirthday] = useState(profile.partner?.birthday || '')
  const [partnerAvatarPreview, setPartnerAvatarPreview] = useState(profile.partner?.avatarDataUrl || '')
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const partnerFileInputRef = useRef<HTMLInputElement>(null)

  const handleProfileSave = () => {
    onUpdateProfile({
      name: name.trim(),
      birthday,
      avatarDataUrl: avatarPreview,
      partner: hasPartner ? { name: partnerName.trim(), birthday: partnerBirthday, avatarDataUrl: partnerAvatarPreview } : null,
    })
    setProfileEditing(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  const handleProfileCancel = () => {
    setName(profile.name || '')
    setBirthday(profile.birthday || '')
    setAvatarPreview(profile.avatarDataUrl || '')
    setHasPartner(!!profile.partner)
    setPartnerName(profile.partner?.name || '')
    setPartnerBirthday(profile.partner?.birthday || '')
    setPartnerAvatarPreview(profile.partner?.avatarDataUrl || '')
    setProfileEditing(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => { setAvatarPreview(event.target?.result as string) }
      reader.readAsDataURL(file)
    }
  }

  const handlePartnerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => { setPartnerAvatarPreview(event.target?.result as string) }
      reader.readAsDataURL(file)
    }
  }

  const avatarSvg = (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 32c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )

  return (
    <div className="settings-section">
      <h3>Profile</h3>
      <div className="settings-section-content">
        {!profileEditing ? (
          <>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="settings-profile-card settings-profile-card--view" style={{ flex: 1 }}>
                <div className="settings-profile-view-avatar">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="Profile" className="settings-avatar-img" />
                    : <div className="settings-avatar-placeholder">{avatarSvg}</div>}
                </div>
                <div className="settings-profile-view-info">
                  <span className="settings-profile-view-name">{name || 'No name set'}</span>
                  <span className="settings-profile-view-role">Primary</span>
                </div>
              </div>
              {hasPartner && (
                <div className="settings-profile-card settings-profile-card--view" style={{ flex: 1 }}>
                  <div className="settings-profile-view-avatar">
                    {partnerAvatarPreview
                      ? <img src={partnerAvatarPreview} alt="Partner" className="settings-avatar-img" />
                      : <div className="settings-avatar-placeholder">{avatarSvg}</div>}
                  </div>
                  <div className="settings-profile-view-info">
                    <span className="settings-profile-view-name">{partnerName || 'No name set'}</span>
                    <span className="settings-profile-view-role">Partner</span>
                  </div>
                </div>
              )}
            </div>
            <div className="settings-save-row">
              <button className="settings-btn" onClick={() => setProfileEditing(true)}>Edit Profile</button>
              {profileSaved && <span className="settings-save-flash">Profile saved!</span>}
            </div>
          </>
        ) : (
          <>
            <div className="settings-profile-columns">
              <div className="settings-profile-card">
                <h4 className="settings-profile-card-title">You</h4>
                <div className="settings-avatar-section">
                  <button className="settings-avatar-btn" onClick={() => fileInputRef.current?.click()} title="Click to upload a photo" aria-label="Upload profile picture">
                    {avatarPreview
                      ? <img src={avatarPreview} alt="Profile" className="settings-avatar-img" />
                      : <div className="settings-avatar-placeholder">{avatarSvg}</div>}
                    <div className="settings-avatar-overlay">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 17h14M10 3l4 4-7 7H3v-4l7-7z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                </div>
                <div className="settings-field">
                  <label className="settings-label">Name</label>
                  <input type="text" className="settings-input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="settings-field">
                  <label className="settings-label">Birthday</label>
                  <input type="date" className="settings-input" value={birthday} onChange={e => setBirthday(e.target.value)} />
                </div>
              </div>
              {hasPartner && (
                <div className="settings-profile-card">
                  <div className="settings-partner-header">
                    <h4 className="settings-profile-card-title">Partner</h4>
                    <button className="settings-partner-remove" onClick={() => { setHasPartner(false); setPartnerName(''); setPartnerBirthday(''); setPartnerAvatarPreview('') }}>Remove</button>
                  </div>
                  <div className="settings-avatar-section">
                    <button className="settings-avatar-btn" onClick={() => partnerFileInputRef.current?.click()} title="Upload partner photo" aria-label="Upload partner picture">
                      {partnerAvatarPreview
                        ? <img src={partnerAvatarPreview} alt="Partner" className="settings-avatar-img" />
                        : <div className="settings-avatar-placeholder">{avatarSvg}</div>}
                      <div className="settings-avatar-overlay">
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 17h14M10 3l4 4-7 7H3v-4l7-7z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </button>
                    <input ref={partnerFileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePartnerFileChange} />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label">Name</label>
                    <input type="text" className="settings-input" value={partnerName} onChange={e => setPartnerName(e.target.value)} placeholder="Partner's name" />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label">Birthday</label>
                    <input type="date" className="settings-input" value={partnerBirthday} onChange={e => setPartnerBirthday(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            {!hasPartner && (
              <button className="settings-add-partner-btn" onClick={() => setHasPartner(true)}>+ Add Partner</button>
            )}
            <div className="settings-save-row">
              <button className="settings-btn" onClick={handleProfileSave}>Save Profile</button>
              <button className="settings-btn settings-btn--secondary" onClick={handleProfileCancel}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ProfilePane
