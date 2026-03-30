import { FC } from 'react'
import '../styles/Home.css'

const Home: FC = () => {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <h1>Welcome to Finance Tracker</h1>
          <p>Take control of your financial future</p>
        </div>
      </section>

      <section className="features">
        <div className="features-container">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Track & Analyze</h3>
            <p>Monitor your spending patterns and gain insights into your financial habits.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Plan Ahead</h3>
            <p>Create and model different financial plans to achieve your goals.</p>
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
