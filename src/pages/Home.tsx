import { FC, useRef } from 'react'
import { Profile } from '../hooks/useProfile'
import '../styles/Home.css'

interface HomeProps {
  profile: Profile
  onUpdateProfile: (updates: Partial<Profile>) => void
}

const Home: FC<HomeProps> = ({ profile, onUpdateProfile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarClick = () => {
    if (!profile.avatarDataUrl) fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onUpdateProfile({ avatarDataUrl: ev.target?.result as string })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const greeting = profile.name ? `Hello, ${profile.name}` : 'Finance Tracker'

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-avatar-wrap">
            <button
              className={`hero-avatar-btn${!profile.avatarDataUrl ? ' hero-avatar-btn--empty' : ''}`}
              onClick={handleAvatarClick}
              title={profile.avatarDataUrl ? undefined : 'Click to upload a photo'}
              aria-label="Profile picture"
            >
              {profile.avatarDataUrl ? (
                <img src={profile.avatarDataUrl} alt={profile.name || 'Profile'} className="hero-avatar-img" />
              ) : (
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <circle cx="22" cy="17" r="8" stroke="currentColor" strokeWidth="2.2"/>
                  <path d="M5 40c0-9.389 7.611-17 17-17s17 7.611 17 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
          <h1>{greeting}</h1>
          <p>Take control of your financial future</p>
        </div>
      </section>

      <section className="features">
        <div className="features-container">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Track &amp; Analyze</h3>
            <p>Monitor patterns and gain insights into your financial habits.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Goal Ahead</h3>
            <p>Create and model different financial goals to achieve your goals.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">💡</div>
            <h3>Smart Decisions</h3>
            <p>Make informed financial decisions with our planning tools.</p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to take control?</h2>
          <p>Start planning your financial future today with our comprehensive tools.</p>
        </div>
      </section>
    </div>
  )
}

export default Home
